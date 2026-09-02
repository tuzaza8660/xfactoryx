import * as authService from '../../js/services/auth-service.js';
import * as chatService from '../../js/services/chat-service.js';
import { GAME_IDS, getCurrentRound, getGameHistory, getWallet, placeBet } from '../../js/services/game-service.js';
import { watchRoomPresence } from '../../js/services/room-service.js?v=portal-rooms-1';
import { RoulettePhysics, RED_NUMBERS } from './prototype/roulette-physics.js';
import { RoulettePlayer } from './prototype/roulette-player.js';
import { RouletteRenderer } from './prototype/roulette-renderer.js?v=wood-themes-8';

const $ = id => document.getElementById(id);
const physics = new RoulettePhysics();
const roomParam = new URLSearchParams(location.search).get('room');
const LIVE_REQUESTED = roomParam !== null;
const ROOM_ID = roomParam && /^[a-z0-9][a-z0-9-]{0,31}$/.test(roomParam) ? roomParam : null;
const renderer = new RouletteRenderer($('roulette'),{theme:LIVE_REQUESTED?(ROOM_ID||'main'):'demo'});
const TABLE_RULES = {
  main:{min:1,max:20,chips:[1,2,5,10,20]},
  'vip-1':{min:10,max:200,chips:[10,20,50,100,200]},
  'vip-2':{min:20,max:500,chips:[20,50,100,200,500]}
};
const TABLE_RULE = LIVE_REQUESTED ? (TABLE_RULES[ROOM_ID]||TABLE_RULES.main) : TABLE_RULES.main;
const CHAT_ROOM = `roulette:${LIVE_REQUESTED?(ROOM_ID||'invalid'):'demo'}`;
const CHAT_TABLE_NAMES = {demo:'DEMO',main:'MAIN','vip-1':'VIP 1','vip-2':'VIP 2'};
const MAX_BET_POSITIONS = 20;
const placedBets = new Map();
const betActions = [];
let betAmount = TABLE_RULE.chips[2];
let demoBalance = 10000;
let liveMode = false;
let expectedServerResult = null;
let activeRound = null;
let currentUser = null;
let liveWatcherToken = 0;
let liveBetSubmitted = false;
let serverOffsetMs = 0;
let lastPlayedRoundId = null;
let displayedResultRoundId = null;
let currentPlaybackRoundId = null;
let currentRoundPayout = 0;
let liveResultReady = false;
let liveBetRejected = false;
let leaveRoomPresence = null;
let chatProfile = null;
let stopRoomChat = null;

async function stopRoomPresence() { if(leaveRoomPresence){const leave=leaveRoomPresence;leaveRoomPresence=null;await leave();} }
async function startRoomPresence(user) {
  await stopRoomPresence();
  $('roomPresence').textContent=`${ROOM_ID.toUpperCase()} · CONNECTING`;
  leaveRoomPresence=watchRoomPresence({gameId:GAME_IDS.ROULETTE,roomId:ROOM_ID,user,onChange:({count})=>{$('roomPresence').textContent=`${ROOM_ID.toUpperCase()} · ${count} ONLINE`;}});
}

