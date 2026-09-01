import * as authService from '../../js/services/auth-service.js';
import { GAME_IDS, getCurrentRound, getGameHistory, getWallet, placeBet } from '../../js/services/game-service.js';
import { RoulettePhysics, RED_NUMBERS } from './prototype/roulette-physics.js';
import { RoulettePlayer } from './prototype/roulette-player.js';
import { RouletteRenderer } from './prototype/roulette-renderer.js';

const $ = id => document.getElementById(id);
const physics = new RoulettePhysics();
const renderer = new RouletteRenderer($('roulette'));
let selectedBet = null;
let betAmount = 100;
let demoBalance = 10000;
let liveMode = false;
let expectedServerResult = null;
let activeRound = null;
let currentUser = null;

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
function setMessage(message, error = false) { $('betMessage').textContent = message; $('betMessage').style.color = error ? '#ff8f7c' : ''; }
function setBusy(busy) { $('spinButton').disabled = busy; $('roundStatus').textContent = busy ? '스핀 진행중' : '베팅 접수중'; }
function resultColor(number) { if(String(number)==='0') return 'green'; return RED_NUMBERS.has(String(number)) ? 'red' : 'black'; }

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

function addHistory(result) {
  const chip = document.createElement('i'); chip.textContent = result; chip.className = resultColor(result);
  $('history').prepend(chip); while ($('history').children.length > 8) $('history').lastElementChild.remove();
}

function settleResult(state) {
  const displayedResult = liveMode && expectedServerResult !== null ? String(expectedServerResult) : state.result;
  $('resultPill').innerHTML = `<span>RESULT</span><b>${displayedResult}</b>`;
  addHistory(displayedResult); setBusy(false);
  if (liveMode && String(state.result) !== String(expectedServerResult)) {
    setMessage('서버 결과와 물리 재생 결과가 일치하지 않습니다. 보상 처리를 중단했습니다.', true);
    return;
  }
  if (!liveMode && activeRound?.bet) {
    const won = betWins(activeRound.bet, displayedResult);
    if (won) { const multiplier = activeRound.bet.type === 'number' ? 36 : ['dozen','column'].includes(activeRound.bet.type) ? 3 : 2; const payout = activeRound.amount * multiplier; demoBalance += payout; setMessage(`당첨! ${formatPoints(payout)} 데모 포인트를 받았습니다.`); }
    else setMessage('아쉽네요. 다음 라운드에 다시 도전하세요.');
    $('walletBalance').textContent = formatPoints(demoBalance);
  } else if (liveMode) {
    setMessage('서버 판정과 재생이 일치했습니다.');
    refreshWallet();
  }
}

function selectedBetPayload() {
  return selectedBet;
}

