/* Procedural isometric artwork. All graphics are generated locally. */
(function(root){'use strict';
const E=root.GGEngine,{HUBS,PLOTS,ROAD,WATER,N,sample,cell}=E,TW=72,TH=36;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function project(x,y,z=0){return{x:(x-y)*TW/2,y:(x+y)*TH/2-z};}
function poly(c,pts,fill,stroke){if(!pts.length)return;c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)c.lineTo(pts[i].x,pts[i].y);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=.8;c.stroke();}}
function line(c,pts,col,w=1){if(pts.length<2)return;c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)c.lineTo(pts[i].x,pts[i].y);c.strokeStyle=col;c.lineWidth=w;c.lineJoin='round';c.lineCap='round';c.stroke();}
function ellipse(c,x,y,rx,ry,col){c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);c.fillStyle=col;c.fill();}
function rr(c,x,y,w,h,r,fill,stroke){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
function tile(c,x,y,w,d,col,z=0){poly(c,[project(x-w/2,y-d/2,z),project(x+w/2,y-d/2,z),project(x+w/2,y+d/2,z),project(x-w/2,y+d/2,z)],col);}
function box(c,x,y,w,d,h,colors,z=0){const a=project(x-w/2,y-d/2,z),b=project(x+w/2,y-d/2,z),cc=project(x+w/2,y+d/2,z),dd=project(x-w/2,y+d/2,z),up=p=>({x:p.x,y:p.y-h});poly(c,[dd,cc,up(cc),up(dd)],colors[0]);poly(c,[cc,b,up(b),up(cc)],colors[1]);poly(c,[up(a),up(b),up(cc),up(dd)],colors[2]);}
function roof(c,x,y,w,d,z,col){w+=.14;d+=.14;const a=project(x-w/2,y-d/2,z),b=project(x+w/2,y-d/2,z),cc=project(x+w/2,y+d/2,z),dd=project(x-w/2,y+d/2,z),r1=project(x-w/2,y,z+14),r2=project(x+w/2,y,z+14);poly(c,[b,cc,r2],'#d4c5a0');poly(c,[a,b,r2,r1],'#ce9a72');poly(c,[r1,r2,cc,dd],col);line(c,[r1,r2],'#956b4f',1.8);}
const palettes=[['#f0dfb9','#cbb991','#fff0cb','#b87250'],['#dbe3d4','#afc4b1','#f0f1dc','#628777'],['#e9c3b0','#c69d8c','#f7d9c4','#966859'],['#c8dce0','#9abdc2','#e7efed','#587b88']];
function rand(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);}
function tree(c,p){const q=project(p.x,p.y),s=p.size;ellipse(c,q.x+7,q.y+4,15*s,6*s,'#50754219');box(c,p.x,p.y,.07,.07,23*s,['#9e8b64','#7f775b','#b9a477']);const col=['#89ac73','#79a67f','#a6b876'][p.p];ellipse(c,q.x,q.y-30*s,14*s,18*s,col);ellipse(c,q.x-8*s,q.y-26*s,11*s,12*s,col);ellipse(c,q.x+9*s,q.y-29*s,10*s,13*s,col);ellipse(c,q.x-4*s,q.y-39*s,8*s,6*s,'#ffffff18');}
function house(c,p,state){
 const home=p.kind==='house',hs=home?state.hubs[p.hub]:null,level=home?hs.level:1,age=home?clamp((state.time-hs.growAt)/5,0,1):1;
 if(home&&p.min>level)return;
 const fresh=home&&p.min===level&&level>1&&age<1,prev=Math.max(1,level-1),visual=home?(age<1?prev+(level-prev)*age:level):1;
 let w=.96,d=1.04,h=home?22+18*(visual-1):28,col=palettes[p.p||0];
 if(p.kind==='station'){w=1.74;d=1.04;h=37;col=['#e6d9b8','#bfb397','#fff0cc','#5d8071'];}
 if(p.kind==='school'){w=1.8;d=1.3;h=34;col=['#edc09a','#caa07a','#f9ddb5','#b37451'];}
 if(p.kind==='workshop'){w=1.25;d=1.1;h=24;}
 if(fresh)h=Math.max(2,h*age);
 tile(c,p.x+.16,p.y+.18,w+.25,d+.2,'#4b6a4620');tile(c,p.x,p.y,w+.2,d+.18,'#dad9bf');box(c,p.x,p.y,w,d,h,col);
 for(let f=0;f<(home?Math.ceil(visual):2);f++){const z=7+f*17;if(z+8>h)continue;for(const j of [-.3,.19]){poly(c,[project(p.x+j,p.y+d/2+.006,z),project(p.x+j+.18,p.y+d/2+.006,z),project(p.x+j+.18,p.y+d/2+.006,z+8),project(p.x+j,p.y+d/2+.006,z+8)],'#567a77');line(c,[project(p.x+j-.02,p.y+d/2+.008,z-1),project(p.x+j+.21,p.y+d/2+.008,z-1)],'#f8e9c8',1.6);}for(const j of [-.3,.15])poly(c,[project(p.x+w/2+.006,p.y+j,z),project(p.x+w/2+.006,p.y+j+.18,z),project(p.x+w/2+.006,p.y+j+.18,z+8),project(p.x+w/2+.006,p.y+j,z+8)],'#56706f');}
 if(level===3||p.kind==='workshop'){box(c,p.x,p.y,w+.08,d+.08,4,['#809384','#667e72','#a5b4a0'],h);box(c,p.x+.16,p.y-.19,.32,.32,4,['#bfc2a6','#a4b49e','#d5dbc2'],h+4);}else roof(c,p.x,p.y,w,d,h,col[3]);
 if(p.kind==='cafe'||p.kind==='shop'){for(let i=0;i<6;i++)tile(c,p.x-w/2+(i+.5)*w/6,p.y+d/2+.15,w/6,.43,i%2?'#f9eccf':'#cb7654',14);}
 if(home){poly(c,[project(p.x-.07,p.y+d/2+.02,0),project(p.x+.11,p.y+d/2+.02,0),project(p.x+.11,p.y+d/2+.02,12),project(p.x-.07,p.y+d/2+.02,12)],'#728b79');tile(c,p.x-.35,p.y+.76,.25,.32,'#b1be86');const q=project(p.x-.35,p.y+.76,3);ellipse(c,q.x,q.y,4,2,'#d59279');}
 if(p.kind==='station'){box(c,p.x-.76,p.y-.02,.32,.35,53,['#e8dabb','#bdb8a0','#faf0cf']);roof(c,p.x-.76,p.y-.02,.36,.37,53,'#608479');const q=project(p.x-.76,p.y+.18,40);ellipse(c,q.x,q.y,5,6,'#fff7dc');line(c,[{x:q.x,y:q.y-4},q,{x:q.x+3,y:q.y+1}],'#5e7668',1.2);}
 if(p.kind==='school'){box(c,p.x,p.y-.3,.4,.4,4,['#bd986f','#ac895f','#f4dfb7'],h+13);const q=project(p.x+.7,p.y+.6);line(c,[q,{x:q.x,y:q.y-43}],'#7b9280',1.7);poly(c,[{x:q.x,y:q.y-43},{x:q.x+13,y:q.y-39},{x:q.x,y:q.y-35}],'#d1a047');}
 if(p.kind==='workshop'){poly(c,[project(p.x-.38,p.y+d/2+.01,1),project(p.x+.38,p.y+d/2+.01,1),project(p.x+.38,p.y+d/2+.01,17),project(p.x-.38,p.y+d/2+.01,17)],'#718c84');line(c,[project(p.x-.37,p.y+d/2+.02,9),project(p.x+.37,p.y+d/2+.02,9)],'#d3debe',1.3);}
 if(home&&age<1&&level>1){const poles=[[-.58,.63],[.58,.63],[.58,-.6]];for(const [dx,dy]of poles){const a=project(p.x+dx,p.y+dy),b=project(p.x+dx,p.y+dy,h+18);line(c,[a,b],'#ba9251',2);}for(let z=12;z<h+16;z+=15)line(c,[project(p.x-.58,p.y+.63,z),project(p.x+.58,p.y+.63,z),project(p.x+.58,p.y-.6,z)],'#cfaa68',2);}
}
function railDraw(c,path,ghost=false,color='#b66a4b'){
 const pts=path.map(p=>project(p.x,p.y));
 line(c,pts,ghost?'#fff8df90':'#adbaa1',ghost?17:19);line(c,pts,ghost?'#c97c5650':'#bfc5af',ghost?12:14);
 if(ghost){line(c,pts,color,3);return;}
 const length=path[path.length-1].s;
 for(let s=.12;s<length;s+=.32){const p=sample(path,s),nx=-p.dy*.25,ny=p.dx*.25;line(c,[project(p.x+nx,p.y+ny),project(p.x-nx,p.y-ny)],'#7d8979',2.3);}
 for(const sign of [-1,1]){const pts=[];for(let i=0;i<path.length;i++){const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],len=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/len*.12*sign,ny=(b.x-a.x)/len*.12*sign;pts.push(project(path[i].x+nx,path[i].y+ny,1));}line(c,pts,'#4e675f',2.7);line(c,pts.map(p=>({x:p.x,y:p.y-.6})),'#e3e6d0',.85);}
}
// Cuboids in a vehicle's own forward/right basis, then projected isometrically.
function rotatedBox(c,x,y,dx,dy,len,width,z,h,color){
 const corner=(u,v,zz)=>project(x+dx*u-dy*v,y+dy*u+dx*v,zz),base=[corner(-len/2,-width/2,z),corner(len/2,-width/2,z),corner(len/2,width/2,z),corner(-len/2,width/2,z)],top=base.map(p=>({x:p.x,y:p.y-h}));
 const faces=[];for(let i=0;i<4;i++){const j=(i+1)%4,dep=base[i].y+base[j].y;faces.push({dep,pts:[base[i],base[j],top[j],top[i]],col:i%2?color[1]:color[0]});}faces.sort((a,b)=>a.dep-b.dep);for(const f of faces)poly(c,f.pts,f.col);poly(c,top,color[2]);
 return corner;
}
function vehicle(c,l,v){
 const pos=sample(l.path,v.pos),dx=pos.dx*v.dir,dy=pos.dy*v.dir,tram=l.type==='tram',len=v.large?1.58:tram?1.2:.9,width=tram?.39:.42,p=project(pos.x,pos.y);
 ellipse(c,p.x+3,p.y+4,tram?22:17,7,'#38513e22');
 rotatedBox(c,pos.x,pos.y,dx,dy,len,width,2,5,['#455b54','#354c47','#647c6e']);
 const corner=rotatedBox(c,pos.x,pos.y,dx,dy,len,width,6,15,[l.color,l.color,'#ede6d3']);
 for(const side of [-1,1])for(let i=0;i<4;i++){const u=-len*.4+i*len*.21,ww=len*.14;poly(c,[corner(u,side*(width/2+.004),12),corner(u+ww,side*(width/2+.004),12),corner(u+ww,side*(width/2+.004),19),corner(u,side*(width/2+.004),19)],'#416969');}
 rotatedBox(c,pos.x,pos.y,dx,dy,len+.025,width+.025,21,2,['#e4dfcb','#c3cfbd','#fcf3df']);
 for(const s of [-1,1]){const a=corner(len/2,s*width*.3,9);ellipse(c,a.x,a.y,1.7,1.8,'#fff1b5');}
 if(tram){const a=corner(-.18,0,24),b=corner(.04,0,35),cc=corner(.23,0,24);line(c,[a,b,cc],'#597367',1.6);line(c,[{x:b.x-5,y:b.y},{x:b.x+5,y:b.y}],'#4c655c',1.6);}
}
function stop(c,h,state,types){
 for(const type of types){const pt=E.stopPoint(h,type),x=pt.x+.35,y=pt.y+.42;
  box(c,x,y,.69,.3,3,['#b6c4a9','#96ac95','#e9e7d0']);box(c,x-.25,y,.03,.04,16,['#749078','#648372','#99b093'],3);box(c,x+.25,y,.03,.04,16,['#749078','#648372','#99b093'],3);box(c,x,y,.8,.37,2,['#8fac94','#72917e','#c0d0ac'],19);
  const n=state.hubs[h.id].queue.reduce((n,p)=>n+p.n,0);
  for(let i=0;i<Math.min(5,Math.ceil(n/4));i++){const q=project(pt.x-.3+i*.16,pt.y+.42+(i%2)*.08);ellipse(c,q.x,q.y,2.6,1.4,'#506b5035');line(c,[q,{x:q.x,y:q.y-6}],['#bd8867','#74988c','#cd9a67','#6d8894','#ac7977'][i%5],3);ellipse(c,q.x,q.y-8,2.2,2.2,'#dfb98f');}
 }
}
class Renderer{
 constructor(canvas,getGame,getUI){this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.getGame=getGame;this.getUI=getUI;this.W=1;this.H=1;this.DPR=1;this.zoom=.46;this.cx=14;this.cy=11;this.ground=null;this.groundVersion=-1;this.trees=[];this.floaters=[];
  for(let x=2;x<N-2;x+=2)for(let y=2;y<N-2;y+=2){if(!E.canRail(x,y)||PLOTS.some(p=>Math.hypot(p.x-x,p.y-y)<1.8)||HUBS.some(h=>Math.hypot(h.x-x,h.y-y)<1.25)||rand(x,y)<.37)continue;this.trees.push({x:x+(rand(x+7,y)-.5)*.5,y:y+(rand(x,y+6)-.5)*.5,size:.65+rand(x+2,y)*.4,p:Math.floor(rand(x,y+5)*3),kind:'tree'});}
 }
 resize(){const r=this.canvas.getBoundingClientRect();this.W=Math.max(1,r.width);this.H=Math.max(1,r.height);this.DPR=Math.min(window.devicePixelRatio||1,1.65);this.canvas.width=Math.round(this.W*this.DPR);this.canvas.height=Math.round(this.H*this.DPR);}
 area(){const ui=this.getUI();if(this.W>=600&&this.H<=580)return{x:0,y:130,w:this.W-310,h:this.H-140};const bottom=ui.building?Math.min(365,this.H*.42):100;return{x:0,y:150,w:this.W,h:Math.max(100,this.H-150-bottom)};}
 origin(){const a=this.area();return{x:a.x+a.w/2,y:a.y+a.h/2};}
 screen(x,y,z=0){const p=project(x-this.cx,y-this.cy,z),o=this.origin();return{x:o.x+p.x*this.zoom,y:o.y+p.y*this.zoom};}
 world(x,y){const o=this.origin(),a=(x-o.x)/this.zoom/(TW/2),b=(y-o.y)/this.zoom/(TH/2);return{x:this.cx+(a+b)/2,y:this.cy+(b-a)/2};}
 pan(dx,dy){this.cx-=dx/this.zoom/TW+dy/this.zoom/TH;this.cy+=dx/this.zoom/TW-dy/this.zoom/TH;this.cx=clamp(this.cx,-3,N+3);this.cy=clamp(this.cy,-3,N+3);}
 zoomAt(f,x=this.W/2,y=this.H/2){const before=this.world(x,y);this.zoom=clamp(this.zoom*f,.16,1.65);const after=this.world(x,y);this.cx+=before.x-after.x;this.cy+=before.y-after.y;}
 focus(h){this.cx=h.x;this.cy=h.y;this.zoom=Math.max(this.zoom,this.W<600?.85:1.0);}
 fit(points){const a=this.area(),pts=(points||[{x:0,y:0},{x:N-1,y:0},{x:N-1,y:N-1},{x:0,y:N-1}]).map(p=>project(p.x,p.y));const minX=Math.min(...pts.map(p=>p.x))-80,maxX=Math.max(...pts.map(p=>p.x))+80,minY=Math.min(...pts.map(p=>p.y))-95,maxY=Math.max(...pts.map(p=>p.y))+55;
  this.zoom=clamp(Math.min((a.w-25)/(maxX-minX),(a.h-25)/(maxY-minY)),.16,1.1);const x=(minX+maxX)/2/(TW/2),y=(minY+maxY)/2/(TH/2);this.cx=(x+y)/2;this.cy=(y-x)/2;
 }
 invalidate(){this.groundVersion=-1;}
 makeGround(){const game=this.getGame();this.ground=document.createElement('canvas');this.ground.width=2250;this.ground.height=1230;const c=this.ground.getContext('2d');c.translate(1125,70);
  const corners=[project(-.5,-.5),project(N-.5,-.5),project(N-.5,N-.5),project(-.5,N-.5)];poly(c,[corners[1],corners[2],{x:corners[2].x,y:corners[2].y+19},{x:corners[1].x,y:corners[1].y+19}],'#a7bd8f');poly(c,[corners[2],corners[3],{x:corners[3].x,y:corners[3].y+19},{x:corners[2].x,y:corners[2].y+19}],'#b2c797');
  for(let d=0;d<N*2;d++)for(let x=0;x<N;x++){const y=d-x;if(y<0||y>=N)continue;tile(c,x,y,1.007,1.007,['#ccddb4','#cddfb8','#cfe0b9','#c9dcb1'][Math.floor(rand(x,y)*4)]);}
  tile(c,24.5,2,6.5,3.7,'#b1c6a1');tile(c,24.5,2,5.9,2.9,'#93bebc');tile(c,24.7,2.1,5.3,2.3,'#86b6b8');for(let i=0;i<12;i++){const q=project(22.2+i*.38,1.2+(i%3)*.52);line(c,[q,{x:q.x+18,y:q.y}],'#c4dbca',1.2);}tile(c,21.5,2.7,.2,2.3,'#b7a67c');
  for(const p of PLOTS)if(p.kind==='house'&&p.min>1){tile(c,p.x,p.y,1.3,1.35,'#d8ddba');const pts=[project(p.x-.63,p.y-.65),project(p.x+.63,p.y-.65),project(p.x+.63,p.y+.65),project(p.x-.63,p.y+.65),project(p.x-.63,p.y-.65)];c.setLineDash([3,4]);line(c,pts,'#aebd96',.85);c.setLineDash([]);}
  tile(c,3.3,2.6,3.7,2.8,'#bbcf9f');for(let i=0;i<5;i++)tile(c,3.3,1.5+i*.45,3.2,.12,'#d5d8b2');
  for(const k of ROAD){const [x,y]=k.split(',').map(Number);tile(c,x,y,1,1,'#dfdfc9');tile(c,x,y,.77,.77,'#aeb9aa');for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]])if(E.isRoad(x+dx,y+dy))line(c,[project(x,y),project(x+dx*.51,y+dy*.51)],'#aeb9aa',20);}
  for(const k of ROAD){const [x,y]=k.split(',').map(Number),xx=E.isRoad(x+1,y);line(c,[project(x-(xx?.14:0),y-(xx?0:.14)),project(x+(xx?.14:0),y+(xx?0:.14))],'#e7e5d1',1.4);}
  for(const h of HUBS){c.setLineDash([3,6]);line(c,[project(h.x,h.y),project(h.bx,h.by)],'#e8e6caae',2);c.setLineDash([]);const q=project(h.bx,h.by);ellipse(c,q.x,q.y,4.5,2.3,'#dfc285');}
  for(const l of game.state.lines){if(l.type==='tram')railDraw(c,l.path);else{c.setLineDash([6,9]);line(c,l.path.map(p=>project(p.x,p.y)),l.color+'77',2.5);c.setLineDash([]);}}
  this.groundVersion=game.topology;const trackCells=new Set(game.state.lines.filter(l=>l.type==='tram').flatMap(l=>l.raw.map(p=>cell(p.x,p.y))));this.visibleTrees=this.trees.filter(p=>!trackCells.has(cell(Math.round(p.x),Math.round(p.y))));
 }
 label(c,h,ui,game){const type=ui.building?ui.type:'tram',p0=E.stopPoint(h,type),p=this.screen(p0.x,p0.y,20);if(p.x<-90||p.x>this.W+90||p.y<-20||p.y>this.H+40)return;
  const ids=ui.anchors?.filter(a=>Number.isInteger(a.hub)).map(a=>a.hub)||[],idx=ids.indexOf(h.id),built=game.served.has(h.id),selected=idx>=0,focus=ui.selected===h.id,r=selected?13:11;
  ellipse(c,p.x,p.y+2,r+1,r+1,'#3b583522');ellipse(c,p.x,p.y,r,r,selected?'#ca6446':built?'#32735f':'#faf6e7');c.strokeStyle='#faf9ea';c.lineWidth=selected?2:1.4;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.stroke();c.textAlign='center';c.textBaseline='middle';c.fillStyle=selected||built?'#fff9e5':'#557450';c.font='750 10px system-ui';c.fillText(String(selected?idx+1:h.id+1),p.x,p.y+.5);
  if(game.state.settings.labels||ui.building||focus){c.font='600 10px system-ui';const text=h.name,w=c.measureText(text).width+14;rr(c,p.x-w/2,p.y+r+4,w,20,7,selected?'#fff2df':'#faf8ecee',focus?'#93b28c':null);c.fillStyle=selected?'#934c32':'#496949';c.fillText(text,p.x,p.y+r+14);}
  const hs=game.state.hubs[h.id];if(h.kind==='home'&&hs.level>1&&!ui.building){rr(c,p.x-12,p.y-29,24,14,5,'#e4eed6');c.font='750 8px system-ui';c.fillStyle='#417245';c.fillText('↑ '+hs.level,p.x,p.y-22);}
  if(built&&!ui.building&&this.zoom>.45){const n=hs.queue.reduce((a,p)=>a+p.n,0);if(n){rr(c,p.x+9,p.y-15,Math.max(19,String(n).length*6+6),15,5,'#eadcb4');c.font='700 8px system-ui';c.fillStyle='#796337';c.fillText(String(n),p.x+19,p.y-7);}}
 }
 hit(x,y,type='tram'){let best=null,d=28;for(const h of HUBS){const p=E.stopPoint(h,type),q=this.screen(p.x,p.y,20),dist=Math.hypot(q.x-x,q.y-y);if(dist<d){d=dist;best=h;}}
  if(best)return best;for(const h of HUBS){const p=E.stopPoint(h,type),q=this.screen(p.x,p.y,20);if(Math.abs(q.x-x)<48&&y>=q.y+13&&y<=q.y+40)return h;}return null;
 }
 render(now){const c=this.c,game=this.getGame(),state=game.state,ui=this.getUI();c.setTransform(this.DPR,0,0,this.DPR,0,0);c.fillStyle='#e4ebda';c.fillRect(0,0,this.W,this.H);if(!this.ground||this.groundVersion!==game.topology)this.makeGround();const o=this.origin(),cp=project(this.cx,this.cy);
  c.save();c.translate(o.x-cp.x*this.zoom,o.y-cp.y*this.zoom);c.scale(this.zoom,this.zoom);c.drawImage(this.ground,-1125,-70);
  if(ui.selectedLine){const l=state.lines.find(l=>l.id===ui.selectedLine);if(l){c.globalAlpha=.35;line(c,l.path.map(p=>project(p.x,p.y)),l.color,6);c.globalAlpha=1;}}
  if(ui.preview?.path)railDraw(c,ui.preview.path,true,ui.type==='bus'?'#318887':'#ce6546');
  if(ui.building)for(let i=0;i<(ui.anchors||[]).length;i++){const a=ui.anchors[i];if(Number.isInteger(a.hub))continue;const q=project(a.x,a.y);ellipse(c,q.x,q.y,8,4,'#d8874c');line(c,[{x:q.x,y:q.y},{x:q.x,y:q.y-17}],'#b5643c',2);ellipse(c,q.x,q.y-19,4,4,'#fbdf98');}
  const entities=[];
  for(const p of this.visibleTrees||[])entities.push({x:p.x,y:p.y,kind:'tree',p});
  for(const p of PLOTS){if(p.kind==='house'&&p.min>state.hubs[p.hub].level)continue;entities.push({x:p.x,y:p.y,kind:'house',p});}
  for(const h of HUBS){const types=[...new Set(state.lines.filter(l=>l.stops.some(s=>s.hub===h.id)).map(l=>l.type))];for(const type of types){const p=E.stopPoint(h,type);entities.push({x:p.x,y:p.y+.45,kind:'stop',h,types:[type]});}}
  for(const l of state.lines)for(const v of l.vehicles){const p=sample(l.path,v.pos);entities.push({x:p.x,y:p.y,kind:'vehicle',l,v});}
  entities.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
  for(const en of entities){const screen=this.screen(en.x,en.y);if(screen.x<-110||screen.x>this.W+110||screen.y<-50||screen.y>this.H+170)continue;
   if(en.kind==='tree')tree(c,en.p);else if(en.kind==='house')house(c,en.p,state);else if(en.kind==='vehicle')vehicle(c,en.l,en.v);else stop(c,en.h,state,en.types);}
  for(const h of state.hubs)if(HUBS[h.id].kind==='home'&&h.level>1&&state.time-h.growAt<7){const loc=HUBS[h.id],q=project(loc.x,loc.y),t=(state.time-h.growAt)/7;c.globalAlpha=(1-t)*.7;c.strokeStyle='#fef6cb';c.lineWidth=4;c.beginPath();c.ellipse(q.x,q.y,35+t*65,17+t*32,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
  c.restore();for(const h of HUBS)this.label(c,h,ui,game);
  this.floaters=this.floaters.filter(f=>now-f.at<1900);for(const f of this.floaters){const h=HUBS[f.hub],p=this.screen(h.x,h.y,42),t=(now-f.at)/1900;c.globalAlpha=1-t;c.font='750 13px system-ui';c.textAlign='center';c.fillStyle='#326f4e';c.fillText(f.text,p.x,p.y-25*t);c.globalAlpha=1;}
 }
}
root.GGRenderer=Renderer;
})(globalThis);