const escapeChat = value => { const node=document.createElement('span');node.textContent=value??'';return node.innerHTML; };
const chatInitial = value => (value||'P').trim().slice(0,1).toUpperCase();
function roomChatMessageHTML(message) {
  const mine=currentUser?.id===message.user_id,color=['purple','mint','orange','blue'].includes(message.avatar_color)?message.avatar_color:'purple';
  return `<div class="roulette-chat-message${mine?' mine':''}" data-id="${message.id}"><span class="chat-avatar ${color}">${escapeChat(chatInitial(message.nickname))}</span><div><p><b>${escapeChat(message.nickname||'PLAYER')}</b><time>${new Date(message.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</time>${mine?'<button class="roulette-chat-delete">DELETE</button>':''}</p><span>${escapeChat(message.content)}</span></div></div>`;
}
async function renderRoomChat() {
  try { const rows=await chatService.listMessages(CHAT_ROOM),node=$('rouletteChatMessages');node.innerHTML=rows.map(roomChatMessageHTML).join('');node.scrollTop=node.scrollHeight; } catch {}
}
function startRoomChat() {
  stopRoomChat?.();
  stopRoomChat=chatService.subscribeToMessages(CHAT_ROOM,{onInsert:message=>{const node=$('rouletteChatMessages');if(!node.querySelector(`[data-id="${message.id}"]`))node.insertAdjacentHTML('beforeend',roomChatMessageHTML(message));node.scrollTop=node.scrollHeight;},onDelete:message=>$('rouletteChatMessages').querySelector(`[data-id="${message.id}"]`)?.remove()});
}
async function syncRoomChatUser(user) {
  currentUser=user||null;chatProfile=null;
  if(currentUser){try{chatProfile=await authService.getOrCreateProfile(currentUser)}catch{}}
  $('rouletteChatGate').hidden=Boolean(currentUser);$('rouletteChatForm').hidden=!currentUser;await renderRoomChat();
}

function buildBettingTable() {
  const grid = $('numberGrid');
  for (let number=1; number<=36; number++) {
    const button = document.createElement('button');
    button.dataset.bet = 'number'; button.dataset.value = number; button.textContent = number;
    button.className = resultColor(number);
    button.style.setProperty('--dcol',Math.ceil(number/3));
    button.style.setProperty('--drow',4-(((number-1)%3)+1));
    button.style.setProperty('--mcol',((number-1)%3)+1);
    button.style.setProperty('--mrow',Math.ceil(number/3));
    grid.append(button);
  }
}

const player = new RoulettePlayer({ physics, renderer, onFrame: updateTelemetry, onResult: settleResult });

function formatPoints(value) { return Math.max(0, Number(value) || 0).toLocaleString('ko-KR'); }
function compactPoints(value) { return value>=1000 ? `${Number((value/1000).toFixed(1))}K` : String(value); }
function showBetOutcome(text='',tone='') { const node=$('betOutcome');node.textContent=text;node.className=`bet-outcome${tone?` ${tone}`:''}`;node.hidden=!text; }
function showPayout(value = null, hasBet = true) { const visible=value!==null&&hasBet, won=Number(value)>0;showBetOutcome(visible?(won?`WIN ${formatPoints(value)}`:'LOST'):'',won?'won':'lost'); }
function setMessage(message, error = false) { $('betMessage').textContent = message; $('betMessage').style.color = error ? '#ff8f7c' : ''; }
function setBusy(busy) { $('spinButton').disabled = busy; $('betOptions').classList.toggle('locked',busy); $('amountOptions').classList.toggle('locked',busy); $('undoBet').disabled=busy; $('clearBet').disabled=busy; $('roundStatus').textContent = busy ? '스핀 진행중' : '베팅 접수중'; }
function resultColor(number) { if(String(number)==='0') return 'green'; return RED_NUMBERS.has(String(number)) ? 'red' : 'black'; }
function betKey(bet) { return `${bet.type}:${bet.value??''}`; }
function totalStake() { return [...placedBets.values()].reduce((sum,item)=>sum+item.amount,0); }
function configureBettingRules() {
  $('betLimits').textContent=`MIN ${formatPoints(TABLE_RULE.min)} · MAX ${formatPoints(TABLE_RULE.max)}`;
  $('amountOptions').innerHTML=TABLE_RULE.chips.map(amount=>`<button data-amount="${amount}"${amount===betAmount?' class="active"':''}>${compactPoints(amount)}</button>`).join('');
  $('betAmountLabel').textContent=formatPoints(betAmount);
}
function renderPlacedChip(key) {
  const item=placedBets.get(key), button=item?.button;
  if (!button) return;
  button.querySelector('.placed-chip')?.remove();
  if (!item.amount) return;
  const chip=document.createElement('span'); chip.className=`placed-chip chip-${item.chips.at(-1)}`; chip.textContent=compactPoints(item.amount); button.append(chip);
}
function addChip(button) {
  if(!liveMode)$('statusHeadline').textContent='PLACE YOUR BETS';
  const bet={type:button.dataset.bet}; if(button.dataset.value!==undefined)bet.value=Number(button.dataset.value);
  const key=betKey(bet); if(!placedBets.has(key)&&placedBets.size>=MAX_BET_POSITIONS){setMessage(`한 라운드에는 최대 ${MAX_BET_POSITIONS}곳까지 베팅할 수 있습니다.`,true);return;}
  if(totalStake()+betAmount>TABLE_RULE.max){setMessage(`이 테이블의 최대 베팅은 ${formatPoints(TABLE_RULE.max)}입니다.`,true);return;}
  const current=placedBets.get(key)||{...bet,amount:0,button,chips:[]}; current.amount+=betAmount; current.chips.push(betAmount);
  placedBets.set(key,current); betActions.push({key,amount:betAmount}); renderPlacedChip(key);
  setMessage(`${placedBets.size}곳 · 총 ${formatPoints(totalStake())}`);
}
function clearPlacedBets() {
  placedBets.forEach((_,key)=>{const item=placedBets.get(key);item?.button?.querySelector('.placed-chip')?.remove();}); placedBets.clear(); betActions.length=0; setMessage('칩을 올려주세요.');
}
function undoLastChip() {
  const action=betActions.pop(); if(!action)return; const item=placedBets.get(action.key); if(!item)return;
  item.amount-=action.amount; item.chips.pop(); if(item.amount<=0){item.button.querySelector('.placed-chip')?.remove();placedBets.delete(action.key);}else renderPlacedChip(action.key);
  setMessage(placedBets.size?`${placedBets.size}곳 · 총 ${formatPoints(totalStake())}`:'칩을 올려주세요.');
}

