import { POCKETS, POCKET_STEP, RED_NUMBERS, TAU } from './roulette-physics.js';

export class RouletteRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.center = canvas.width / 2;
  }

  polar(radius, angle) { return [this.center + Math.cos(angle) * radius, this.center + Math.sin(angle) * radius]; }
  circle(radius, fill, stroke) { const c=this.ctx;c.beginPath();c.arc(this.center,this.center,radius,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();} }
  wheelCircle(radius, fill, stroke) { const c=this.ctx;c.beginPath();c.arc(0,0,radius,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();} }
  wheelWedge(r0,r1,a0,a1,fill) { const c=this.ctx;c.beginPath();c.arc(0,0,r1,a0,a1);c.arc(0,0,r0,a1,a0,true);c.closePath();c.fillStyle=fill;c.fill(); }

  draw(state) {
    const { ctx, center: C } = this;
    const { wheel, ball, physics } = state;
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    const bg=ctx.createRadialGradient(C,C,0,C,C,440);bg.addColorStop(0,'#211c13');bg.addColorStop(.7,'#120f0a');bg.addColorStop(1,'#050605');ctx.fillStyle=bg;ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    this.circle(415,'#b58d42');this.circle(404,'#17130d');this.circle(385,'#433219');this.circle(374,'#0d0e0d');
    this.circle(368,'#252720','#6f6344');this.circle(345,'#101511','#8b7a4a');this.circle(329,'#20231e');this.circle(275,'#10120e','#655936');
    for(let i=0;i<8;i++){const a=i*TAU/8+.09+(physics?.pinAngleOffset?.[i]||0),[x,y]=this.polar(302,a);ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/4);ctx.fillStyle='#d8c597';ctx.strokeStyle='#5c512f';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(9,0);ctx.lineTo(0,12);ctx.lineTo(-9,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
    ctx.save();ctx.translate(C,C);ctx.rotate(wheel.a);
    for(let i=0;i<POCKETS.length;i++){const a=i*POCKET_STEP,val=POCKETS[i],color=val==='0'?'#15714b':RED_NUMBERS.has(val)?'#a42422':'#171918';this.wheelWedge(205,267,a-POCKET_STEP/2+.008,a+POCKET_STEP/2-.008,color);this.wheelWedge(228,260,a-POCKET_STEP/2+.025,a+POCKET_STEP/2-.025,'#0d0e0c');}
    for(let i=0;i<POCKETS.length;i++){const a=i*POCKET_STEP,x=Math.cos(a)*246,y=Math.sin(a)*246;ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/2);ctx.fillStyle='#e8ddc1';ctx.font='bold 13px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(POCKETS[i],0,0);ctx.restore();}
    for(let i=0;i<POCKETS.length;i++){const a=(i+.5)*POCKET_STEP;ctx.strokeStyle='#c6a960';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(Math.cos(a)*205,Math.sin(a)*205);ctx.lineTo(Math.cos(a)*267,Math.sin(a)*267);ctx.stroke();}
    this.wheelCircle(202,'#7b612f','#d4b25e');this.wheelCircle(194,'#1b2119','#5e542f');this.wheelCircle(171,'#2a2013','#9b7b3d');this.wheelCircle(164,'#181b17','#4d452c');
    for(let i=0;i<12;i++){const a=i*TAU/12;ctx.save();ctx.rotate(a);ctx.fillStyle=i%2?'#302615':'#241c12';ctx.beginPath();ctx.moveTo(24,-8);ctx.lineTo(158,-3);ctx.lineTo(158,3);ctx.lineTo(24,8);ctx.closePath();ctx.fill();ctx.restore();}
    this.wheelCircle(84,'#21251f','#af9049');this.wheelCircle(75,'#373022','#756033');ctx.beginPath();ctx.arc(0,0,66,0,TAU);ctx.fillStyle='#b58d42';ctx.fill();ctx.beginPath();ctx.arc(0,0,54,0,TAU);ctx.fillStyle='#22251f';ctx.fill();this.wheelCircle(30,'#c09c50','#ead27e');this.wheelCircle(19,'#24251f');this.wheelCircle(7,'#d8c386');ctx.restore();
    const [x,y]=this.polar(ball.r,ball.a),bx=x-ball.z*.32,by=y-ball.z*.40;ctx.beginPath();ctx.ellipse(x+5,y+7,10+ball.z*.11,7+ball.z*.06,0,0,TAU);ctx.fillStyle=`rgba(0,0,0,${Math.max(.16,.55-ball.z*.012)})`;ctx.fill();const gradient=ctx.createRadialGradient(bx-4,by-5,1,bx,by,12);gradient.addColorStop(0,'#fff');gradient.addColorStop(.45,'#eee9dc');gradient.addColorStop(1,'#77766c');ctx.beginPath();ctx.arc(bx,by,11,0,TAU);ctx.fillStyle=gradient;ctx.fill();ctx.strokeStyle='#faf4e6';ctx.stroke();
  }
}
