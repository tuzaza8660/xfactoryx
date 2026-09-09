const $ = id => document.getElementById(id);
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const CHIP_VALUES = [1,2,5,10,20];
const MAX_BET = 20;

let balance = 100;
let bet = 0;
let shoe = [];
let player = [];
let dealer = [];
let phase = 'betting';

function randomIndex(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value); while (value[0] >= limit);
  return value[0] % max;
}

function freshShoe() {
  const cards = [];
  for (let deck=0; deck<6; deck++) for (const suit of SUITS) for (const rank of RANKS) cards.push({rank,suit});
  for (let i=cards.length-1; i>0; i--) { const j=randomIndex(i+1); [cards[i],cards[j]]=[cards[j],cards[i]]; }
  return cards;
}

function draw() { if (shoe.length < 78) shoe=freshShoe(); return shoe.pop(); }
function cardValue(rank) { if (rank==='A') return 11; if (['J','Q','K'].includes(rank)) return 10; return Number(rank); }
function handValue(hand) {
  let total=hand.reduce((sum,card)=>sum+cardValue(card.rank),0), aces=hand.filter(card=>card.rank==='A').length;
  while(total>21&&aces){total-=10;aces--;}
  return {total,soft:aces>0};
}
function isBlackjack(hand) { return hand.length===2&&handValue(hand).total===21; }
function cardHTML(card,hidden=false,index=0) {
  if(hidden)return '<div class="card back" aria-label="Hidden card"></div>';
  const red=card.suit==='♥'||card.suit==='♦';
  return `<div class="card${red?' red':''}" style="--tilt:${(index-(player.length-1)/2)*1.4}deg" aria-label="${card.rank} ${card.suit}"><span class="corner">${card.rank}<small>${card.suit}</small></span><span class="suit">${card.suit}</span></div>`;
}
function setStatus(title,detail='',tone='') { $('status').className=`status${tone?` ${tone}`:''}`;$('status').innerHTML=`<strong>${title}</strong><span>${detail}</span>`; }
function render(revealDealer=false) {
  $('balance').textContent=balance.toLocaleString('en-US');$('betValue').textContent=bet;$('betSpot').classList.toggle('active',bet>0);
  $('playerCards').innerHTML=player.map((card,index)=>cardHTML(card,false,index)).join('');
  $('dealerCards').innerHTML=dealer.map((card,index)=>cardHTML(card,!revealDealer&&index===1,index)).join('');
  $('playerScore').textContent=player.length?handValue(player).total:'—';
  $('dealerScore').textContent=dealer.length?(revealDealer?handValue(dealer).total:cardValue(dealer[0].rank)):'—';
  $('betActions').hidden=phase!=='betting';$('playActions').hidden=phase!=='playing';$('nextRound').hidden=phase!=='settled';$('chips').style.visibility=phase==='betting'?'visible':'hidden';
  $('double').disabled=player.length!==2||balance<bet;
}

function addBet(amount) {
  if(phase!=='betting')return;
  if(bet+amount>MAX_BET){setStatus('MAX BET 20','CLEAR OR DEAL THE CURRENT BET','lose');return;}
  if(bet+amount>balance){setStatus('NOT ENOUGH DP','CHOOSE A SMALLER BET','lose');return;}
  bet+=amount;setStatus('PLACE YOUR BET',`TOTAL ${bet} DP`);render();
}
function clearBet(){if(phase!=='betting')return;bet=0;setStatus('PLACE YOUR BET','SELECT A CHIP TO BEGIN');render();}

function deal() {
  if(!bet){setStatus('PLACE YOUR BET','SELECT A CHIP FIRST','lose');return;}
  balance-=bet;player=[draw(),draw()];dealer=[draw(),draw()];phase='playing';render(false);
  const playerBJ=isBlackjack(player),dealerBJ=isBlackjack(dealer);
  if(playerBJ||dealerBJ){if(playerBJ&&dealerBJ)settle('push');else if(playerBJ)settle('blackjack');else settle('lose');return;}
  setStatus('YOUR MOVE','HIT · STAND · DOUBLE');
}

function hit(){if(phase!=='playing')return;player.push(draw());render(false);const total=handValue(player).total;if(total>21)settle('bust');else if(total===21)stand();else setStatus('YOUR MOVE',`${total} · HIT OR STAND`);}
function stand(){if(phase!=='playing')return;setStatus('DEALER PLAYS','STANDS ON ALL 17');while(true){const value=handValue(dealer);if(value.total>=17)break;dealer.push(draw());}const p=handValue(player).total,d=handValue(dealer).total;if(d>21||p>d)settle('win');else if(p===d)settle('push');else settle('lose');}
function doubleDown(){if(phase!=='playing'||player.length!==2||balance<bet)return;balance-=bet;bet*=2;player.push(draw());render(false);if(handValue(player).total>21)settle('bust');else stand();}

function settle(result) {
  phase='settled';let returned=0,title='',detail='',tone='';
  if(result==='blackjack'){returned=bet*2.5;title=`BLACKJACK · WIN ${returned-bet}`;detail='PAID 3 TO 2';tone='win';}
  else if(result==='win'){returned=bet*2;title=`YOU WIN ${bet}`;detail='PAID 1 TO 1';tone='win';}
  else if(result==='push'){returned=bet;title='PUSH';detail='BET RETURNED';}
  else{title=result==='bust'?'BUST':'DEALER WINS';detail=`LOST ${bet} DP`;tone='lose';}
  balance+=returned;setStatus(title,detail,tone);render(true);
}

function newHand(){bet=0;player=[];dealer=[];phase='betting';setStatus('PLACE YOUR BET','SELECT A CHIP TO BEGIN');render();}

$('chips').addEventListener('click',event=>{const button=event.target.closest('[data-chip]');if(button)addBet(Number(button.dataset.chip));});
$('clearBet').addEventListener('click',clearBet);$('deal').addEventListener('click',deal);$('hit').addEventListener('click',hit);$('stand').addEventListener('click',stand);$('double').addEventListener('click',doubleDown);$('nextRound').addEventListener('click',newHand);
shoe=freshShoe();render();