function updateTelemetry(state) {
  $('wheelSpeed').textContent = `${state.wheel.v.toFixed(2)} rad/s`;
  $('ballSpeed').textContent = `${(Math.abs(state.ball.va) * state.ball.r).toFixed(0)} px/s`;
}

function betWins(bet, result) {
  const n = Number(result); if (!bet) return false;
  if (bet.type === 'number') return n === bet.value;
  if (n === 0) return false;
  if (bet.type === 'red' || bet.type === 'black') return resultColor(n) === bet.type;
  if (bet.type === 'odd') return n % 2 === 1;
  if (bet.type === 'even') return n % 2 === 0;
  if (bet.type === 'low') return n >= 1 && n <= 18;
  if (bet.type === 'high') return n >= 19 && n <= 36;
  if (bet.type === 'dozen') return Math.ceil(n / 12) === bet.value;
  if (bet.type === 'column') return ((n - 1) % 3) + 1 === bet.value;
  return false;
}

function addHistory(result, roundId = null) {
  if(roundId&&$('history').querySelector(`[data-round-id="${roundId}"]`))return;
  const chip = document.createElement('i'); chip.textContent = result; chip.className = resultColor(result);
  if(roundId)chip.dataset.roundId=roundId;
  $('history').prepend(chip); while ($('history').children.length > 8) $('history').lastElementChild.remove();
}

