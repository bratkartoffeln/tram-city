'use strict';
const A=require('node:assert/strict'),fs=require('node:fs');
const E=require('../web/engine.js'),{Game,HUBS,route,canRail,isRoad,KEY,sample}=E;
const results=[],anc=ids=>ids.map(hub=>({hub}));
function test(name,fn){const start=performance.now();fn();results.push({name,pass:true,milliseconds:+(performance.now()-start).toFixed(2)});console.log('PASS',name);}
function run(g,seconds){for(let i=0;i<seconds;i++)g.step(1);}
function mem(){return{data:{},getItem(k){return this.data[k]??null;},setItem(k,v){this.data[k]=String(v);}};}
test('All 72 directed tram pairs: route exists; no roads, water or reserved plots; smoothed geometry stays off roads',()=>{
 for(const a of HUBS)for(const b of HUBS)if(a.id!==b.id){const r=route('tram',anc([a.id,b.id]));A.ok(r.ok,`${a.id}>${b.id}: ${r.error}`);A.ok(r.raw.every(p=>canRail(p.x,p.y)));for(let d=0;d<r.length;d+=.1){const p=sample(r.path,d);A.ok(!isRoad(Math.round(p.x),Math.round(p.y)),`${a.id}>${b.id} crosses a road`);}A.equal(r.stops.length,2);A.ok(Math.abs(r.stops.at(-1).at-r.length)<1e-6);}
});
test('All 72 directed bus pairs use existing roads only',()=>{
 for(const a of HUBS)for(const b of HUBS)if(a.id!==b.id){const r=route('bus',anc([a.id,b.id]));A.ok(r.ok,r.error);A.ok(r.raw.every(p=>isRoad(p.x,p.y)));}
});
test('A five-stop tram is one line, has rounded corners and serves every intermediate stop',()=>{
 const g=new Game(),r=g.build('tram',anc([0,4,1,3,2]));A.ok(r.ok);A.equal(g.state.lines.length,1);A.deepEqual(r.line.stops.map(s=>s.hub),[0,4,1,3,2]);A.ok(r.line.path.some(p=>Math.abs(p.x-Math.round(p.x))>.02&&Math.abs(p.y-Math.round(p.y))>.02));
 const visited=new Set(),orig=g.arrive.bind(g);g.arrive=(l,v,s)=>{visited.add(s.hub);orig(l,v,s);};run(g,100);A.equal(visited.size,5);A.ok(g.state.delivered>0);
});
test('Free waypoint changes track geometry without introducing a station',()=>{
 const a=route('tram',anc([0,1])),b=route('tram',[{hub:0},{x:3,y:6},{hub:1}]);A.ok(b.ok,b.error);A.equal(b.stops.length,2);A.ok(b.raw.some(p=>p.x===3&&p.y===6));A.notDeepEqual(a.raw,b.raw);
 const bad=route('tram',[{hub:0},{x:8,y:10},{hub:1}]);A.equal(bad.ok,false);
});
test('Append station to same line: preserve ID, name, vehicle, passengers and progress',()=>{
 const g=new Game(),l=g.build('tram',anc([0,4,1,3,2]),null,'Gartenlinie').line;run(g,3);const id=l.id,v=l.vehicles[0],saved=JSON.stringify(v),oldpaid=l.paid;
 const plan=g.plan('tram',anc([0,4,1,3,2,7]),id);A.ok(plan.ok,plan.error);const money=g.state.money;const edit=g.build('tram',anc([0,4,1,3,2,7]),id);A.ok(edit.ok);A.equal(g.state.lines.length,1);A.equal(edit.line.id,id);A.equal(edit.line.name,'Gartenlinie');A.equal(edit.line.vehicles[0],v);A.equal(JSON.stringify(v),saved);A.equal(edit.line.stops.length,6);A.equal(edit.line.paid,oldpaid+plan.cost);A.equal(g.state.money,money-plan.cost);run(g,120);A.ok(g.state.delivered>0);
});
test('Invalid build is atomic; repeated stops, road waypoints and insufficient money rejected',()=>{
 const g=new Game(),before=g.serialize();A.equal(g.build('tram',anc([0,0])).ok,false);A.equal(g.serialize(),before);A.equal(g.build('tram',[{hub:0},{x:8,y:10},{hub:1}]).ok,false);A.equal(g.serialize(),before);g.state.money=0;const zero=g.serialize();A.equal(g.build('tram',anc([0,1])).ok,false);A.equal(g.serialize(),zero);
});
test('Transfer trip: fare only once on final arrival, then home growth credited',()=>{
 const g=new Game();g.state.hubs.forEach(h=>h.queue=[]);g.demand=()=>{};
 g.build('tram',anc([0,1]));g.build('bus',anc([1,2]));g.state.hubs[0].queue=[{o:0,d:2,n:1}];
 A.equal(g.trip(0,2).alight,1);run(g,100);A.equal(g.state.delivered,1);A.equal(g.state.revenue,3);A.equal(g.state.hubs[0].trips,1);
});
test('Visible growth: home count and population increase; multiple destinations required for level 3',()=>{
 const g=new Game();g.build('tram',anc([0,1]));run(g,160);A.equal(g.state.hubs[0].level,2);A.equal(g.population,64);A.equal(g.homeCount,7);g.build('tram',anc([0,1,2]),1);run(g,160);A.equal(g.state.hubs[0].level,3);A.equal(g.population,88);A.equal(g.homeCount,8);A.ok(g.state.chronicle.some(e=>e.text.includes('Nachbarhaus')));
});
test('Vehicle limits, large-tram unlock and one-time city rewards',()=>{
 const g=new Game();g.build('tram',anc([0,1]));A.equal(g.addVehicle(1,true).ok,false);g.state.money=100000;for(let i=0;i<3;i++)A.ok(g.addVehicle(1).ok);A.equal(g.addVehicle(1).ok,false);const money=g.state.money;for(let i=0;i<5;i++)g.checkGoals();A.equal(g.state.money,money);run(g,200);A.ok(g.largeUnlocked);
});
test('Save / parse preserves simulation state and continuation is deterministic',()=>{
 const g=new Game();g.build('tram',anc([0,4,1,3,2]));g.build('bus',anc([5,8,6,2]));run(g,90);const raw=g.serialize(),saved=Game.parse(raw);A.ok(saved);const clone=new Game(saved);A.equal(clone.serialize(),raw);run(g,120);run(clone,120);A.equal(clone.serialize(),g.serialize());
});
test('Backup recovery, storage errors and malformed import rejection',()=>{
 const g=new Game(),storage=mem();A.ok(g.save(storage));g.build('tram',anc([0,1]));A.ok(g.save(storage));storage.setItem(KEY,'broken');const loaded=Game.load(storage);A.ok(loaded.recovered);A.equal(loaded.s.lines.length,0);
 A.equal(g.save({getItem(){throw Error('denied');}}),false);A.equal(Game.load({getItem(){throw Error('denied');}}).unavailable,true);
 for(const raw of ['{','null','{}','[]',JSON.stringify({...JSON.parse(g.serialize()),money:-1}),JSON.stringify({...JSON.parse(g.serialize()),lines:[{id:1}]})])A.equal(Game.parse(raw),null);
});
test('Pause and absence create no catch-up; dt bounded and non-finite values ignored',()=>{
 const g=new Game(),before=g.serialize();g.step(0);g.step(NaN);g.step(Infinity);g.step(-5);A.equal(g.serialize(),before);g.step(1e6);A.ok(g.state.time<=10.00001);
});
test('Thirty simulated minutes: two lines, capped queues, all three neighborhoods visibly grow',()=>{
 const g=new Game();g.build('tram',anc([0,4,1,3,2]));g.build('bus',anc([5,8,6,2]));run(g,1800);A.ok(g.state.delivered>300);A.equal(g.population,168);A.equal(g.homeCount,12);A.ok(g.state.hubs.every(h=>h.queue.reduce((a,p)=>a+p.n,0)<=72));A.ok(Game.parse(g.serialize()));
});
fs.writeFileSync(__dirname+'/engine-results.json',JSON.stringify({runtime:process.version,tests:results,passed:results.length},null,2));
console.log(`${results.length} engine test groups passed.`);