async function waitForRoundReveal(roundId) {
  for (let attempt=0; attempt<45; attempt++) {
    const round=await getCurrentRound(GAME_IDS.ROULETTE,roundId);
    if ((round.roundId===roundId||round.id===roundId) && round.seed!==undefined && round.result!==undefined) return round;
    $('roundStatus').textContent='베팅 마감 대기';
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw new Error('라운드 결과 공개 시간이 초과되었습니다.');
}

async function startSpin() {
  const bet = selectedBetPayload();
  if (!bet) { setMessage('베팅 종류나 단일 번호를 선택하세요.', true); return; }
  if (!liveMode && demoBalance < betAmount) { setMessage('데모 포인트가 부족합니다.', true); return; }
  setBusy(true); $('resultPill').innerHTML = '<span>SPINNING</span><b>•••</b>'; expectedServerResult = null;
  try {
    if (liveMode) {
      const response = await placeBet(GAME_IDS.ROULETTE, { bet, amount:betAmount });
      let round = response.round || response;
      $('walletBalance').textContent=formatPoints(response.balance);
      $('roundId').textContent=round.roundId || round.id || 'LIVE';
      if (round.seed === undefined || round.result === undefined) {
        setMessage('베팅 접수 완료 · 마감 후 서버 결과를 공개합니다.');
        round=await waitForRoundReveal(round.roundId||round.id);
      }
      activeRound = { ...round, bet, amount:betAmount }; expectedServerResult = String(round.result);
      $('roundId').textContent = round.roundId || round.id || 'LIVE';
      $('seed').textContent = Number(round.seed).toString(16).padStart(8,'0').toUpperCase();
      player.spin(Number(round.seed));
    } else {
      demoBalance -= betAmount; $('walletBalance').textContent = formatPoints(demoBalance);
      const state = player.spin(); activeRound = { seed:state.seed, bet, amount:betAmount };
      $('roundId').textContent = `DEMO-${String(state.seed).slice(-5)}`; $('seed').textContent = state.seed.toString(16).padStart(8,'0').toUpperCase();
    }
  } catch(error) { setBusy(false); setMessage(error.message || '스핀 요청을 처리하지 못했습니다.', true); }
}

async function refreshWallet() {
  if (!liveMode) return;
  try { const wallet = await getWallet(); $('walletBalance').textContent = formatPoints(wallet.balance); }
  catch { setMessage('지갑 정보를 불러오지 못했습니다.', true); }
}

async function connectGameApi() {
  try {
    const session = await authService.getSession(); currentUser = session?.user || null;
    $('userLabel').textContent = currentUser?.email || '게스트';
    if (!currentUser) throw new Error('로그인 필요');
    const [round, wallet, history] = await Promise.all([getCurrentRound(GAME_IDS.ROULETTE), getWallet(), getGameHistory(GAME_IDS.ROULETTE, 8)]);
    liveMode = true; $('modeBanner').className = 'mode-banner live'; $('modeBanner').innerHTML = '<b>LIVE</b><span>SERVER</span>';
    $('connectionDot').className = 'connection online'; $('connectionLabel').textContent = '게임 서버 연결됨'; $('walletLabel').textContent = '게임머니'; $('walletBalance').textContent = formatPoints(wallet.balance); $('spinHint').textContent = '서버에서 결과 확정';
    $('roundId').textContent = round.roundId || round.id || 'READY';
    if (Array.isArray(history)) { $('history').innerHTML = ''; history.slice(0,8).forEach(item => addHistory(item.result)); }
  } catch {
    liveMode = false; $('connectionDot').className = 'connection offline'; $('connectionLabel').textContent = '로컬 데모'; $('spinHint').textContent = currentUser ? '게임 API 연결 전' : '로그인 없이 체험';
  }
}

$('betOptions').addEventListener('click', event => { const button=event.target.closest('[data-bet]');if(!button)return;selectedBet={type:button.dataset.bet};if(button.dataset.value!==undefined)selectedBet.value=Number(button.dataset.value);$('betOptions').querySelectorAll('[data-bet]').forEach(node=>node.classList.toggle('selected',node===button));setMessage(`${button.textContent.trim() || button.dataset.bet} 베팅을 선택했습니다.`); });
$('amountOptions').addEventListener('click', event => { const button=event.target.closest('[data-amount]');if(!button)return;betAmount=Number(button.dataset.amount);[...$('amountOptions').children].forEach(node=>node.classList.toggle('active',node===button));$('betAmountLabel').textContent=formatPoints(betAmount); });
$('clearBet').addEventListener('click',()=>{selectedBet=null;$('betOptions').querySelectorAll('[data-bet]').forEach(node=>node.classList.remove('selected'));setMessage('베팅 종류를 선택하세요.');});
$('spinButton').addEventListener('click',startSpin);

authService.onAuthChange(session => { currentUser=session?.user||null;$('userLabel').textContent=currentUser?.email||'게스트';connectGameApi(); });
buildBettingTable(); renderer.draw(physics.snapshot()); player.start(); connectGameApi();