function settleResult(state) {
  const liveRoundId=currentPlaybackRoundId||activeRound?.roundId||activeRound?.id;
  if(liveMode&&!liveResultReady)return;
  if(liveMode&&liveRoundId&&displayedResultRoundId===liveRoundId)return;
  if(liveMode&&liveRoundId)displayedResultRoundId=liveRoundId;
  const displayedResult = liveMode && expectedServerResult !== null ? String(expectedServerResult) : state.result;
  $('resultPill').innerHTML = `<span>RESULT</span><b>${displayedResult}</b>`;
  $('statusHeadline').textContent=`${displayedResult} - ${resultColor(displayedResult).toUpperCase()}`; if(liveMode&&liveBetRejected)showBetOutcome('BET REJECTED','rejected');else showPayout(liveMode?currentRoundPayout:0,Boolean(activeRound?.bets?.length));
  addHistory(displayedResult,liveMode?liveRoundId:null); if(!liveMode)setBusy(false);
  if (liveMode && String(state.result) !== String(expectedServerResult)) {
    setMessage('서버 결과와 물리 재생 결과가 일치하지 않습니다. 보상 처리를 중단했습니다.', true);
    return;
  }
  if (!liveMode && activeRound?.bets) {
    const payout=activeRound.bets.reduce((sum,bet)=>sum+(betWins(bet,displayedResult)?bet.amount*(bet.type==='number'?36:['dozen','column'].includes(bet.type)?3:2):0),0);
    showPayout(payout,true);
    if (payout>0) { demoBalance += payout; setMessage(`당첨! ${formatPoints(payout)} 데모 포인트`); }
    else setMessage('다음 라운드');
    $('walletBalance').textContent = formatPoints(demoBalance);
  } else if (liveMode) {
    setMessage('서버 판정과 재생이 일치했습니다.');
    clearPlacedBets(); activeRound=null;
  }
}

