/* Gleis & Gasse 0.2.0. Pure offline simulation; no framework, network or DOM. */
(function(root){
'use strict';
const VERSION=2, KEY='gleisgasse.save.v2', N=29;
const cell=(x,y)=>x+','+y, edge=(a,b)=>[cell(a.x,a.y),cell(b.x,b.y)].sort().join('|');
const HUBS=[
 {id:0,x:5,y:10,bx:8,by:10,name:'Lindenplatz',kind:'home',desc:'Kleine Häuser mit Platz zum Wachsen'},
 {id:1,x:12,y:12,bx:12,by:14,name:'Marktplatz',kind:'work',desc:'Läden, Cafés und kurze Arbeitswege'},
 {id:2,x:23,y:10,bx:23,by:14,name:'Hauptbahnhof',kind:'station',desc:'Das Tor zur Stadt'},
 {id:3,x:17,y:7,bx:15,by:9,name:'Schule',kind:'school',desc:'Ein guter Schulweg verbindet die Viertel'},
 {id:4,x:5,y:4,bx:8,by:5,name:'Stadtpark',kind:'leisure',desc:'Ausflugsziel zwischen alten Bäumen'},
 {id:5,x:8,y:21,bx:5,by:20,name:'Südgärten',kind:'home',desc:'Ein grünes Viertel im Süden'},
 {id:6,x:23,y:21,bx:20,by:21,name:'Werkstätten',kind:'work',desc:'Arbeit und kleine Manufakturen'},
 {id:7,x:23,y:5,bx:25,by:6,name:'Seeufer',kind:'leisure',desc:'Freie Zeit am Wasser'},
 {id:8,x:14,y:22,bx:14,by:19,name:'Blumenviertel',kind:'home',desc:'Hier können neue Nachbarhäuser entstehen'}
];
const PALETTE=['#cf6448','#2b8786','#8b6ca6','#b98b32','#517cbb','#b7618d','#618946','#846653'];
const ROAD=new Set();
function road(x1,y1,x2,y2){const dx=Math.sign(x2-x1),dy=Math.sign(y2-y1);for(let x=x1,y=y1;;x+=dx,y+=dy){ROAD.add(cell(x,y));if(x===x2&&y===y2)break;}}
road(3,14,26,14);road(8,5,8,14);road(15,9,15,14);road(25,6,25,14);road(5,14,5,23);road(20,14,20,24);road(12,19,20,19);
const PLOTS=[
 {id:'l1',x:4,y:8,kind:'house',hub:0,min:1,p:0},{id:'l2',x:6,y:8,kind:'house',hub:0,min:1,p:2},
 {id:'l3',x:3,y:11,kind:'house',hub:0,min:2,p:1},{id:'l4',x:6,y:12,kind:'house',hub:0,min:3,p:3},
 {id:'s1',x:8,y:18,kind:'house',hub:5,min:1,p:0},{id:'s2',x:10,y:18,kind:'house',hub:5,min:1,p:1},
 {id:'s3',x:7,y:24,kind:'house',hub:5,min:2,p:2},{id:'s4',x:10,y:24,kind:'house',hub:5,min:3,p:3},
 {id:'b1',x:13,y:25,kind:'house',hub:8,min:1,p:2},{id:'b2',x:15,y:25,kind:'house',hub:8,min:1,p:3},
 {id:'b3',x:17,y:24,kind:'house',hub:8,min:2,p:0},{id:'b4',x:17,y:21,kind:'house',hub:8,min:3,p:1},
 {id:'market1',x:11,y:10,kind:'shop',p:2},{id:'market2',x:13,y:10,kind:'cafe',p:0},
 {id:'station',x:22,y:8,kind:'station',p:0},{id:'school',x:18,y:5,kind:'school',p:0},
 {id:'work1',x:23,y:18,kind:'workshop',p:3},{id:'work2',x:25,y:18,kind:'workshop',p:1}
];
const WATER=new Set(),BLOCKED=new Set();
for(let x=22;x<=27;x++)for(let y=1;y<=3;y++)WATER.add(cell(x,y));
// Reserving future plots prevents new buildings appearing on player-built tracks.
for(const p of PLOTS){BLOCKED.add(cell(p.x,p.y));if(['station','school'].includes(p.kind)){BLOCKED.add(cell(p.x+1,p.y));BLOCKED.add(cell(p.x,p.y-1));}}
const isRoad=(x,y)=>ROAD.has(cell(x,y));
const inBounds=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=1&&y>=1&&x<N-1&&y<N-1;
const canRail=(x,y)=>inBounds(x,y)&&!isRoad(x,y)&&!WATER.has(cell(x,y))&&!BLOCKED.has(cell(x,y));
const stopPoint=(h,type)=>type==='bus'?{x:h.bx,y:h.by}:{x:h.x,y:h.y};
const DIRS=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
class Heap{constructor(){this.a=[];}push(v){const a=this.a;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}pop(){const a=this.a,res=a[0],last=a.pop();if(a.length){let i=0;while(true){let l=i*2+1;if(l>=a.length)break;let r=l+1,j=r<a.length&&a[r].f<a[l].f?r:l;if(a[j].f>=last.f)break;a[i]=a[j];i=j;}a[i]=last;}return res;}get size(){return this.a.length;}}
function findPath(a,b,type='tram',avoid=new Set()){
 const allowed=(x,y)=>type==='bus'?isRoad(x,y):canRail(x,y);
 if(!allowed(a.x,a.y)||!allowed(b.x,b.y))return [];
 const heuristic=p=>Math.hypot(p.x-b.x,p.y-b.y),open=new Heap(),dist=new Map(),prev=new Map();
 const sk=cell(a.x,a.y)+'/-1';dist.set(sk,0);open.push({...a,d:-1,g:0,f:heuristic(a),k:sk});
 let finish=null,iterations=0;
 while(open.size&&iterations++<20000){const p=open.pop();if(p.g>dist.get(p.k)+1e-9)continue;if(p.x===b.x&&p.y===b.y){finish=p.k;break;}
  const dirs=type==='bus'?DIRS.slice(0,4):DIRS;
  for(let d=0;d<dirs.length;d++){const [dx,dy]=dirs[d],x=p.x+dx,y=p.y+dy,k=cell(x,y)+'/'+d;
   if(!allowed(x,y))continue;
   if(type==='tram'&&avoid.has(cell(x,y))&&!(x===b.x&&y===b.y))continue;
   if(dx&&dy&&(!allowed(p.x+dx,p.y)||!allowed(p.x,p.y+dy)))continue;
   const g=p.g+Math.hypot(dx,dy)+(p.d>=0&&p.d!==d?.24:0);
   if(g+1e-9<(dist.get(k)??Infinity)){dist.set(k,g);prev.set(k,p.k);open.push({x,y,d,g,f:g+heuristic({x,y}),k});}
  }
 }
 if(!finish)return [];const out=[];for(let k=finish;k;k=prev.get(k)){const xy=k.split('/')[0].split(',').map(Number);out.push({x:xy[0],y:xy[1]});}return out.reverse();
}
function smooth(raw,hard){
 const out=[];let distance=0;
 const add=p=>{const a=out[out.length-1];if(a){const d=Math.hypot(p.x-a.x,p.y-a.y);if(d<1e-7)return;distance+=d;}out.push({x:p.x,y:p.y,s:distance});};
 add(raw[0]);
 for(let i=1;i<raw.length-1;i++){
  const a=raw[i-1],b=raw[i],c=raw[i+1],d1=Math.hypot(b.x-a.x,b.y-a.y),d2=Math.hypot(c.x-b.x,c.y-b.y);
  const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
  if(hard.has(i)||Math.abs(cross)<1e-7){add(b);continue;}
  const r=Math.min(.32,d1*.32,d2*.32),p={x:b.x-(b.x-a.x)/d1*r,y:b.y-(b.y-a.y)/d1*r},q={x:b.x+(c.x-b.x)/d2*r,y:b.y+(c.y-b.y)/d2*r};
  add(p);for(let j=1;j<=8;j++){const t=j/8,u=1-t;add({x:u*u*p.x+2*u*t*b.x+t*t*q.x,y:u*u*p.y+2*u*t*b.y+t*t*q.y});}
 }
 add(raw[raw.length-1]);return out;
}
function sample(path,s){
 s=Math.max(0,Math.min(path[path.length-1].s,s));let lo=0,hi=path.length-1;
 while(hi-lo>1){const m=(lo+hi)>>1;if(path[m].s<=s)lo=m;else hi=m;}
 const a=path[lo],b=path[hi],d=b.s-a.s,t=d>1e-8?(s-a.s)/d:0,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
 return {x:a.x+dx*t,y:a.y+dy*t,dx:dx/len,dy:dy/len};
}
function anchorPoint(a,type){if(Number.isInteger(a.hub)&&HUBS[a.hub])return stopPoint(HUBS[a.hub],type);return{x:a.x,y:a.y};}
function route(type,anchors,preview=false){
 if(!['tram','bus'].includes(type)||!Array.isArray(anchors)||anchors.length<2||anchors.length>48)return{ok:false,error:'Wähle mindestens zwei Haltestellen.'};
 if(!Number.isInteger(anchors[0]?.hub)||(!preview&&!Number.isInteger(anchors[anchors.length-1]?.hub)))return{ok:false,error:'Die Strecke muss an einer Haltestelle beginnen und enden.'};
 const ids=anchors.filter(a=>Number.isInteger(a.hub)).map(a=>a.hub);
 if(ids.length<(preview?1:2)||ids.some(id=>!HUBS[id])||new Set(ids).size!==ids.length)return{ok:false,error:'Wähle verschiedene Haltestellen. Die Linie pendelt automatisch zurück.'};
 if(type==='bus'&&anchors.some(a=>!Number.isInteger(a.hub)))return{ok:false,error:'Busse folgen den Straßen. Wähle ihre Haltestellen.'};
 for(const a of anchors){const p=anchorPoint(a,type);if(type==='tram'?!canRail(p.x,p.y):!isRoad(p.x,p.y))return{ok:false,error:'Hier ist kein Platz für Gleise. Straßen, Wasser und Baugrundstücke bleiben frei.'};}
 const raw=[],marks=[],avoid=new Set();
 for(let i=0;i<anchors.length;i++){
  const a=anchors[i],p=anchorPoint(a,type);
  if(i){const prev=anchorPoint(anchors[i-1],type);if(p.x===prev.x&&p.y===prev.y)return{ok:false,error:'Dieser Punkt ist bereits ausgewählt.'};
   const segment=findPath(prev,p,type,avoid);if(!segment.length)return{ok:false,error:'Kein freier Weg. Entferne den letzten Punkt oder wähle einen anderen Wegpunkt.'};
   raw.push(...segment.slice(1));
  }else raw.push(p);
  if(Number.isInteger(a.hub))marks.push({hub:a.hub,index:raw.length-1});
  if(type==='tram')for(let j=0;j<raw.length-1;j++)avoid.add(cell(raw[j].x,raw[j].y));
 }
 const path=smooth(raw,new Set(marks.map(m=>m.index)));
 const stops=marks.map(m=>{const p=raw[m.index];let at=0,best=Infinity;
  // Only use samples after the previous stop (important on a branching bus road).
  const min=marks.indexOf(m)?marks[marks.indexOf(m)-1]._at??0:0;
  for(const q of path){if(q.s+1e-6<min)continue;const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<best){best=d;at=q.s;if(d<1e-7)break;}}
  m._at=at;return{hub:m.hub,at};});
 if(stops.some((s,i)=>i&&s.at<=stops[i-1].at))return{ok:false,error:'Die Reihenfolge ist nicht fahrbar. Ändere die Haltestellenfolge.'};
 return{ok:true,raw,path,stops,length:path[path.length-1].s};
}
function initial(){return{version:VERSION,money:1800,delivered:0,revenue:0,time:0,seed:812731,nextLine:1,nextVehicle:1,demandClock:0,
 lines:[],hubs:HUBS.map(h=>({id:h.id,queue:[],trips:0,growth:0,level:1,growAt:-100})),claimed:[],chronicle:[],tutorial:false,aid:0,settings:{speed:1,economy:true,labels:true}};}
function initialDemand(s){s.hubs[0].queue=[{o:0,d:1,n:5},{o:0,d:2,n:4},{o:0,d:3,n:3}];s.hubs[1].queue=[{o:1,d:0,n:5}];s.hubs[2].queue=[{o:2,d:0,n:5}];s.hubs[5].queue=[{o:5,d:1,n:4}];s.hubs[8].queue=[{o:8,d:2,n:4}];}
class Game{
 constructor(saved){this.state=saved||initial();if(!saved)initialDemand(this.state);this.events=[];this.topology=0;this.cache=new Map();}
 emit(type,data={}){this.events.push({type,...data});if(this.events.length>120)this.events.shift();}
 log(text,hub=null){this.state.chronicle.unshift({text,hub,time:this.state.time});this.state.chronicle=this.state.chronicle.slice(0,24);}
 random(){const s=this.state;s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
 invalidate(){this.topology++;this.cache.clear();}
 get population(){return this.state.hubs.filter(h=>HUBS[h.id].kind==='home').reduce((a,h)=>a+({1:16,2:32,3:56}[h.level]),0);}
 get homeCount(){return PLOTS.filter(p=>p.kind==='house'&&p.min<=this.state.hubs[p.hub].level).length;}
 get served(){return new Set(this.state.lines.flatMap(l=>l.stops.map(s=>s.hub)));}
 get rails(){const s=new Set();for(const l of this.state.lines)if(l.type==='tram')for(let i=1;i<l.raw.length;i++)s.add(edge(l.raw[i-1],l.raw[i]));return s;}
 get largeUnlocked(){return this.state.delivered>=40;}
 plan(type,anchors,editId=null){
  const old=editId===null?null:this.state.lines.find(l=>l.id===editId);
  if(editId!==null&&!old)return{ok:false,error:'Die Linie wurde nicht gefunden.'};
  if(old&&old.type!==type)return{ok:false,error:'Der Fahrzeugtyp einer Linie bleibt unverändert.'};
  if(!old&&this.state.lines.length>=8)return{ok:false,error:'In dieser Vorabversion sind acht Linien möglich.'};
  const r=route(type,anchors);if(!r.ok)return r;
  const currentRails=this.rails,newEdges=type==='tram'?new Set(r.raw.slice(1).map((p,i)=>edge(r.raw[i],p)).filter(k=>!currentRails.has(k))).size:0;
  const already=new Set(this.state.lines.filter(l=>l.type===type).flatMap(l=>l.stops.map(s=>s.hub)));
  const newStops=r.stops.filter(s=>!already.has(s.hub)).length;
  const cost=newEdges*8+newStops*(type==='tram'?25:18)+(old?0:type==='tram'?180:100);
  return{...r,type,anchors:anchors.map(a=>Number.isInteger(a.hub)?{hub:a.hub}:{x:a.x,y:a.y}),cost,newEdges,newStops,editId,affordable:cost<=this.state.money};
 }
 build(type,anchors,editId=null,name=''){
  const p=this.plan(type,anchors,editId);if(!p.ok)return p;if(!p.affordable)return{ok:false,error:'Es fehlen '+(p.cost-this.state.money)+' Münzen. In der Hilfe gibt es einen Testzuschuss.'};
  const s=this.state,old=editId===null?null:s.lines.find(l=>l.id===editId);s.money-=p.cost;
  let l;
  if(old){
   const prefix=p.anchors.length>=old.anchors.length&&old.anchors.every((a,i)=>JSON.stringify(a)===JSON.stringify(p.anchors[i]));
   if(!prefix){for(const v of old.vehicles)for(const q of v.load)this.enqueue(q.o,q);for(const v of old.vehicles){v.load=[];v.pos=0;v.dir=1;v.dwell=1;v.needsService=true;}}
   l=old;Object.assign(l,{anchors:p.anchors,raw:p.raw,path:p.path,stops:p.stops,length:p.length,paid:l.paid+p.cost});
   this.log(l.name+' wurde erweitert oder umgebaut.');
  }else{
   const id=s.nextLine++;l={id,name:name.trim().slice(0,32)||(type==='tram'?'Tram ':'Bus ')+id,type,color:PALETTE[(id-1)%PALETTE.length],anchors:p.anchors,raw:p.raw,path:p.path,stops:p.stops,length:p.length,paid:p.cost,rides:0,vehicles:[]};
   s.lines.push(l);l.vehicles.push(this.makeVehicle(l));this.log(l.name+' eröffnet: '+p.stops.length+' Haltestellen.');
  }
  if(name.trim())l.name=name.trim().slice(0,32);
  this.invalidate();this.emit('build',{id:l.id,edit:!!old,cost:p.cost});this.checkGoals();return{ok:true,line:l};
 }
 makeVehicle(l,large=false){return{id:this.state.nextVehicle++,pos:0,dir:1,dwell:.8,load:[],cap:l.type==='tram'?(large?24:12):9,large,needsService:true};}
 addVehicle(id,large=false){const l=this.state.lines.find(l=>l.id===id);if(!l)return{ok:false,error:'Linie nicht gefunden.'};if(l.vehicles.length>=4)return{ok:false,error:'Maximal vier Fahrzeuge pro Linie.'};if(large&&(l.type!=='tram'||!this.largeUnlocked))return{ok:false,error:'Die große Tram wird nach 40 Fahrgästen frei.'};
  const cost=l.type==='tram'?(large?240:180):100;if(this.state.money<cost)return{ok:false,error:'Noch nicht genug Münzen.'};this.state.money-=cost;l.paid+=cost;const v=this.makeVehicle(l,large);if(l.vehicles.length%2){v.pos=l.length;v.dir=-1;}else v.dwell=3;l.vehicles.push(v);this.emit('vehicle',{id});return{ok:true};}
 removeLine(id){const l=this.state.lines.find(l=>l.id===id);if(!l)return false;for(const v of l.vehicles)for(const p of v.load)this.enqueue(p.o,p);this.state.money+=Math.floor(l.paid*.6);this.state.lines=this.state.lines.filter(l=>l.id!==id);this.invalidate();this.log(l.name+' zurückgebaut (60 % Erstattung).');return true;}
 trip(from,to){if(from===to)return null;const k=from+'>'+to;if(this.cache.has(k))return this.cache.get(k);const dist=HUBS.map(()=>Infinity),first=HUBS.map(()=>null),done=new Set();dist[from]=0;
  for(let step=0;step<HUBS.length;step++){let u=-1;for(let i=0;i<HUBS.length;i++)if(!done.has(i)&&(u<0||dist[i]<dist[u]))u=i;if(u<0||!Number.isFinite(dist[u])||u===to)break;done.add(u);
   for(const l of this.state.lines){const here=l.stops.find(s=>s.hub===u);if(!here)continue;for(const there of l.stops){if(there.hub===u)continue;const w=Math.abs(there.at-here.at)/(l.type==='tram'?2.3:2.1)+4.5;
    if(dist[u]+w<dist[there.hub]){dist[there.hub]=dist[u]+w;first[there.hub]=u===from?{line:l.id,alight:there.hub}:first[u];}}}
  }const result=first[to];this.cache.set(k,result);return result;
 }
 enqueue(id,p){if(!HUBS[id]||p.d===id)return;const q=this.state.hubs[id].queue,total=q.reduce((a,p)=>a+p.n,0),dest=q.filter(a=>a.d===p.d).reduce((a,p)=>a+p.n,0),n=Math.max(0,Math.min(p.n,72-total,12-dest));if(!n)return;const found=q.find(a=>a.o===p.o&&a.d===p.d);if(found)found.n+=n;else q.push({o:p.o,d:p.d,n});}
 arrive(l,v,stop){const s=this.state,id=stop.hub;
  for(let i=v.load.length-1;i>=0;i--){const p=v.load[i];if(p.alight!==id)continue;v.load.splice(i,1);if(p.d===id){s.delivered+=p.n;s.money+=p.n*3;s.revenue+=p.n*3;l.rides+=p.n;const home=HUBS[p.o].kind==='home'?p.o:HUBS[p.d].kind==='home'?p.d:null;if(home!==null){s.hubs[home].trips+=p.n;s.hubs[home].growth+=p.n;}this.emit('fare',{hub:id,n:p.n,value:p.n*3});}else this.enqueue(id,p);}
  const queue=s.hubs[id].queue;let free=v.cap-v.load.reduce((a,p)=>a+p.n,0);
  for(let i=0;i<queue.length&&free>0;){const p=queue[i],leg=this.trip(id,p.d),dest=leg?l.stops.find(s=>s.hub===leg.alight):null;
   if(leg&&leg.line===l.id&&dest&&(dest.at-stop.at)*v.dir>1e-6){const n=Math.min(free,p.n);v.load.push({o:p.o,d:p.d,n,alight:leg.alight});p.n-=n;free-=n;if(!p.n)queue.splice(i,1);else i++;}else i++;
  }this.checkGrowth();this.checkGoals();
 }
 demand(){const homes=[0,5,8],targets=[1,2,3,4,6,7];
  for(const from of homes){const reachable=targets.filter(d=>this.trip(from,d));const list=reachable.length&&this.random()<.85?reachable:targets;const dest=list[Math.floor(this.random()*list.length)];this.enqueue(from,{o:from,d:dest,n:1+(this.random()<.55?1:0)});}
  const connected=targets.filter(d=>homes.some(h=>this.trip(d,h)));const list=connected.length?connected:targets,from=list[Math.floor(this.random()*list.length)],reachable=homes.filter(h=>this.trip(from,h)),dest=(reachable.length?reachable:homes)[Math.floor(this.random()*(reachable.length||homes.length))];this.enqueue(from,{o:from,d:dest,n:2});
 }
 growthNeed(h){return h.level===1?12:32;}
 reach(id){return[1,2,3,4,6,7].filter(d=>d!==id&&this.trip(id,d)).length;}
 checkGrowth(){for(const h of this.state.hubs){if(HUBS[h.id].kind!=='home'||h.level>=3)continue;const need=this.growthNeed(h),reach=this.reach(h.id);if(h.growth>=need&&reach>=(h.level===1?1:2)&&this.state.time-h.growAt>6){h.growth-=need;h.level++;h.growAt=this.state.time;this.emit('growth',{hub:h.id,level:h.level});this.log(HUBS[h.id].name+' wächst auf Stufe '+h.level+': höhere Häuser und ein neues Nachbarhaus.',h.id);}}}
 goals(){const s=this.state;return[
  {id:'line',title:'Die erste Verbindung',text:'Eine Tramlinie mit mindestens zwei Haltestellen bauen.',value:s.lines.some(l=>l.type==='tram')?1:0,max:1,reward:120},
  {id:'chain',title:'Eine Linie, viele Ziele',text:'Eine durchgehende Tramlinie mit vier Haltestellen betreiben.',value:Math.min(4,Math.max(0,...s.lines.filter(l=>l.type==='tram').map(l=>l.stops.length))),max:4,reward:180},
  {id:'rides',title:'Die Stadt kommt in Fahrt',text:'20 Fahrgäste an ihr Ziel bringen.',value:Math.min(20,s.delivered),max:20,reward:140},
  {id:'grow',title:'Ein Viertel blüht auf',text:'Ein Wohnviertel auf Stufe 2 wachsen lassen.',value:s.hubs.some(h=>h.level>=2)?1:0,max:1,reward:150},
  {id:'school',title:'Ein guter Schulweg',text:'Lindenplatz und Schule verbinden, auch mit Umstieg.',value:this.trip(0,3)?1:0,max:1,reward:120},
  {id:'network',title:'Bus und Bahn',text:'Je eine Bus- und Tramlinie betreiben.',value:s.lines.some(l=>l.type==='bus')&&s.lines.some(l=>l.type==='tram')?1:0,max:1,reward:140},
  {id:'all',title:'Eine Stadt für alle',text:'Alle neun Haltestellen erschließen.',value:this.served.size,max:9,reward:350},
  {id:'homes',title:'Eine gewachsene Stadt',text:'Alle drei Wohnviertel auf Stufe 3 entwickeln.',value:s.hubs.filter(h=>h.level===3).length,max:3,reward:500}
 ];}
 checkGoals(){for(const g of this.goals())if(g.value>=g.max&&!this.state.claimed.includes(g.id)){this.state.claimed.push(g.id);this.state.money+=g.reward;this.emit('goal',{title:g.title,reward:g.reward});}}
 step(dt){if(!Number.isFinite(dt)||dt<=0)return;let remain=Math.min(dt,10);while(remain>1e-9){const h=Math.min(.1,remain);this._tick(h);remain-=h;}}
 _tick(dt){const s=this.state;s.time+=dt;s.demandClock+=dt;if(s.demandClock>=3.8){s.demandClock-=3.8;this.demand();}
  for(const l of s.lines)for(const v of l.vehicles){
   if(v.needsService){const stop=l.stops.find(q=>Math.abs(q.at-v.pos)<1e-5);if(stop)this.arrive(l,v,stop);v.needsService=false;}
   if(v.dwell>0){v.dwell=Math.max(0,v.dwell-dt);continue;}
   const speed=l.type==='tram'?2.3:2.1,distance=speed*dt;
   const next=v.dir===1?l.stops.find(q=>q.at>v.pos+1e-6):[...l.stops].reverse().find(q=>q.at<v.pos-1e-6);
   if(!next){v.dir*=-1;v.dwell=.5;v.needsService=true;continue;}
   if(Math.abs(next.at-v.pos)<=distance+1e-6){v.pos=next.at;if(v.pos>=l.length-1e-6)v.dir=-1;else if(v.pos<=1e-6)v.dir=1;this.arrive(l,v,next);v.dwell=1.65;}else v.pos+=v.dir*distance;
  }
  if(Math.floor(s.time)!==Math.floor(s.time-dt))this.checkGrowth();
 }
 aid(){this.state.money+=600;this.state.aid++;this.emit('aid');}
 serialize(){const s=JSON.parse(JSON.stringify(this.state));for(const l of s.lines){delete l.path;delete l.raw;delete l.stops;delete l.length;}return JSON.stringify(s);}
 save(storage){try{const raw=this.serialize(),previous=storage.getItem(KEY);if(previous&&Game.parse(previous))storage.setItem(KEY+'.backup',previous);storage.setItem(KEY,raw);return true;}catch(e){return false;}}
 static parse(raw){try{
  if(typeof raw!=='string'||raw.length>1000000)return null;const s=JSON.parse(raw);
  const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  if(!s||s.version!==VERSION||!num(s.money,0,1e12)||!num(s.time,0,1e12)||!int(s.delivered,0,1e10)||!num(s.revenue,0,1e12)||!int(s.seed,0,4294967295)||!int(s.nextLine,1,1e9)||!int(s.nextVehicle,1,1e9)||!num(s.demandClock,0,4))return null;
  if(!Array.isArray(s.hubs)||s.hubs.length!==HUBS.length||!Array.isArray(s.lines)||s.lines.length>8||!Array.isArray(s.claimed)||!s.settings)return null;
  const passenger=p=>p&&int(p.o,0,8)&&int(p.d,0,8)&&p.o!==p.d&&int(p.n,1,72);
  for(let i=0;i<s.hubs.length;i++){const h=s.hubs[i];if(!h||h.id!==i||!int(h.level,1,3)||!int(h.growth,0,1e10)||!int(h.trips,0,1e10)||!num(h.growAt,-100,s.time)||!Array.isArray(h.queue)||h.queue.length>72||!h.queue.every(passenger)||h.queue.reduce((a,p)=>a+p.n,0)>72)return null;}
  const ids=new Set(),vids=new Set();
  for(const l of s.lines){if(!l||!int(l.id,1,1e9)||ids.has(l.id)||l.id>=s.nextLine||!['tram','bus'].includes(l.type)||typeof l.name!=='string'||l.name.length>32||!/^#[0-9a-f]{6}$/i.test(l.color)||!num(l.paid,0,1e10)||!int(l.rides,0,1e10)||!Array.isArray(l.vehicles)||!l.vehicles.length||l.vehicles.length>4)return null;ids.add(l.id);const r=route(l.type,l.anchors);if(!r.ok)return null;Object.assign(l,{raw:r.raw,path:r.path,stops:r.stops,length:r.length});
   for(const v of l.vehicles){if(!v||!int(v.id,1,1e9)||v.id>=s.nextVehicle||vids.has(v.id)||!num(v.pos,0,l.length+.001)||![-1,1].includes(v.dir)||!num(v.dwell,0,6)||!Number.isInteger(v.cap)||![9,12,24].includes(v.cap)||!Array.isArray(v.load)||!v.load.every(p=>passenger(p)&&l.stops.some(q=>q.hub===p.alight))||v.load.reduce((a,p)=>a+p.n,0)>v.cap)return null;vids.add(v.id);v.needsService=!!v.needsService;v.large=!!v.large;}
  }
  s.claimed=s.claimed.filter(x=>typeof x==='string').slice(0,12);s.settings={speed:s.settings.speed===2?2:1,economy:s.settings.economy!==false,labels:s.settings.labels!==false};s.tutorial=!!s.tutorial;s.aid=int(s.aid,0,1e9)?s.aid:0;
  s.chronicle=Array.isArray(s.chronicle)?s.chronicle.filter(q=>q&&typeof q.text==='string'&&q.text.length<=250&&num(q.time,0,s.time)&&(q.hub===null||int(q.hub,0,8))).slice(0,24):[];
  return s;
 }catch(e){return null;}}
 static load(storage){try{const raw=storage.getItem(KEY),s=Game.parse(raw);if(s)return{s,recovered:false};const b=Game.parse(storage.getItem(KEY+'.backup'));return{s:b,recovered:!!b,corrupt:!!raw&&!b};}catch(e){return{s:null,unavailable:true};}}
}
const API={Game,HUBS,PLOTS,ROAD,WATER,BLOCKED,N,KEY,VERSION,PALETTE,cell,edge,isRoad,canRail,stopPoint,findPath,route,smooth,sample};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.GGEngine=API;
})(typeof globalThis!=='undefined'?globalThis:this);
