const $=id=>document.getElementById(id);
const SYMBOLS=[
  {id:'cherry',label:'●●',weight:28},{id:'bell',label:'●',weight:23},{id:'gem',label:'◆',weight:18},
  {id:'crown',label:'♛',weight:14},{id:'bar',label:'BAR',weight:10},{id:'seven',label:'7',weight:5},{id:'wild',label:'W',weight:2}
];
const PAY={cherry:[0,0,.8,2,5],bell:[0,0,1,3,8],gem:[0,0,1.5,4,10],crown:[0,0,2,6,15],bar:[0,0,3,8,20],seven:[0,0,4,10,30],wild:[0,0,5,20,50]};
const LINES=[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0]];
let balance=100,bet=5,spinning=false,board=[];

function pick(){let roll=Math.random()*100;for(const symbol of SYMBOLS){roll-=symbol.weight;if(roll<0)return symbol.id;}return 'cherry';}
function makeBoard(){return Array.from({length:3},()=>Array.from({length:5},pick));}
function symbolHTML(id,index){const symbol=SYMBOLS.find(item=>item.id===id);return `<div class="symbol ${id}" data-index="${index}"><span>${symbol.label}</span><small>${id==='wild'?'WILD':id.toUpperCase()}</small></div>`;}
function draw(next,winning=new Set()){board=next;$('reels').innerHTML=Array.from({length:5},(_,c)=>board.map((row,r)=>symbolHTML(row[c],r*5+c)).join('')).join('');winning.forEach(index=>$('reels').querySelector(`[data-index="${index}"]`)?.classList.add('winner'));}
function evaluate(){let multiplier=0;const winning=new Set();for(const rows of LINES){const ids=rows.map((row,col)=>board[row][col]);const target=ids.find(id=>id!=='wild')||'wild';let count=0;for(const id of ids){if(id===target||id==='wild')count++;else break;}if(count<3)continue;multiplier+=PAY[target][count-1];for(let col=0;col<count;col++)winning.add(rows[col]*5+col);}return{win:Math.round(bet*multiplier),lines:winning.size?LINES.filter(rows=>{const ids=rows.map((row,col)=>board[row][col]),target=ids.find(id=>id!=='wild')||'wild';let count=0;for(const id of ids){if(id===target||id==='wild')count++;else break;}return count>=3;}).length:0,winning};}
function setResult(title,detail,tone=''){$('result').className=`result ${tone}`;$('result').innerHTML=`<strong>${title}</strong><span>${detail}</span>`;}
function renderWallet(){$('balance').textContent=balance;$('bet').textContent=bet;$('spin').disabled=spinning||balance<bet;}
function chooseBet(value){if(spinning)return;bet=value;document.querySelectorAll('[data-bet]').forEach(button=>button.classList.toggle('active',Number(button.dataset.bet)===bet));renderWallet();setResult(balance<bet?'NOT ENOUGH DP':'PLACE YOUR BET',balance<bet?'SELECT A LOWER BET':'10 FIXED PAYLINES',balance<bet?'lose':'');}
async function spin(){if(spinning||balance<bet)return;spinning=true;balance-=bet;renderWallet();setResult('GOOD LUCK','REELS IN MOTION','busy');$('reels').classList.add('spinning');for(let tick=0;tick<12;tick++){draw(makeBoard());await new Promise(resolve=>setTimeout(resolve,55+tick*8));}const finalBoard=makeBoard();draw(finalBoard);$('reels').classList.remove('spinning');const outcome=evaluate();draw(finalBoard,outcome.winning);if(outcome.win){balance+=outcome.win;setResult(`WIN ${outcome.win} DP`,`${outcome.lines} WINNING LINE${outcome.lines===1?'':'S'}`,'win');}else setResult('NO WIN','TRY THE NEXT SPIN','lose');spinning=false;renderWallet();}

$('betSelect').addEventListener('click',event=>{const button=event.target.closest('[data-bet]');if(button)chooseBet(Number(button.dataset.bet));});
$('spin').addEventListener('click',spin);
document.addEventListener('keydown',event=>{if(event.code==='Space'&&!event.repeat){event.preventDefault();spin();}});
draw(makeBoard());renderWallet();