async function waitForRoundReveal(roundId) {
  for (let attempt=0; attempt<45; attempt++) {
    const round=await getCurrentRound(GAME_IDS.ROULETTE,roundId,ROOM_ID);
    if ((round.roundId===roundId||round.id===roundId) && round.seed!==undefined && round.result!==undefined) return round;
    $('roundStatus').textContent='베팅 마감 대기';
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw new Error('라운드 결과 공개 시간이 초과되었습니다.');
}

async function waitForNextRound(completedRoundId, token) {
  while(liveMode&&token===liveWatcherToken) {
    const next=await getCurrentRound(GAME_IDS.ROULETTE,'',ROOM_ID); syncServerClock(next);
    if((next.roundId||next.id)!==completedRoundId)return next;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  return null;
}

function serverNow() { return Date.now()+serverOffsetMs; }
function syncServerClock(round) { if(round?.serverNow)serverOffsetMs=new Date(round.serverNow).getTime()-Date.now(); }
function updateRoundClock(round, phase='betting') {
  const clock=$('roundClock'), now=serverNow(); clock.classList.toggle('spinning',phase!=='betting');
  $('statusRound').textContent=round.roundNumber||'LIVE';
  if (phase==='closing') { const remaining=Math.max(0,new Date(round.closesAt).getTime()-now); $('roundPhase').textContent='CLOSING'; $('statusHeadline').textContent='NO MORE BETS'; $('roundTimer').textContent=`${(remaining/1000).toFixed(1)}s`; clock.style.setProperty('--progress','0%'); return; }
  if (phase==='spinning') { const end=new Date(round.settlesAt).getTime(),start=new Date(round.startsAt).getTime(),remaining=Math.max(0,end-now); $('roundPhase').textContent='SPINNING'; $('statusHeadline').textContent='NO MORE BETS'; $('roundTimer').textContent=`${(remaining/1000).toFixed(1)}s`; clock.style.setProperty('--progress',`${remaining/Math.max(1,end-start)*100}%`); return; }
  if (phase==='result') { const end=new Date(round.endsAt).getTime(),start=new Date(round.settlesAt).getTime(),remaining=Math.max(0,end-now); $('roundPhase').textContent='RESULT'; $('roundTimer').textContent=`${(remaining/1000).toFixed(1)}s`; clock.style.setProperty('--progress',`${remaining/Math.max(1,end-start)*100}%`); return; }
  const opens=new Date(round.opensAt).getTime(), autoSubmitAt=new Date(round.closesAt).getTime()-2000;
  const remaining=Math.max(0,autoSubmitAt-now), duration=Math.max(1,autoSubmitAt-opens), progress=Math.max(0,Math.min(100,remaining/duration*100));
  $('roundPhase').textContent='BETTING'; $('statusHeadline').textContent='PLACE YOUR BETS'; $('roundTimer').textContent=`${(remaining/1000).toFixed(1)}s`; clock.style.setProperty('--progress',`${progress}%`);
}

async function runLiveTable(initialRound) {
  const token=++liveWatcherToken; let round=initialRound;
  while(liveMode&&token===liveWatcherToken) {
    syncServerClock(round); liveBetSubmitted=false; liveBetRejected=false; liveResultReady=false; currentRoundPayout=0; activeRound=null; currentPlaybackRoundId=null; showPayout(); clearPlacedBets();
    $('spinButton').querySelector('b').textContent='BET'; $('spinHint').textContent='베팅 확정';
    $('roundId').textContent=round.roundId||round.id||'LIVE';
    $('statusRound').textContent=round.roundNumber||'LIVE';
    const closesAt=new Date(round.closesAt).getTime(), autoSubmitAt=closesAt-2000, startsAt=new Date(round.startsAt).getTime(), settlesAt=new Date(round.settlesAt).getTime(), endsAt=new Date(round.endsAt).getTime();
    if(serverNow()<closesAt) setBusy(false); else setBusy(true);
    while(liveMode&&token===liveWatcherToken&&serverNow()<autoSubmitAt) { updateRoundClock(round); await new Promise(resolve=>setTimeout(resolve,200)); }
    if(!liveMode||token!==liveWatcherToken)return;
    setBusy(true);
    if(placedBets.size&&!liveBetSubmitted) await startSpin(); else setMessage('베팅 없음'); setBusy(true);
    while(liveMode&&token===liveWatcherToken&&serverNow()<closesAt) { updateRoundClock(round,'closing'); await new Promise(resolve=>setTimeout(resolve,100)); }
    if(!liveMode||token!==liveWatcherToken)return;
    setBusy(true); updateRoundClock(round,'spinning'); setMessage(liveBetSubmitted?'베팅 마감 · 결과 확인 중':'자동 스핀');
    try {
      const revealed=round.seed!==undefined?round:await waitForRoundReveal(round.roundId||round.id); syncServerClock(revealed); expectedServerResult=String(revealed.result); activeRound=activeRound?{...activeRound,...revealed}:{...revealed,bets:[]};
      const playingRoundId=revealed.roundId||revealed.id;
      if(lastPlayedRoundId===playingRoundId) { round=await waitForNextRound(playingRoundId,token); if(!round)return; continue; }
      lastPlayedRoundId=playingRoundId; currentPlaybackRoundId=playingRoundId;
      $('seed').textContent=Number(revealed.seed).toString(16).padStart(8,'0').toUpperCase();
      player.spinAt(Number(revealed.seed),Math.max(0,(serverNow()-startsAt)/1000));
      while(physics.running&&liveMode&&token===liveWatcherToken) { updateRoundClock(round,'spinning'); await new Promise(resolve=>setTimeout(resolve,200)); }
      while(liveMode&&token===liveWatcherToken&&serverNow()<settlesAt) { updateRoundClock(round,'spinning'); await new Promise(resolve=>setTimeout(resolve,200)); }
      if(liveMode&&token===liveWatcherToken) { const settled=await getCurrentRound(GAME_IDS.ROULETTE,playingRoundId,ROOM_ID); syncServerClock(settled); currentRoundPayout=Number(settled.payout||0); activeRound={...(activeRound||{}),...settled}; liveResultReady=true; settleResult(physics.snapshot()); await refreshWallet(); }
      while(liveMode&&token===liveWatcherToken&&serverNow()<endsAt) { updateRoundClock(round,'result'); await new Promise(resolve=>setTimeout(resolve,200)); }
      round=await waitForNextRound(playingRoundId,token); if(!round)return;
    } catch(error) { setMessage(error.message||'라운드 연결을 다시 시도합니다.',true); await new Promise(resolve=>setTimeout(resolve,1500)); round=await getCurrentRound(GAME_IDS.ROULETTE,'',ROOM_ID); }
  }
}

async function startSpin() {
  const bets=[...placedBets.values()].map(({type,value,amount})=>({type,...(value===undefined?{}:{value}),amount}));
  const stake=totalStake();
  if (!bets.length) { setMessage('베팅판에 칩을 올려주세요.', true); return; }
  if (stake>TABLE_RULE.max||bets.some(bet=>bet.amount<TABLE_RULE.min)) { setMessage(`베팅 한도는 MIN ${formatPoints(TABLE_RULE.min)} · MAX ${formatPoints(TABLE_RULE.max)}입니다.`, true); return; }
  if (!liveMode && demoBalance < stake) { setMessage('데모 포인트가 부족합니다.', true); return; }
  setBusy(true); showPayout(); $('resultPill').innerHTML = '<span>SPINNING</span><b>•••</b>'; if(!liveMode)$('statusHeadline').textContent='NO MORE BETS'; expectedServerResult = null;
  try {
    if (liveMode) {
      if(liveBetSubmitted) throw new Error('이번 라운드의 베팅은 이미 확정했습니다.');
      const response = await placeBet(GAME_IDS.ROULETTE, { roomId:ROOM_ID, bets });
      const round = response.round || response;
      liveBetRejected=false; showBetOutcome('BET ACCEPTED','accepted');
      $('walletBalance').textContent=formatPoints(response.balance);
      $('roundId').textContent=round.roundId || round.id || 'LIVE';
      activeRound = { ...round, bets }; liveBetSubmitted=true;
      setMessage(`베팅 확정 · ${bets.length}곳 · ${formatPoints(stake)}`);
    } else {
      demoBalance -= stake; $('walletBalance').textContent = formatPoints(demoBalance);
      const state = player.spin(); activeRound = { seed:state.seed, bets };
      $('roundId').textContent = `DEMO-${String(state.seed).slice(-5)}`; $('seed').textContent = state.seed.toString(16).padStart(8,'0').toUpperCase();
    }
  } catch(error) { if(liveMode){liveBetRejected=true;showBetOutcome('BET REJECTED','rejected');} setBusy(false); setMessage(error.message || '스핀 요청을 처리하지 못했습니다.', true); }
}

async function refreshWallet() {
  if (!liveMode) return;
  try { const wallet = await getWallet(); $('walletBalance').textContent = formatPoints(wallet.balance); }
  catch { setMessage('지갑 정보를 불러오지 못했습니다.', true); }
}

async function connectGameApi() {
  await stopRoomPresence(); liveWatcherToken++;
  if(!LIVE_REQUESTED){liveMode=false;document.body.classList.remove('live-table');$('roundClock').classList.remove('live-clock');showPayout();$('roomPresence').textContent='DEMO · LOCAL';$('statusRound').textContent='DEMO';$('statusHeadline').textContent='PLACE YOUR BETS';$('roundTimer').textContent='';setBusy(false);return;}
  document.body.classList.add('live-table'); $('roundClock').classList.add('live-clock'); setBusy(true); liveMode=false;
  if(!ROOM_ID){$('roomPresence').textContent='INVALID TABLE';$('statusRound').textContent='LIVE';$('statusHeadline').textContent='TABLE UNAVAILABLE';$('roundTimer').textContent='';return;}
  try {
    const session = await authService.getSession(); currentUser = session?.user || null;
    $('userLabel').textContent = currentUser?.email || '게스트';
    await syncRoomChatUser(currentUser);
    if (!currentUser){$('roomPresence').textContent=`${ROOM_ID.toUpperCase()} · WAITING`;$('statusRound').textContent=ROOM_ID.toUpperCase();$('statusHeadline').textContent='SIGN IN REQUIRED';$('roundTimer').textContent='';setMessage('Sign in from the portal to join this live table.');return;}
    const [round, wallet, history] = await Promise.all([getCurrentRound(GAME_IDS.ROULETTE,'',ROOM_ID), getWallet(), getGameHistory(GAME_IDS.ROULETTE,8,ROOM_ID)]);
    liveMode = true; document.body.classList.add('live-table'); $('roundClock').classList.add('live-clock'); $('modeBanner').className = 'mode-banner live'; $('modeBanner').innerHTML = '<b>LIVE</b><span>SERVER</span>';
    await startRoomPresence(currentUser);
    $('connectionDot').className = 'connection online'; $('connectionLabel').textContent = '게임 서버 연결됨'; $('walletLabel').textContent = '게임머니'; $('walletBalance').textContent = formatPoints(wallet.balance); $('spinHint').textContent = '서버에서 결과 확정';
    $('roundId').textContent = round.roundId || round.id || 'READY';
    if (Array.isArray(history)) { $('history').innerHTML = ''; history.slice(0,8).forEach(item => addHistory(item.result,item.roundId||item.id)); }
    runLiveTable(round);
  } catch(error) {
    await stopRoomPresence(); liveMode=false; $('roomPresence').textContent=`${ROOM_ID.toUpperCase()} · OFFLINE`; $('statusRound').textContent=ROOM_ID.toUpperCase(); $('statusHeadline').textContent='CONNECTION ERROR'; $('roundTimer').textContent=''; setMessage(error.message||'Unable to connect to the live table.',true);
  }
}

$('betOptions').addEventListener('click', event => { const button=event.target.closest('[data-bet]');if(!button||$('spinButton').disabled)return;addChip(button); });
$('amountOptions').addEventListener('click', event => { const button=event.target.closest('[data-amount]');if(!button)return;betAmount=Number(button.dataset.amount);[...$('amountOptions').children].forEach(node=>node.classList.toggle('active',node===button));$('betAmountLabel').textContent=formatPoints(betAmount); });
$('undoBet').addEventListener('click',undoLastChip);
$('clearBet').addEventListener('click',clearPlacedBets);
$('spinButton').addEventListener('click',startSpin);
$('rouletteChatOpen').addEventListener('click',()=>{$('rouletteChat').classList.add('open');$('rouletteChat').setAttribute('aria-hidden','false');});
$('rouletteChatClose').addEventListener('click',()=>{$('rouletteChat').classList.remove('open');$('rouletteChat').setAttribute('aria-hidden','true');});
$('rouletteChatForm').addEventListener('submit',async event=>{event.preventDefault();const input=$('rouletteChatInput'),content=input.value.trim();if(!content||!currentUser)return;try{await chatService.sendMessage({room:CHAT_ROOM,userId:currentUser.id,nickname:chatProfile?.nickname||currentUser.user_metadata?.nickname||currentUser.email?.split('@')[0]||'PLAYER',avatarColor:chatProfile?.avatar_color||authService.colorForUser(currentUser.id),content});input.value='';}catch{setMessage('채팅 메시지를 보내지 못했습니다.',true);}});
$('rouletteChatMessages').addEventListener('click',async event=>{const button=event.target.closest('.roulette-chat-delete');if(button&&currentUser)await chatService.deleteMessage(button.closest('.roulette-chat-message').dataset.id,currentUser.id);});

authService.onAuthChange(session => { currentUser=session?.user||null;$('userLabel').textContent=currentUser?.email||'게스트';connectGameApi(); });
$('rouletteChatTitle').textContent=`ROULETTE · ${CHAT_TABLE_NAMES[LIVE_REQUESTED?ROOM_ID:'demo']||(ROOM_ID||'TABLE').toUpperCase()}`;
buildBettingTable(); configureBettingRules(); renderer.draw(physics.snapshot()); player.start(); startRoomChat();connectGameApi();window.addEventListener('pagehide',()=>{stopRoomChat?.();});
