// Run from repository root with:
// /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/test_continent_journey.js
// Uses in-memory storage and DOM substitutes; never touches browser save data.
var window = {}, store = {}, failKey = '', checks=0;
var localStorage = { getItem:k => Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,
 setItem:(k,v)=>{ if(k===failKey) throw Error('simulated quota'); store[k]=String(v); } };
function safeSetItem(k,v){try {localStorage.setItem(k,v);return true;}catch(e){return false;}}
function assert(ok,msg){if(!ok)throw Error(msg);checks++;}
function todayKey(){return '2026-11-02';}
var areaSource=readFile('scripts/areas.js'), otoSource=readFile('scripts/otomon.js'), core=readFile('scripts/core.js');
eval(areaSource);
function boot(seed){store=Object.assign({'gq_otomon':JSON.stringify({discovered:{},active:'',nudgeOn:true,schemaVersion:3})},seed||{});eval(otoSource);return window.Otomon;}
var O=boot(), A=window.Areas;
assert(A.STAGES.length===8,'8 continents');
for(var k=1;k<=8;k++){
 var st=A.continentForStage(k);assert(st.areas.length===10,'10 areas');
 assert(O.OTOMON_MASTER.some(x=>x.id===st.nushi),'nushi exists');
 assert(O.habitatForStage(k)===st.habitat,'habitat matches');
 st.areas.forEach((a,i)=>{assert(a.range[0]===i*10+1&&a.range[1]===i*10+10,'ranges');
 assert(JSON.stringify(a.map)===JSON.stringify(A.STAGES[0].areas[i].map),'coordinates');
 assert(A.AREA_LINES[a.id].lines.length===0,'empty lines');});
}
assert(A.continentForStage(9).id==='stage1','cycle');
for(var pair of [[100,1],[250,2],[800,8]]){
 O=boot();assert(O.grantMissedNushiEggs(pair[0])===pair[1],'catchup '+pair[0]);
 assert(O.listEggs().length===pair[1],'egg count');
 var snapshot=JSON.parse(JSON.stringify(store));O=boot(snapshot);
 assert(O.grantMissedNushiEggs(pair[0])===0,'reload idempotence');
 assert(O.listEggs().length===pair[1],'reload count');
}
O=boot();failKey='gq_eggs';assert(O.grantNushiEgg(1)===null,'egg failure return');assert(O.listEggs().length===0,'egg rollback');assert(!O.getState().otomon.nushiGranted.length,'not marked');
failKey='';assert(!!O.grantNushiEgg(1),'retry egg');
O=boot();failKey='gq_otomon';assert(!!O.grantNushiEgg(1),'marker failure egg kept');failKey='';O=boot(JSON.parse(JSON.stringify(store)));assert(O.grantMissedNushiEggs(100)===0,'egg marker repairs failure');
for(var marker of [undefined,'abc']){
 var egg={uid:'old',eggId:'nushi_egg',pendingId:'minaraifenikkusu',nushiOf:'stage1',gauge:0,goal:4};
 for(var hatched of [false,true]){
  var state={discovered:hatched?{minaraifenikkusu:{count:1,firstMetAt:42,nushiOf:'stage1'}}:{},schemaVersion:3,nushiGranted:marker};
  O=boot({'gq_otomon':JSON.stringify(state),'gq_eggs':JSON.stringify(hatched?[]:[egg])});
  assert(O.grantMissedNushiEggs(100)===0,'missing/corrupt marker '+hatched);
 }
}
O=boot();O.grantNushiEgg(1);var post=JSON.parse(JSON.stringify(store));
O=boot();assert(O.grantMissedNushiEggs(100)===1,'pre-feature restore');
O=boot(post);assert(O.grantMissedNushiEggs(100)===0,'post-feature restore');
O=boot();O.grantNushiEgg(1);
function questHatch(egg){O.grantWakeItem('echo_flute',10);var out;for(var j=0;j<10&&O.getEgg(egg.uid);j++){
 var used=O.useWakeItem(egg.uid,'echo_flute');assert(!used.error,'wake item');out=O.completeActiveQuest();assert(!out.error,'complete quest');}return out;}
