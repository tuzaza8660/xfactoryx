export const FIXED_STEP=1/120;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const SEGMENTS=[[72,115,45,720],[45,720,170,835],[170,835,235,800],[365,800,430,835],[430,835,505,720],[505,720,505,165],[505,165,470,95],[470,85,130,85],[130,85,72,115],[515,835,565,835],[565,835,565,150],[565,150,510,95],[510,95,470,85]];
export const BUMPERS=[{x:205,y:285,r:39,value:100},{x:395,y:285,r:39,value:100},{x:300,y:425,r:44,value:250}];
export const POSTS=[{x:145,y:570,r:13},{x:455,y:570,r:13},{x:190,y:680,r:11},{x:410,y:680,r:11}];

function collideCircle(ball,cx,cy,r,bounce=1.05){const dx=ball.x-cx,dy=ball.y-cy,d=Math.hypot(dx,dy),min=r+ball.r;if(!d||d>=min)return false;const nx=dx/d,ny=dy/d,over=min-d;ball.x+=nx*over;ball.y+=ny*over;const dot=ball.vx*nx+ball.vy*ny;if(dot<0){ball.vx-=dot*(1+bounce)*nx;ball.vy-=dot*(1+bounce)*ny;}return true;}
function collideSegment(ball,s,bounce=.72,kickX=0,kickY=0){const [ax,ay,bx,by]=s,dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy,t=clamp(((ball.x-ax)*dx+(ball.y-ay)*dy)/l2,0,1),cx=ax+t*dx,cy=ay+t*dy,px=ball.x-cx,py=ball.y-cy,d=Math.hypot(px,py),min=ball.r+3;if(!d||d>=min)return false;const nx=px/d,ny=py/d;ball.x=cx+nx*min;ball.y=cy+ny*min;const dot=ball.vx*nx+ball.vy*ny;if(dot<0){ball.vx-=dot*(1+bounce)*nx;ball.vy-=dot*(1+bounce)*ny;ball.vx+=kickX;ball.vy+=kickY;}return true;}

export class PinballPhysics{
  constructor(){this.best=Number(localStorage.getItem('xfactoryx-pinball-best')||0);this.newGame();}
  newGame(){this.score=0;this.balls=3;this.gameOver=false;this.left=false;this.right=false;this.leftAngle=.34;this.rightAngle=Math.PI-.34;this.events=[];this.serve();}
  serve(){this.ball={x:540,y:795,vx:0,vy:0,r:9,ready:true,alive:true};this.status='ready';}
  launch(){if(this.gameOver){this.newGame();return true;}if(!this.ball.ready)return false;this.ball.ready=false;this.ball.vy=-930;this.ball.vx=-8;this.status='playing';return true;}
  setInput(left,right){this.left=left;this.right=right;}
  addScore(points){this.score+=points;if(this.score>this.best){this.best=this.score;localStorage.setItem('xfactoryx-pinball-best',String(this.best));}this.events.push({type:'score',points});}
  flipper(left){const pivot=left?{x:205,y:778}:{x:395,y:778},angle=left?this.leftAngle:this.rightAngle,length=92;return[pivot.x,pivot.y,pivot.x+Math.cos(angle)*length,pivot.y+Math.sin(angle)*length];}
  step(dt=FIXED_STEP){this.events=[];const targetL=this.left?-.48:.34,targetR=this.right?Math.PI+.48:Math.PI-.34;this.leftAngle+=(targetL-this.leftAngle)*Math.min(1,28*dt);this.rightAngle+=(targetR-this.rightAngle)*Math.min(1,28*dt);const b=this.ball;if(!b||b.ready||this.gameOver)return this.snapshot();b.vy+=570*dt;b.vx*=Math.exp(-.045*dt);b.vy*=Math.exp(-.022*dt);b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.y<105&&b.x>475){b.vx-=230;b.vy=Math.abs(b.vy)*.24;}for(const s of SEGMENTS)collideSegment(b,s);BUMPERS.forEach((p,i)=>{if(collideCircle(b,p.x,p.y,p.r,1.28)){const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy)||1;b.vx+=dx/d*260;b.vy+=dy/d*260;this.addScore(p.value);this.events.push({type:'bumper',index:i});}});POSTS.forEach(p=>collideCircle(b,p.x,p.y,p.r,.92));const lf=this.flipper(true),rf=this.flipper(false);if(collideSegment(b,lf,.88,this.left?55:0,this.left?-300:0)&&this.left)this.addScore(10);if(collideSegment(b,rf,.88,this.right?-55:0,this.right?-300:0)&&this.right)this.addScore(10);if(b.y>920){this.balls--;this.events.push({type:'drain'});if(this.balls<=0){this.gameOver=true;this.status='gameover';b.alive=false;}else this.serve();}return this.snapshot();}
  snapshot(){return{ball:this.ball,score:this.score,best:this.best,balls:this.balls,status:this.status,gameOver:this.gameOver,leftAngle:this.leftAngle,rightAngle:this.rightAngle,bumpers:BUMPERS,posts:POSTS,segments:SEGMENTS,events:this.events};}
}
