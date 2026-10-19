/* Touch-first offline application controller. No external scripts or JavaScript bridge. */
(function(){'use strict';
const E=GGEngine,{Game,HUBS,KEY}=E,$=id=>document.getElementById(id),svg=n=>'<svg aria-hidden="true"><use href="#i-'+n+'"/></svg>',esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>Math.floor(n).toLocaleString('de-DE');
let storage;try{storage=window.localStorage;}catch(e){storage={getItem:()=>null,setItem:()=>{throw e;}};}
const loaded=Game.load(storage);let game=new Game(loaded.s),paused=false,suspended=false,modal='',modalId=null,saveOK=true,modalReturn='',modalReturnId=null;
const ui={building:false,type:'tram',anchors:[],preview:null,selected:null,selectedLine:null,editId:null};
const renderer=new GGRenderer($('world'),()=>game,()=>ui);
let plan=null,last=performance.now(),lastDraw=0,saveClock=0,uiClock=0,dirty=true,toastUntil=0,notifyQueue=[],pointerMulti=false,pinch=null;
const pointers=new Map();
for(const [id,name]of Object.entries({brandMark:'tram',help:'help',coinIcon:'coin',personIcon:'person',cityIcon:'city',zoomIn:'plus',zoomOut:'minus',fit:'fit',pause:'pause',cancelBuild:'close',closeSheet:'close'}))$(id).innerHTML=svg(name);
for(const [mode,name]of [['explore','eye'],['tram','tram'],['bus','bus'],['lines','lines'],['city','city']])document.querySelector('[data-mode="'+mode+'"] span').innerHTML=svg(name);
$('undoAnchor').innerHTML=svg('undo')+' Zurück';
function toast(text,hub=null){$('toast').innerHTML='<span>'+esc(text)+'</span>'+(hub!==null?'<button data-focus="'+hub+'">Ansehen</button>':'');$('toast').hidden=false;toastUntil=performance.now()+5500;}
$('toast').addEventListener('click',e=>{const b=e.target.closest('[data-focus]');if(b){closeSheet();renderer.focus(HUBS[Number(b.dataset.focus)]);ui.selected=Number(b.dataset.focus);dirty=true;$('toast').hidden=true;}});
function persist(){saveOK=game.save(storage);updateStats();return saveOK;}
function updateStats(){const s=game.state;$('money').textContent=fmt(s.money);$('rides').textContent=fmt(s.delivered);$('population').textContent=fmt(game.population);$('speed').textContent=s.settings.speed+'×';$('pause').innerHTML=svg(paused?'play':'pause');$('pause').setAttribute('aria-label',paused?'Spiel fortsetzen':'Spiel pausieren');
 $('status').classList.toggle('warn',!saveOK);$('statusText').textContent=!saveOK?'Speichern nicht möglich – Stadt sichern':suspended?'Offline · im Hintergrund pausiert':paused?'Offline · pausiert':modal?'Offline · im Menü pausiert':ui.building?'Offline · in der Planung pausiert':'Offline · lokal gespeichert';
 $('firstHint').hidden=!!(s.lines.length||ui.building||modal);for(const b of document.querySelectorAll('[data-mode]'))b.classList.toggle('active',modal==='lines'?b.dataset.mode==='lines':modal==='city'?b.dataset.mode==='city':ui.building?b.dataset.mode===ui.type:b.dataset.mode==='explore');
}
function openSheet(kind,title,kicker,body,id=null){modal=kind;modalId=id;$('sheetTitle').textContent=title;$('sheetKicker').textContent=kicker;$('sheetBody').innerHTML=body;$('overlay').hidden=false;$('sheet').scrollTop=0;updateStats();dirty=true;}
function closeSheet(){modal='';modalId=null;$('overlay').hidden=true;updateStats();last=performance.now();dirty=true;}
function guide(){return'<div class="guide-step"><span>1</span><div><h3>Haltestellen verbinden</h3><p>Tippe auf „Tram bauen“ und dann nacheinander auf mehrere Haltestellen. Alternativ nutze die Haltestellenliste. Es entsteht eine einzige durchgehende Linie.</p></div></div><div class="guide-step"><span>2</span><div><h3>Den Verlauf bestimmen</h3><p>Tippe zwischen zwei Haltestellen auf freies Gelände, um einen Wegpunkt zu setzen. Kurven werden abgerundet. „Zurück“ entfernt den letzten Planungspunkt. Straßen, Gebäude und Wasser sind für die Tram gesperrt.</p></div></div><div class="guide-step"><span>3</span><div><h3>Linien wachsen mit</h3><p>Unter „Linien“ → „Verlängern“ zusätzliche Haltestellen anfügen. Name, Liniennummer und Fahrzeuge bleiben erhalten. „Bearbeiten“ erlaubt auch eine neue Haltestellenfolge.</p></div></div><div class="guide-step"><span>4</span><div><h3>Die Stadt verändert sich</h3><p>Nach zwölf erfolgreichen Fahrten wächst das erste Wohnviertel: Häuser werden höher, ein Nachbarhaus entsteht mit Baugerüst. Die nächste Stufe benötigt 32 weitere Fahrten und zwei erreichbare Zielorte.</p></div></div>';}
function welcome(){openSheet('welcome','Eine Stadt in Bewegung','GLEIS & GASSE · VORABVERSION 0.2',
 '<p class="intro">Baue eine gemeinsame Idee – vorerst ganz für dich. Busse auf Straßen, Straßenbahnen auf eigenen, geschwungenen Trassen. Kein Zeitdruck.</p>'+ 
 '<div class="card"><h3>Neu: eigene Trassen & lange Linien</h3><p>Mehrere Stopps pro Linie, freie Wegpunkte und sichtbarer Hausbau. Deine neue Stadt startet mit 1.800 Münzen.</p></div>'+ 
 '<div class="button-stack"><button class="primary wide" data-act="welcome-build">Selbst eine Tramlinie bauen</button><button class="secondary wide" data-act="demo-now">Mit Beispielnetz starten</button><button class="secondary wide" data-act="welcome-close">Erst die Stadt ansehen</button></div>'+ 
 '<hr class="divider"><p class="note">Offline · Singleplayer · keine Berechtigungen, kein Konto, keine Werbung. Der Spielstand bleibt in dieser App. Dies ist eine neue Karte; Spielstände aus 0.1 werden nicht übernommen.</p>');}
function begin(type,editId=null,replace=false){closeSheet();ui.type=type;ui.building=true;ui.editId=editId;ui.selected=null;ui.selectedLine=editId;const old=game.state.lines.find(l=>l.id===editId);ui.anchors=old?old.anchors.map(a=>({...a})):[];$('builder').hidden=false;$('stopPicker').hidden=true;$('suggest').hidden=!!old;$('builderKicker').textContent=old?(replace?'LINIE BEARBEITEN':'LINIE VERLÄNGERN'):type==='tram'?'TRAMLINIE PLANEN':'BUSLINIE PLANEN';$('builderTitle').textContent=old?old.name:'Eine Linie, viele Haltestellen';
 updateBuilder();if(old)renderer.fit(old.path);else if(game.state.lines.length===0)renderer.fit([HUBS[0],HUBS[4],HUBS[1],HUBS[3],HUBS[2]]);dirty=true;
}
function quitBuild(){ui.building=false;ui.anchors=[];ui.preview=null;ui.editId=null;ui.selectedLine=null;plan=null;$('builder').hidden=true;$('stopPicker').hidden=true;updateStats();dirty=true;}
function chooseHub(id){if(!ui.building)return;const last=ui.anchors[ui.anchors.length-1];if(last?.hub===id){toast('Diese Haltestelle ist bereits der letzte Halt. Wähle den nächsten.');return;}if(ui.anchors.some(a=>a.hub===id)){toast('Diese Haltestelle gehört schon zur Linie. Die Rückfahrt erfolgt automatisch.');return;}
 ui.anchors.push({hub:id});updateBuilder();dirty=true;
}
function choosePoint(x,y){if(!ui.building||ui.type!=='tram')return;if(!ui.anchors.length){toast('Wähle zuerst eine Haltestelle als Start.');return;}if(!E.canRail(x,y)){toast('Hier bleiben Straße, Wasser oder Baugrundstück frei. Wähle die grüne Fläche.');return;}if(ui.anchors.length>=48){toast('Für diese Linie sind genug Wegpunkte gesetzt.');return;}const a=ui.anchors.at(-1),p=Number.isInteger(a.hub)?HUBS[a.hub]:a;if(p.x===x&&p.y===y)return;ui.anchors.push({x,y});updateBuilder();dirty=true;}
function updateBuilder(){if(!ui.building)return;
 const count=ui.anchors.filter(a=>Number.isInteger(a.hub)).length,pending=ui.anchors.length>0&&!Number.isInteger(ui.anchors.at(-1).hub);plan=game.plan(ui.type,ui.anchors,ui.editId);ui.preview=ui.anchors.length>=2?E.route(ui.type,ui.anchors,true):null;
 $('buildHint').textContent=ui.type==='tram'?(ui.anchors.length?'Weitere Haltestellen wählen. Freie Fläche antippen = Wegpunkt für den Gleisverlauf.':'Wähle den ersten Halt. Die Tram baut ihre Gleise abseits der Straßen.'):'Haltestellen in der gewünschten Reihenfolge wählen. Der Bus fährt auf vorhandenen Straßen.';
 let n=0;$('anchorChips').innerHTML=ui.anchors.length?ui.anchors.map(a=>Number.isInteger(a.hub)?'<span class="chip"><span class="num">'+(++n)+'</span>'+esc(HUBS[a.hub].name)+'</span>':'<span class="chip way">'+svg('pin')+' Wegpunkt</span>').join(''):'<span class="empty-chip">Noch keine Haltestelle ausgewählt</span>';
 $('anchorChips').scrollLeft=$('anchorChips').scrollWidth;$('undoAnchor').disabled=!ui.anchors.length;
 $('stopPicker').innerHTML=HUBS.map(h=>'<button data-stop="'+h.id+'" class="'+(ui.anchors.some(a=>a.hub===h.id)?'chosen':'')+'">'+(h.id+1)+' · '+esc(h.name)+'</button>').join('');
 const summary=$('buildSummary');summary.classList.toggle('error',!plan.ok&&count>=2&&!pending);
 if(plan.ok){summary.innerHTML='<span>'+plan.stops.length+' Haltestellen · '+(ui.type==='tram'?plan.newEdges+' neue Gleisabschnitte':'automatische Straßenroute')+'</span><strong>'+fmt(plan.cost)+' Münzen</strong>';$('commit').textContent=(ui.editId===null?'Linie bauen':'Linie aktualisieren')+' · '+fmt(plan.cost);$('commit').disabled=!plan.affordable;if(!plan.affordable)summary.innerHTML+='<span>Es fehlen '+fmt(plan.cost-game.state.money)+'.</span>';}
 else{summary.textContent=pending?'Wegpunkt gesetzt. Wähle jetzt die nächste Haltestelle.':count<2?'Mindestens zwei Haltestellen – gern auch drei, vier oder mehr.':plan.error;$('commit').textContent=pending?'Nächste Haltestelle wählen':'Haltestellen auswählen';$('commit').disabled=true;}
 updateStats();dirty=true;
}
function linesMenu(){const s=game.state;
 openSheet('lines','Dein Liniennetz','VERKEHRSBETRIEBE',
 '<p class="intro">Bestehende Linien verlängern statt jedes Mal neu bauen. Fahrzeuge pendeln automatisch über alle gewählten Haltestellen.</p>'+ 
 (s.lines.length?s.lines.map(l=>'<article class="card"><div class="card-top"><span class="line-badge" style="background:'+l.color+'">'+svg(l.type)+'</span><div><h3>'+esc(l.name)+'</h3><small>'+l.stops.length+' Haltestellen · '+l.vehicles.length+' Fahrzeug'+(l.vehicles.length===1?'':'e')+' · '+fmt(l.rides)+' Fahrgäste</small></div></div><div class="line-route">'+l.stops.map(st=>esc(HUBS[st.hub].name)).join('<span class="arrow">→</span>')+'</div><div class="card-actions"><button class="primary" data-act="extend" data-id="'+l.id+'">Verlängern</button><button class="secondary" data-act="line" data-id="'+l.id+'">Verwalten</button></div></article>').join(''):'<div class="card"><h3>Hier beginnt dein Netz.</h3><p>Wähle mehrere Haltestellen in einer Reihenfolge. Erst „Linie bauen“ schließt die gesamte Planung ab.</p></div>')+
 '<div class="card-actions"><button class="primary" data-act="build-tram">Neue Tramlinie</button><button class="secondary" data-act="build-bus">Neue Buslinie</button></div>');
}
function lineMenu(id){const l=game.state.lines.find(l=>l.id===id);if(!l){linesMenu();return;}
 openSheet('line',l.name,'LINIE '+l.id+' · '+(l.type==='tram'?'STRASSENBAHN':'BUS'),'<div class="line-route">'+l.stops.map((st,i)=>'<span>'+String(i+1)+'. '+esc(HUBS[st.hub].name)+'</span>').join('<span class="arrow">→</span>')+'</div>'+
 '<div class="metrics"><div><strong>'+l.vehicles.length+'</strong><span>Fahrzeuge</span></div><div><strong>'+fmt(l.rides)+'</strong><span>Fahrgäste am Ziel</span></div><div><strong>'+l.vehicles.reduce((a,v)=>a+v.cap,0)+'</strong><span>Sitzplätze</span></div></div>'+ 
 '<div class="card-actions"><button class="primary" data-act="extend" data-id="'+id+'">Linie verlängern</button><button class="secondary" data-act="edit" data-id="'+id+'">Halte bearbeiten</button><button class="secondary" data-act="show-line" data-id="'+id+'">Auf der Karte</button></div>'+ 
 '<div class="card"><h3>Mehr Platz für Fahrgäste</h3><p>Zusätzliche Fahrzeuge verteilen sich auf beide Enden. In dieser Vorabversion gibt es noch keine Kollisions- oder Signalsteuerung.</p><div class="button-stack"><button class="secondary" data-act="vehicle" data-id="'+id+'" '+(l.vehicles.length>=4?'disabled':'')+'>Weiteres Fahrzeug · '+(l.type==='tram'?180:100)+'</button>'+(l.type==='tram'?'<button class="secondary" data-act="large-vehicle" data-id="'+id+'" '+(!game.largeUnlocked||l.vehicles.length>=4?'disabled':'')+'>'+(game.largeUnlocked?'Große Tram (24 Plätze) · 240':'Große Tram ab 40 Fahrgästen')+'</button>':'')+'</div></div>'+ 
 '<label for="lineName">Name der Linie</label><input id="lineName" maxlength="32" value="'+esc(l.name)+'"><div class="card-actions"><button class="secondary" data-act="rename" data-id="'+id+'">Name speichern</button></div>'+ 
 '<hr class="divider"><button class="secondary danger wide" data-act="delete-line" data-id="'+id+'">Linie zurückbauen · '+fmt(Math.floor(l.paid*.6))+' Erstattung</button>',id);
}
function homeCard(h){const s=game.state.hubs[h.id],need=game.growthNeed(s),reach=game.reach(h.id),max=s.level===3;
 return'<article class="card"><div class="row"><h3>'+esc(h.name)+'</h3><span class="pill">Stufe '+s.level+' / 3</span></div><p>'+(max?'Ein gewachsenes Viertel mit vier Wohnhäusern.':s.level===1?'Zwei kleine Häuser. Nach zwölf Fahrten: mehr Etagen und ein drittes Haus.':'Drei Wohnhäuser. Als Nächstes: ein viertes Haus und weitere Etagen.')+'</p><div class="progress"><span style="width:'+(max?100:Math.min(100,s.growth/need*100))+'%"></span></div><div class="row"><small>'+(max?'Voll entwickelt':Math.min(s.growth,need)+' / '+need+' erfolgreiche Fahrten')+'</small><small>'+reach+' Zielorte erreichbar</small></div>'+(s.level===2&&reach<2?'<p>Für Stufe 3 noch einen zweiten Zielort anbinden.</p>':'')+'<div class="card-actions"><button class="secondary" data-act="focus" data-id="'+h.id+'">Viertel ansehen</button><button class="secondary" data-act="hub" data-id="'+h.id+'">Details</button></div></article>';
}
function cityMenu(){openSheet('city','Deine Stadt wächst','LINDENAU · STADTENTWICKLUNG',
 '<div class="metrics"><div><strong>'+game.population+'</strong><span>Einwohner</span></div><div><strong>'+game.homeCount+'</strong><span>Wohnhäuser</span></div><div><strong>'+game.served.size+' / 9</strong><span>Erschlossene Orte</span></div></div>'+ 
 '<p class="intro">Erfolgreiche Fahrten lassen Wohnhäuser höher werden und neue Nachbarhäuser entstehen. Nichts schrumpft. Baugrundstücke bleiben für die Stadt reserviert.</p>'+HUBS.filter(h=>h.kind==='home').map(homeCard).join('')+
 '<hr class="divider"><h3>Wünsche der Stadt</h3>'+game.goals().map(g=>'<div class="card goal '+(game.state.claimed.includes(g.id)?'done':'')+'"><div class="row"><h3>'+esc(g.title)+'</h3><span class="pill">'+(game.state.claimed.includes(g.id)?'Erfüllt':'+'+g.reward)+'</span></div><p>'+esc(g.text)+'</p><div class="progress"><span style="width:'+Math.min(100,g.value/g.max*100)+'%"></span></div><small>'+g.value+' / '+g.max+'</small></div>').join('')+
 (game.state.chronicle.length?'<hr class="divider"><h3>Stadtchronik</h3>'+game.state.chronicle.map(q=>'<div class="chronicle">'+esc(q.text)+'</div>').join(''):'')
 );}
function hubMenu(id){const h=HUBS[id],s=game.state.hubs[id],lines=game.state.lines.filter(l=>l.stops.some(q=>q.hub===id));ui.selected=id;
 const rows=s.queue.filter(p=>p.n>0).reduce((m,p)=>(m[p.d]=(m[p.d]||0)+p.n,m),{});
 openSheet('hub',h.name,'HALTESTELLE '+(id+1),'<p class="intro">'+esc(h.desc)+'</p>'+
 '<div class="service-list">'+(lines.length?lines.map(l=>'<span style="background:'+l.color+'">'+esc(l.name)+'</span>').join(''):'<span style="background:#83987d">Noch nicht erschlossen</span>')+'</div>'+ 
 (h.kind==='home'?homeCard(h):'')+
 '<div class="card"><h3>Wartende Fahrgäste</h3><p>'+(Object.keys(rows).length?Object.entries(rows).map(([d,n])=>n+' nach '+esc(HUBS[Number(d)].name)+(game.trip(id,Number(d))?'':' · noch keine Verbindung')).join('<br>'):'Gerade wartet niemand.')+'</p></div>'+ 
 '<p class="note">Bus- und Tramhalte liegen getrennt. Fahrgäste können innerhalb dieses Ortes zu Fuß zwischen beiden umsteigen. Eine abgeschlossene Reise bringt einmalig drei Münzen.</p>'+ 
 '<div class="card-actions"><button class="secondary" data-act="focus" data-id="'+id+'">Auf der Karte zeigen</button><button class="primary" data-act="start-hub" data-id="'+id+'">Neue Tram ab hier</button></div>',id);
}
function helpMenu(){openSheet('help','In Ruhe ein Netz bauen','HILFE · OFFLINE · 0.2.0',guide()+
 '<hr class="divider"><h3>Karte bedienen</h3><p class="intro">Mit einem Finger verschieben, mit zwei Fingern zoomen. + / − und die Übersichtstaste rechts sind Alternativen. Planung, Menüs und Hintergrundbetrieb pausieren das Spiel. Es gibt keine laufenden Kosten.</p>'+ 
 '<div class="legend"><span><i></i>Eigene Gleistrasse</span><span><i class="road"></i>Busstraße</span><span><i class="reserved"></i>Künftiges Baugrundstück</span></div>'+ 
 '<div class="button-stack"><button class="secondary" data-act="economy">Darstellung: '+(game.state.settings.economy?'akkuschonend (30 Bilder/s)':'flüssig (bis 60 Bilder/s)')+'</button><button class="secondary" data-act="labels">Haltestellennamen: '+(game.state.settings.labels?'eingeblendet':'ausgeblendet')+'</button><button class="secondary" data-act="aid">Testzuschuss: +600 Münzen</button><button class="secondary" data-act="saves">Spielstand sichern / laden</button><button class="secondary" data-act="privacy">Datenschutz und Android</button><button class="secondary" data-act="demo-confirm">Beispielnetz neu starten</button><button class="secondary danger" data-act="reset-confirm">Neue leere Stadt beginnen</button></div>'+ 
 '<hr class="divider"><p class="note">Grenzen der Vorabversion: feste Haltestellenorte und Straßen, maximal acht Linien, vier Fahrzeuge je Linie. Keine Gleiskollisionen, Signale, Weichensteuerung, Multiplayer oder freie 3D-Kamera. Tramlinien pendeln zwischen den Endhaltestellen.</p>');}
function privacy(){openSheet('privacy','Deine Stadt bleibt lokal','DATENSCHUTZ & ANDROID',
 '<div class="card"><h3>Keine angeforderten Berechtigungen</h3><p>Die APK enthält keine Internet-, Standort-, Kontakte-, Kamera-, Mikrofon-, Benachrichtigungs- oder Speicherberechtigung. Kein Konto, kein Tracker, keine Werbung, keine Cloud und kein Spielserver.</p></div>'+ 
 '<p class="intro">Spielstand und Einstellungen werden im privaten WebView-Speicher dieser App gespeichert. Android-Backups sind in der App abgeschaltet. Beim Löschen der App-Daten oder Deinstallieren kann der Spielstand verloren gehen. Über „Spielstand sichern / laden“ kannst du ihn als Text sichern.</p>'+ 
 '<div class="card"><h3>Android-Zielversion aktualisiert</h3><p>Version 0.2.0 zielt auf Android 17 (API 37), statt API 32 in Version 0.1. Sie benötigt mindestens Android 11 (API 30) und die System-WebView. Der Inhalt wird vollständig aus dem APK-Paket geladen; externe Netzwerklasten sind blockiert.</p></div>'+ 
 '<p class="notice">Dies ist eine selbst signierte Test-APK, keine Play-Store-Veröffentlichung. Hinweise zu einer unbekannten Quelle oder Play Protect können weiterhin erscheinen. Play Protect eingeschaltet lassen. Installation und native Darstellung auf deinem konkreten Gerät sind hier nicht nachgewiesen.</p>'+ 
 '<p class="note">Android-Systemleisten und Aussparungen werden über native WindowInsets berücksichtigt. Keine nativen .so-Bibliotheken. Die Android-Hülle ist klein; die lokale Spiellogik verwendet Canvas und JavaScript ohne externe Abhängigkeiten.</p>');}
function saves(){let manual=false;try{manual=!!Game.parse(storage.getItem(KEY+'.manual'));}catch(e){}
 openSheet('saves','Spielstand sichern','LOKALE DATEN',
 '<p class="intro">Automatische Speicherung alle zwei aktiven Spielsekunden und nach Bauaktionen. Eine zusätzliche manuelle Sicherung bleibt erhalten, bis du sie hier überschreibst.</p>'+ 
 '<div class="button-stack"><button class="primary" data-act="manual-save">Lokale Sicherung anlegen</button><button class="secondary" data-act="manual-load" '+(!manual?'disabled':'')+'>Lokale Sicherung laden</button><button class="secondary" data-act="export">Spielstand als Text anzeigen</button><button class="secondary" data-act="import">Spielstand aus Text laden</button></div>'+ 
 '<hr class="divider"><p class="note">Eine lokale Sicherung liegt ebenfalls in dieser App. Nur der kopierte Spielstandtext ist unabhängig von einer Deinstallation. Daten aus Version 0.1 sind mit der neuen Karte nicht kompatibel.</p>');}
function confirm(kind,title,text,id=null){modalReturn=modal;modalReturnId=modalId;openSheet(kind,title,'BITTE BESTÄTIGEN','<p class="intro">'+esc(text)+'</p><div class="card-actions"><button class="secondary" data-act="confirm-cancel">Abbrechen</button><button class="primary" data-act="'+kind+'-yes"'+(id!==null?' data-id="'+id+'"':'')+'>Bestätigen</button></div>',id);}
function refreshModal(){if(modal==='city')cityMenu();else if(modal==='line')lineMenu(modalId);else if(modal==='lines')linesMenu();else if(modal==='hub')hubMenu(modalId);else if(modal==='help')helpMenu();else closeSheet();}
function demo(){try{if(game.state.lines.length)storage.setItem(KEY+'.manual',game.serialize());}catch(e){}
 game=new Game();game.state.tutorial=true;let a=game.build('tram',[0,4,1,3,2].map(hub=>({hub})),null,'Gartenlinie');let b=game.build('bus',[5,8,6,2].map(hub=>({hub})),null,'Südbus');if(!a.ok||!b.ok)throw new Error('Das Beispielnetz konnte nicht erstellt werden.');game.events=[];quitBuild();closeSheet();renderer.invalidate();renderer.fit(game.state.lines[0].path);persist();toast('Beispielnetz fährt. Unter „Linien“ kannst du dieselbe Gartenlinie verlängern.');}
function startEmpty(){try{if(game.state.lines.length)storage.setItem(KEY+'.manual',game.serialize());}catch(e){}game=new Game();game.state.tutorial=true;quitBuild();closeSheet();renderer.invalidate();renderer.fit([HUBS[0],HUBS[4],HUBS[1],HUBS[3],HUBS[2]]);persist();toast('Neue Stadt. Eine vorherige Stadt liegt in der lokalen Sicherung.');}
$('sheetBody').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b||b.disabled)return;const act=b.dataset.act,id=Number(b.dataset.id);
 if(act==='welcome-build'){game.state.tutorial=true;persist();begin('tram');return;}if(act==='welcome-close'){game.state.tutorial=true;persist();closeSheet();return;}
 if(act==='build-tram'||act==='build-bus'){begin(act==='build-tram'?'tram':'bus');return;}
 if(act==='extend'||act==='edit'){const l=game.state.lines.find(l=>l.id===id);if(l)begin(l.type,id,act==='edit');return;}
 if(act==='line'){lineMenu(id);return;}if(act==='hub'){hubMenu(id);return;}if(act==='show-line'){const l=game.state.lines.find(l=>l.id===id);closeSheet();if(l){ui.selectedLine=id;renderer.fit(l.path);dirty=true;}return;}
 if(act==='focus'){closeSheet();ui.selected=id;renderer.focus(HUBS[id]);dirty=true;return;}if(act==='start-hub'){begin('tram');chooseHub(id);renderer.focus(HUBS[id]);return;}
 if(act==='vehicle'||act==='large-vehicle'){const r=game.addVehicle(id,act==='large-vehicle');if(!r.ok)toast(r.error);else{persist();toast('Zusätzliches Fahrzeug eingesetzt.');}lineMenu(id);return;}
 if(act==='rename'){const l=game.state.lines.find(l=>l.id===id),name=$('lineName').value.trim().slice(0,32);if(l&&name){l.name=name;persist();lineMenu(id);toast('Linienname gespeichert.');}return;}
 if(act==='delete-line'){confirm('delete', 'Linie zurückbauen?','Fahrzeuge und nicht mehr genutzte Gleise dieser Linie werden entfernt. Du erhältst 60 % der bisherigen Bauausgaben zurück.',id);return;}
 if(act==='delete-yes'){game.removeLine(id);persist();linesMenu();dirty=true;return;}
 if(act==='confirm-cancel'){const k=modalReturn,i=modalReturnId;if(k==='help')helpMenu();else if(k==='line')lineMenu(i);else if(k==='saves')saves();else closeSheet();return;}
 if(act==='privacy'){privacy();return;}if(act==='saves'){saves();return;}
 if(act==='economy'){game.state.settings.economy=!game.state.settings.economy;persist();helpMenu();return;}if(act==='labels'){game.state.settings.labels=!game.state.settings.labels;persist();helpMenu();dirty=true;return;}
 if(act==='aid'){game.aid();persist();toast('600 Testmünzen gutgeschrieben.');return;}
 if(act==='demo-now'||act==='demo-yes'){demo();return;}if(act==='demo-confirm'){confirm('demo','Beispielnetz starten?','Eine neue Stadt mit fünf Tramhaltestellen und einer Buslinie beginnt. Die aktuelle Stadt wird zuvor als lokale manuelle Sicherung gespeichert.');return;}
 if(act==='reset-confirm'){confirm('reset','Neue Stadt beginnen?','Eine neue leere Karte ersetzt die aktuelle Stadt. Der bisherige Spielstand wird vorher als lokale manuelle Sicherung gespeichert.');return;}if(act==='reset-yes'){startEmpty();return;}
 if(act==='manual-save'){try{storage.setItem(KEY+'.manual',game.serialize());toast('Manuelle lokale Sicherung angelegt.');saves();}catch(e){toast('Sicherung fehlgeschlagen. Nutze den Spielstandtext.');}return;}
 if(act==='manual-load'){confirm('restore','Sicherung laden?','Die aktuelle Stadt wird durch deine manuelle Sicherung ersetzt.');return;}
 if(act==='restore-yes'){try{const s=Game.parse(storage.getItem(KEY+'.manual'));if(!s){toast('Keine gültige Sicherung gefunden.');return;}game=new Game(s);quitBuild();renderer.invalidate();persist();closeSheet();toast('Sicherung geladen.');}catch(e){toast('Sicherung konnte nicht gelesen werden.');}return;}
 if(act==='export'){openSheet('export','Spielstand als Text','EXTERNE SICHERUNG','<p class="intro">„Text markieren“ wählen und den gesamten Text über die Android-Textauswahl kopieren. Bewahre ihn zum Beispiel in einer lokalen Notiz auf.</p><label for="saveText">Spielstand (Version 0.2)</label><textarea id="saveText" readonly></textarea><div class="card-actions"><button class="primary" data-act="select-save">Text markieren</button></div>');$('saveText').value=game.serialize();return;}
 if(act==='select-save'){$('saveText').focus();$('saveText').select();return;}
 if(act==='import'){openSheet('import','Spielstand einfügen','LOKALE SICHERUNG LADEN','<p class="intro">Füge einen vollständigen Spielstand aus Version 0.2 ein. Das Laden ersetzt deine aktuelle Stadt. Ungültige Daten werden abgelehnt.</p><label for="saveText">Spielstandtext</label><textarea id="saveText" spellcheck="false"></textarea><button class="primary wide" data-act="import-apply">Prüfen und laden</button>');return;}
 if(act==='import-apply'){const s=Game.parse($('saveText').value);if(!s){toast('Kein gültiger 0.2-Spielstand. Die aktuelle Stadt bleibt unverändert.');return;}try{storage.setItem(KEY+'.manual',game.serialize());}catch(e){}game=new Game(s);quitBuild();closeSheet();renderer.invalidate();persist();toast('Spielstand geprüft und geladen.');return;}
});
$('help').onclick=helpMenu;$('closeSheet').onclick=()=>{if(modal==='welcome'){game.state.tutorial=true;persist();}closeSheet();};
$('overlay').addEventListener('click',e=>{if(e.target===$('overlay'))closeSheet();});
$('firstLine').onclick=()=>begin('tram');$('cancelBuild').onclick=quitBuild;$('undoAnchor').onclick=()=>{ui.anchors.pop();updateBuilder();};
$('suggest').onclick=()=>{ui.anchors=(ui.type==='tram'?[0,4,1,3,2]:[5,8,6,2]).map(hub=>({hub}));updateBuilder();if(ui.preview?.ok)renderer.fit(ui.preview.path);};
$('stopListToggle').onclick=()=>{$('stopPicker').hidden=!$('stopPicker').hidden;dirty=true;};
$('stopPicker').onclick=e=>{const b=e.target.closest('[data-stop]');if(b)chooseHub(Number(b.dataset.stop));};
$('commit').onclick=()=>{if(!plan?.ok)return;const id=ui.editId,r=game.build(ui.type,ui.anchors,id);if(!r.ok){toast(r.error);updateBuilder();return;}const path=r.line.path;ui.selectedLine=r.line.id;quitBuild();ui.selectedLine=r.line.id;renderer.fit(path);persist();toast(id===null?r.line.name+' fährt über '+r.line.stops.length+' Haltestellen.':r.line.name+' aktualisiert – gleiche Linie, jetzt '+r.line.stops.length+' Haltestellen.');};
$('toolbar').onclick=e=>{const b=e.target.closest('[data-mode]');if(!b)return;const mode=b.dataset.mode;if(mode==='lines'){linesMenu();return;}if(mode==='city'){cityMenu();return;}if(mode==='explore'){if(ui.building)quitBuild();closeSheet();ui.selected=null;ui.selectedLine=null;dirty=true;return;}begin(mode);};
$('zoomIn').onclick=()=>{renderer.zoomAt(1.25);dirty=true;};$('zoomOut').onclick=()=>{renderer.zoomAt(.8);dirty=true;};$('fit').onclick=()=>{renderer.fit();dirty=true;};
$('pause').onclick=()=>{paused=!paused;updateStats();last=performance.now();dirty=true;};$('speed').onclick=()=>{game.state.settings.speed=game.state.settings.speed===1?2:1;persist();};
function coord(e){const r=$('world').getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
$('world').addEventListener('pointerdown',e=>{if(modal)return;e.preventDefault();const p=coord(e);pointers.set(e.pointerId,{...p,sx:p.x,sy:p.y,moved:false});try{$('world').setPointerCapture(e.pointerId);}catch(e){}if(pointers.size>1){pointerMulti=true;for(const p of pointers.values())p.moved=true;pinch=null;}});
$('world').addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;e.preventDefault();const p=coord(e),dx=p.x-old.x,dy=p.y-old.y;old.x=p.x;old.y=p.y;if(Math.hypot(p.x-old.sx,p.y-old.sy)>5)old.moved=true;
 if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y),x=(a.x+b.x)/2,y=(a.y+b.y)/2;if(pinch){renderer.zoomAt(d/Math.max(1,pinch.d),x,y);renderer.pan(x-pinch.x,y-pinch.y);}pinch={d,x,y};dirty=true;}
 else if(pointers.size===1&&old.moved){renderer.pan(dx,dy);dirty=true;}
});
function release(e,cancel=false){const p=pointers.get(e.pointerId);if(!p)return;const tap=!cancel&&!p.moved&&!pointerMulti;pointers.delete(e.pointerId);pinch=null;if(!pointers.size)pointerMulti=false;if(tap){const h=renderer.hit(p.x,p.y,ui.building?ui.type:'tram');if(h){if(ui.building)chooseHub(h.id);else hubMenu(h.id);}else if(ui.building&&ui.type==='tram'){const q=renderer.world(p.x,p.y);choosePoint(Math.round(q.x),Math.round(q.y));}else if(!ui.building){ui.selected=null;ui.selectedLine=null;dirty=true;}}}
$('world').addEventListener('pointerup',e=>release(e));$('world').addEventListener('pointercancel',e=>release(e,true));
$('world').addEventListener('wheel',e=>{e.preventDefault();const p=coord(e);renderer.zoomAt(Math.exp(-e.deltaY*.0015),p.x,p.y);dirty=true;},{passive:false});
window.addEventListener('resize',()=>{renderer.resize();dirty=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(modal)closeSheet();else if(ui.building)quitBuild();}if(e.code==='Space'&&!modal&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();paused=!paused;updateStats();}});
function collectEvents(now){let lastGrowth=null;for(const ev of game.events.splice(0)){if(ev.type==='fare')renderer.floaters.push({at:now,hub:ev.hub,text:'+'+ev.value});if(ev.type==='growth'){lastGrowth=ev;notifyQueue.push({text:HUBS[ev.hub].name+' wächst: höhere Häuser und ein neues Nachbarhaus.',hub:ev.hub});}if(ev.type==='goal')notifyQueue.push({text:ev.title+' erfüllt. +'+ev.reward+' Münzen.',hub:null});}
 if(lastGrowth){const idx=notifyQueue.findIndex(q=>q.hub===lastGrowth.hub);if(idx>0)notifyQueue.unshift(notifyQueue.splice(idx,1)[0]);}
 if(notifyQueue.length&&($('toast').hidden||now>toastUntil)){const q=notifyQueue.shift();toast(q.text,q.hub);}
}
function frame(now){const dt=Math.max(0,Math.min(.15,(now-last)/1000));last=now;const running=!paused&&!suspended&&!modal&&!ui.building;
 if(running){game.step(dt*game.state.settings.speed);saveClock+=dt;uiClock+=dt;if(saveClock>2){saveClock=0;persist();}if(uiClock>.3){uiClock=0;updateStats();}collectEvents(now);}
 if(!$('toast').hidden&&now>toastUntil)$('toast').hidden=true;
 const interval=game.state.settings.economy?1000/30:1000/60;
 if(!suspended&&(dirty||(running&&game.state.lines.length>0)||renderer.floaters.length)&&now-lastDraw>=interval-.5){renderer.render(now);lastDraw=now;dirty=false;}
 window.requestAnimationFrame(frame);
}
window.GG={get game(){return game;},get renderer(){return renderer;},get ui(){return ui;},begin,chooseHub,choosePoint,demo,quitBuild,closeSheet,help:helpMenu,city:cityMenu,lines:linesMenu,save:persist,
 suspend(){suspended=true;persist();updateStats();},resume(){suspended=false;last=performance.now();renderer.resize();updateStats();dirty=true;},
 back(){if(modal){closeSheet();return true;}if(ui.building){quitBuild();return true;}persist();return false;},
 // Deterministic test entry point: does not contact Android or any external service.
 testAdvance(seconds){for(let t=0;t<seconds;t+=.1)game.step(Math.min(.1,seconds-t));collectEvents(performance.now());updateStats();persist();dirty=true;}
};
document.addEventListener('visibilitychange',()=>document.hidden?GG.suspend():GG.resume());window.addEventListener('pagehide',()=>GG.suspend());
renderer.resize();renderer.fit([HUBS[0],HUBS[4],HUBS[1],HUBS[3],HUBS[2]]);updateStats();if(!game.state.tutorial)welcome();
if(loaded.recovered)toast('Der letzte Spielstand war beschädigt. Die automatische Sicherung wurde geladen.');
if(loaded.corrupt)toast('Der gespeicherte Spielstand konnte nicht geladen werden. Neue Stadt gestartet.');
if(loaded.unavailable){saveOK=false;updateStats();toast('Lokaler Speicher ist nicht verfügbar. Nutze den Spielstandtext in der Hilfe.');}
requestAnimationFrame(frame);
})();
