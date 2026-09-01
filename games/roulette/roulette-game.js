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
    if (won) { const multiplier = activeRound.bet.type === 'number' ? 36 : 2; const payout = activeRound.amount * multiplier; demoBalance += payout; setMessage(`당첨! ${formatPoints(payout)} 데모 포인트를 받았습니다.`); }
    else setMessage('아쉽네요. 다음 라운드에 다시 도전하세요.');
    $('walletBalance').textContent = formatPoints(demoBalance);
  } else if (liveMode) {
    setMessage('서버 판정과 재생이 일치했습니다.');
    refreshWallet();
  }
}

function selectedBetPayload() {
  const number = $('numberBet').value;
  if (number !== '') {
    const value = Number(number);
    if (!Number.isInteger(value) || value < 0 || value > 36) return null;
    return { type:'number', value };
  }
  return selectedBet ? { type:selectedBet } : null;
}

async function startSpin() {
  const bet = selectedBetPayload();
  if (!bet) { setMessage('베팅 종류나 단일 번호를 선택하세요.', true); return; }
  if (!liveMode && demoBalance < betAmount) { setMessage('데모 포인트가 부족합니다.', true); return; }
  setBusy(true); $('resultPill').innerHTML = '<span>SPINNING</span><b>•••</b>'; expectedServerResult = null;
  try {
    if (liveMode) {
      const response = await placeBet(GAME_IDS.ROULETTE, { bet, amount:betAmount });
      const round = response.round || response;
      if (round.seed === undefined || round.result === undefined) throw new Error('서버 스핀 응답 형식이 올바르지 않습니다.');
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
    liveMode = true; $('modeBanner').className = 'mode-banner live'; $('modeBanner').innerHTML = '<b>SERVER LIVE</b><span>서버 판정과 지갑이 연결되었습니다</span>';
    $('connectionDot').className = 'connection online'; $('connectionLabel').textContent = '게임 서버 연결됨'; $('walletLabel').textContent = '게임머니'; $('walletBalance').textContent = formatPoints(wallet.balance); $('spinHint').textContent = '서버에서 결과 확정';
    $('roundId').textContent = round.roundId || round.id || 'READY';
    if (Array.isArray(history)) { $('history').innerHTML = ''; history.slice(0,8).forEach(item => addHistory(item.result)); }
  } catch {
    liveMode = false; $('connectionDot').className = 'connection offline'; $('connectionLabel').textContent = '로컬 데모'; $('spinHint').textContent = currentUser ? '게임 API 연결 전' : '로그인 없이 체험';
  }
}

$('betOptions').addEventListener('click', event => { const button=event.target.closest('[data-bet]');if(!button)return;selectedBet=button.dataset.bet;$('numberBet').value='';[...$('betOptions').children].forEach(node=>node.classList.toggle('selected',node===button));setMessage(`${button.textContent.trim()} 베팅을 선택했습니다.`); });
$('numberBet').addEventListener('input', () => { selectedBet=null;[...$('betOptions').children].forEach(node=>node.classList.remove('selected'));const value=Number($('numberBet').value);if($('numberBet').value!==''&&(value<0||value>36))setMessage('번호는 0부터 36까지 입력하세요.',true);else setMessage($('numberBet').value===''?'베팅 종류를 선택하세요.':`${value}번 단일 베팅을 선택했습니다.`); });
$('amountOptions').addEventListener('click', event => { const button=event.target.closest('[data-amount]');if(!button)return;betAmount=Number(button.dataset.amount);[...$('amountOptions').children].forEach(node=>node.classList.toggle('active',node===button));$('betAmountLabel').textContent=formatPoints(betAmount); });
$('clearBet').addEventListener('click',()=>{selectedBet=null;$('numberBet').value='';[...$('betOptions').children].forEach(node=>node.classList.remove('selected'));setMessage('베팅 종류를 선택하세요.');});
$('spinButton').addEventListener('click',startSpin);

authService.onAuthChange(session => { currentUser=session?.user||null;$('userLabel').textContent=currentUser?.email||'게스트';connectGameApi(); });
renderer.draw(physics.snapshot()); player.start(); connectGameApi();