assert(questHatch(O.listEggs()[0]).hatched.id==='minaraifenikkusu','fixed hatch');
assert(O.getState().otomon.discovered.minaraifenikkusu.nushiOf==='stage1','hatch provenance');
var seed=JSON.parse(JSON.stringify(store));var state=JSON.parse(seed.gq_otomon);state.nushiGranted=[];
seed.gq_otomon=JSON.stringify(state);seed.gq_eggs=JSON.stringify([{uid:'duplicate',eggId:'nushi_egg',pendingId:'minaraifenikkusu',nushiOf:'stage1',gauge:0,goal:4}]);
O=boot(seed);assert(questHatch(O.listEggs()[0]).hatched.id==='minaraifenikkusu','owned nushi hatch');assert(O.getState().otomon.discovered.minaraifenikkusu.count===2,'count+1');
var nushi=A.STAGES.map(s=>s.nushi);
for(var owned of [false,true]){
 var disc={};if(owned)O.OTOMON_MASTER.forEach(o=>disc[o.id]={count:1,firstMetAt:1});
 O=boot({'gq_otomon':JSON.stringify({discovered:disc,schemaVersion:3})});
 O.WAKE_ITEM_MASTER.forEach(item=>assert(O._candidatePoolIds(item).every(id=>!nushi.includes(id)),'exclude all tiers '+item.id));
 for(var id of nushi){
  O=boot({'gq_otomon':JSON.stringify({discovered:disc,schemaVersion:3}),'gq_eggs':JSON.stringify([{uid:'legacy',eggId:'random_egg',pendingId:id,usedItem:'echo_flute'}])});
  assert(!nushi.includes(O.hatch('legacy').id),'legacy normal nushi reroll');
 }
}
O=boot();O.grantMissedNushiEggs(800);var eggsBefore=O.listEggs().length, invBefore=O.getWakeInventory().reduce((a,b)=>a+b.count,0);
assert(!O.grantNushiEgg(9)._eggUid,'repeat wake reward');assert(O.listEggs().length===eggsBefore,'no repeat egg');assert(O.getWakeInventory().reduce((a,b)=>a+b.count,0)===invBefore+1,'wake+1');
// 実際のcore関数を取り出して周囲だけ代役にする。ブラウザ検証ではない。
function fn(name){var start=core.indexOf('function '+name+'(');var end=core.indexOf('\n}',start)+2;return core.slice(start,end);}
eval(fn('sgGetStage'));eval(fn('sgGetCellNum'));eval(fn('doSugorokuRoll'));
var itemBuffs={},sugorokuData={pos:98,stage:1,items:[]},_sgPendingReward=null,sgPendingWalk=null,_sgJustRolled=false;
var BOARD_CELL_TYPES={100:'goal'}, getEquipmentDiceBonus=()=>0,saveItemBuffs=()=>{},saveSugorokuData=()=>{};
O=boot();itemBuffs.fixedDice=4;var result=doSugorokuRoll('pomo',25,false);
assert(result.cellType==='goal'&&result.bonusXP===100&&result.message.includes('習慣の大陸を踏破！ 次は 静寂の大陸 へ'),'98→102');
assert(!!_sgPendingReward._eggUid&&O.listEggs().length===1,'arrival payload');
assert(Object.keys(result).join(',')==='roll,prevPos,newPos,cellNum,cellType,bonusXP,message,evClass,usedBuff,baseDice','return shape');
O=boot();sugorokuData.pos=98;itemBuffs.fixedDice=2;assert(doSugorokuRoll('pomo',25,false).bonusXP===100,'98→100');itemBuffs.fixedDice=2;result=doSugorokuRoll('pomo',25,false);assert(result.bonusXP===5&&result.cellType==='normal','100→102 no duplicate');
O=boot();O.grantMissedNushiEggs(800);sugorokuData.pos=899;itemBuffs.fixedDice=2;_sgPendingReward=null;result=doSugorokuRoll('pomo',25,false);assert(result.bonusXP===100&&!_sgPendingReward._eggUid,'899→901 wake');
var _sgZonesFor=null,_sgZonesCache=[],_sgWalkFromPos=98,sgAnimCell=98;
eval(fn('sgShownPos'));eval(fn('sgZones'));
sugorokuData.pos=102;
for(var cell of [98,99,100,1,2]){sgAnimCell=cell;assert(sgZones()[0].name===(cell>=98?'はじまりの草原':'霧の入り江'),'walking continent '+cell);}
_sgWalkFromPos=100;sgAnimCell=100;assert(sgShownPos()===100,'from exact100');sgAnimCell=1;assert(sgShownPos()===101,'cross exact100');
O=boot();sugorokuData.pos=100;sugorokuData.stage=1;BOARD_CELL_TYPES[3]='event';itemBuffs.fixedDice=3;
var eggCount=O.listEggs().length;doSugorokuRoll('pomo',25,false);
var caveEgg=O.listEggs()[eggCount];assert(O.EGG_MASTER.find(e=>e.id===caveEgg.eggId).habitat==='cave','exact100 next event uses current continent habitat');
// 旧データを変更せず追加することを確認。
var oldEgg={uid:'keep',eggId:'random_egg',gauge:2,goal:3,pendingId:'guide_fairy',custom:'keep'};
var oldO={discovered:{guide_fairy:{count:9,firstMetAt:1}},active:'guide_fairy',nudgeOn:false,schemaVersion:3,extra:'keep'};
O=boot({'gq_eggs':JSON.stringify([oldEgg]),'gq_otomon':JSON.stringify(oldO),'gq_sugoroku':'{"pos":250,"stage":3,"initialized":true}','gq_world_seen_cell':'100'});
O.grantMissedNushiEggs(250);assert(JSON.stringify(O.listEggs()[0])===JSON.stringify(oldEgg),'old egg unchanged');var after=O.getState().otomon;delete after.nushiGranted;assert(JSON.stringify(after)===JSON.stringify(oldO),'old otomon unchanged');assert(store.gq_sugoroku==='{"pos":250,"stage":3,"initialized":true}'&&store.gq_world_seen_cell==='100','position/seen unchanged');
print('PASS: '+checks+' assertions (JavaScriptCore; no browser UI)');
// 大陸図はDOMの代役で生成内容と保存時点を検証。見た目・幅・実ブラウザの動作は未確認。
var elements={}, rafs=[],timers={},timerSeq=0;
var document={getElementById:id=>elements[id]||(elements[id]={innerHTML:'',textContent:'',querySelectorAll:()=>[]})};
function requestAnimationFrame(cb){rafs.push(cb);}
function setTimeout(cb,ms){timers[++timerSeq]=cb;return timerSeq;}
function clearTimeout(id){delete timers[id];}
var WM_REVEAL_MS=900,_wmTimer=null,_wmRevealing=false;
eval(fn('worldMaxCell'));eval(fn('worldCurrentCell'));eval(fn('cancelWorldMapReveal'));eval(fn('buildWorldMap'));
for(var pos of [0,55,100,150,200,801]){
 for(var seen of [37,100]){
  store.gq_world_seen_cell=String(seen);sugorokuData.pos=pos;buildWorldMap();
  var st=A.continentForStage(sgGetStage(pos));
  assert(elements['wm-sub'].textContent.includes(st.name),'map heading '+pos);
  assert(elements['wm-sub'].textContent.includes('2巡目')===(pos===801),'map cycle label');
  if(pos>0)assert(elements['wm-foot'].innerHTML.includes(A.areaOf(sgGetCellNum(pos),st.id).name),'map foot '+pos);
  assert(elements['wm-svg'].innerHTML.includes(st.areas[0].name),'map nodes');
  var from=Math.max(0,Math.min(100,seen-(sgGetStage(pos)-1)*100));
  var to=worldMaxCell();
  if(to>from){
   assert(store.gq_world_seen_cell===String(seen),'not seen before animation');
   cancelWorldMapReveal();while(rafs.length)rafs.shift()();
   assert(store.gq_world_seen_cell===String(seen),'close before RAF');
   buildWorldMap();while(rafs.length)rafs.shift()();cancelWorldMapReveal();
   assert(store.gq_world_seen_cell===String(seen),'close during animation');
   buildWorldMap();while(rafs.length)rafs.shift()();
   for(var key of Object.keys(timers)){var cb=timers[key];delete timers[key];cb();}
  }
  assert(store.gq_world_seen_cell===String(pos),'mark cumulative '+pos);
 }
}
for(var stage=2;stage<=8;stage++){
 sugorokuData.pos=stage*100;store.gq_world_seen_cell=String(stage*100);buildWorldMap();
 assert(elements['wm-svg'].innerHTML.includes('style="filter:'+A.continentForStage(stage).mapTint+'"'),'tint on image');
}
print('PASS total: '+checks+' assertions; visual/browser checks remain unverified');
