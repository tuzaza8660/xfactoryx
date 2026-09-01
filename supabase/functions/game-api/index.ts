import { createClient } from 'npm:@supabase/supabase-js@2';
import { FIXED_STEP, RoulettePhysics } from '../../../games/roulette/prototype/roulette-physics.js';

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, apikey, content-type, idempotency-key', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS' };
const ok = (data:unknown, status=200) => new Response(JSON.stringify({data}), {status,headers:{...cors,'Content-Type':'application/json'}});
const fail = (code:string, message:string, status=400) => new Response(JSON.stringify({error:{code,message}}), {status,headers:{...cors,'Content-Type':'application/json'}});
const env = (name:string) => { const value=Deno.env.get(name); if(!value) throw new Error(`Missing ${name}`); return value; };
const admin = createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
const ROUND_MS=60000, BETTING_MS=32000, SPIN_MS=18000;

function publicRound(round:any) {
  const now=Date.now(), closes=new Date(round.betting_closes_at).getTime(), settles=new Date(round.settles_at).getTime(), ends=new Date(round.betting_opens_at).getTime()+ROUND_MS;
  const phase=now<closes?'betting':now<settles?'spinning':'result';
  const kst=new Date(new Date(round.betting_opens_at).getTime()+9*60*60*1000), slot=kst.getUTCHours()*60+kst.getUTCMinutes()+1;
  const roundNumber=`R${String(kst.getUTCFullYear()).slice(-2)}${String(kst.getUTCMonth()+1).padStart(2,'0')}${String(kst.getUTCDate()).padStart(2,'0')}-${String(slot).padStart(4,'0')}`;
  return {roundId:round.id,roundNumber,serverNow:new Date(now).toISOString(),phase,opensAt:round.betting_opens_at,closesAt:round.betting_closes_at,startsAt:round.starts_at,settlesAt:round.settles_at,endsAt:new Date(ends).toISOString(),physicsVersion:round.physics_version,...(now>=closes?{seed:round.seed,result:round.result}:{})};
}

async function userFrom(request:Request) {
  const token=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!token) return null;
  const {data}=await admin.auth.getUser(token); return data.user;
}

async function ensureRound() {
  const now=Date.now(), opens=Math.floor(now/ROUND_MS)*ROUND_MS, starts=opens+BETTING_MS, key=Math.floor(opens/ROUND_MS);
  const {data:existing}=await admin.from('roulette_rounds').select('*').eq('round_key',key).maybeSingle();
  if(existing) return existing;
  const bytes=new Uint32Array(1); crypto.getRandomValues(bytes); const seed=bytes[0];
  const physics=new RoulettePhysics(); let state=physics.start(seed);
  while(!state.finished) state=physics.step(FIXED_STEP);
  const row={round_key:key,seed,result:Number(state.result),physics_version:'v1',betting_opens_at:new Date(opens).toISOString(),betting_closes_at:new Date(starts).toISOString(),starts_at:new Date(starts).toISOString(),settles_at:new Date(starts+SPIN_MS).toISOString()};
  const {data,error}=await admin.from('roulette_rounds').insert(row).select('*').single();
  if(!error) return data;
  const {data:raced,error:readError}=await admin.from('roulette_rounds').select('*').eq('round_key',key).single();
  if(readError) throw readError; return raced;
}

async function settleDue() {
  const {data}=await admin.from('roulette_rounds').select('id').is('settled_at',null).lte('settles_at',new Date().toISOString()).limit(10);
  for(const round of data||[]) await admin.rpc('settle_roulette_round',{p_round_id:round.id});
}

Deno.serve(async request => {
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  try {
    const user=await userFrom(request); if(!user) return fail('AUTH_REQUIRED','로그인이 필요합니다.',401);
    await settleDue();
    const url=new URL(request.url), marker='/game-api', path=url.pathname.slice(url.pathname.indexOf(marker)+marker.length)||'/';
    if(request.method==='GET'&&path==='/wallet') {
      await admin.from('game_wallets').upsert({user_id:user.id},{onConflict:'user_id',ignoreDuplicates:true});
      const {data,error}=await admin.from('game_wallets').select('balance,updated_at').eq('user_id',user.id).single(); if(error) throw error; return ok(data);
    }
    if(request.method==='GET'&&path==='/games/roulette/round/current') {
      const roundId=url.searchParams.get('roundId');
      if(!roundId) return ok(publicRound(await ensureRound()));
      const {data,error}=await admin.from('roulette_rounds').select('*').eq('id',roundId).single();
      if(error) return fail('ROUND_NOT_FOUND','라운드를 찾을 수 없습니다.',404);
      return ok(publicRound(data));
    }
    if(request.method==='GET'&&path==='/games/roulette/history') {
      const limit=Math.min(50,Math.max(1,Number(url.searchParams.get('limit'))||20));
      const {data,error}=await admin.from('roulette_rounds').select('id,result,starts_at').lte('betting_closes_at',new Date().toISOString()).order('starts_at',{ascending:false}).limit(limit); if(error) throw error; return ok((data||[]).map(r=>({roundId:r.id,result:r.result,startsAt:r.starts_at})));
    }
    if(request.method==='POST'&&path==='/games/roulette/bets') {
      const body=await request.json(), requestId=request.headers.get('Idempotency-Key')||body.requestId;
      if(!requestId||requestId!==body.requestId) return fail('INVALID_REQUEST_ID','요청 식별자가 올바르지 않습니다.');
      const round=await ensureRound(), bets=Array.isArray(body.bets)?body.bets:(body.bet?[{...body.bet,amount:body.amount}]:[]);
      const {data,error}=await admin.rpc('place_roulette_bets',{p_user_id:user.id,p_round_id:round.id,p_request_id:requestId,p_bets:bets});
      if(error) { const code=['BETTING_CLOSED','INSUFFICIENT_BALANCE','BET_LIMIT_EXCEEDED','INVALID_AMOUNT','INVALID_BETS','INVALID_BET','INVALID_BET_VALUE'].find(c=>error.message.includes(c))||'BET_FAILED'; return fail(code,code==='INSUFFICIENT_BALANCE'?'게임머니가 부족합니다.':code==='BETTING_CLOSED'?'현재 라운드의 베팅이 마감되었습니다.':code==='BET_LIMIT_EXCEEDED'?'한 라운드의 베팅 한도를 초과했습니다.':'베팅 요청이 올바르지 않습니다.',code==='INSUFFICIENT_BALANCE'?409:400); }
      return ok({slipId:data.slipId,balance:data.balance,totalAmount:data.totalAmount,duplicate:data.duplicate,round:publicRound(round)},201);
    }
    return fail('NOT_FOUND','지원하지 않는 게임 API 경로입니다.',404);
  } catch(error) { console.error(error); return fail('SERVER_ERROR','게임 서버에서 요청을 처리하지 못했습니다.',500); }
});
