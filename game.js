// ═══════════════════════════════════════════════════
//  КЛИНОК И АРКАНА — Полная версия v2
// ═══════════════════════════════════════════════════

// ── Утилиты
const rnd   = (a,b) => Math.random()*(b-a)+a;
const rndI  = (a,b) => Math.floor(rnd(a,b+1));
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const dist2 = (a,b) => Math.hypot(a.wx-b.wx, a.wz-b.wz);

// ── Изометрия
const ISO  = 54;
let dungZoom = 0.72;  // зум подземелья (0.4 – 1.4)
const DUNG_ZOOM_MIN=0.28, DUNG_ZOOM_MAX=1.5;
let camZoom=1;
const CAM_ZOOM_MIN=0.7, CAM_ZOOM_MAX=1.6;
const CAM_MODES=["iso","behind","top"];
let camMode="behind";

function getCameraCfg(){
  if(camMode==="top") return { pitch:0.33, y:0.29, lead:0.08, back:0.42, name:"Сверху" };
  if(camMode==="behind") return { pitch:0.56, y:0.61, lead:1.1, back:0.12, name:"Сзади" };
  return { pitch:0.5, y:0.46, lead:0.55, back:0.16, name:"Изометрия" };
}
function getISO(){
  const base=(typeof gameState!=="undefined"&&gameState==="dungeon") ? dungZoom : 1;
  return ISO*base*camZoom;
}
function toScreen(wx,wz){
  const I=getISO();
  const pitch=getCameraCfg().pitch;
  return { sx:(wx-wz)*I, sy:(wx+wz)*I*pitch };
}
let camX=0, camY=0;
function w2c(wx,wz,wy=0){
  const {sx,sy}=toScreen(wx,wz);
  return {cx:camX+sx, cy:camY+sy - wy*getISO()*0.55};
}

// ── Перемещение камеры мышью (drag) ──
let _dragActive=false, _dragLastX=0, _dragLastY=0, _dragMode=false;

// ── Canvas
const arena = document.getElementById("arena");
const ctx   = arena.getContext("2d");
const AW=14, AD=10;

const UNIT_ART = {
  knight:{ src:"image/Gemini_Generated_Image_l80991l80991l809.png", label:"RAGNAR", icon:"⚔", bg1:"#111725", bg2:"#293f73", glow:"#87a6ff", frame:"#9ab8ff" },
  assassin:{ label:"LIORA", icon:"🗡", bg1:"#1b140a", bg2:"#6d4517", glow:"#f5c36a", frame:"#ffd37f" },
  mage:{ label:"SELENA", icon:"✦", bg1:"#170a23", bg2:"#5c2d8e", glow:"#d495ff", frame:"#f0b7ff" },
  wolf:{ src:"image/Gemini_Generated_Image_7h5hi17h5hi17h5h.png", label:"WOLF", icon:"🐺", bg1:"#11161d", bg2:"#5d6f86", glow:"#d9e6f4", frame:"#f2f7ff" },
  blackwolf:{ src:"image/Gemini_Generated_Image_48nw8x48nw8x48nw.png", label:"BLACKWOLF", icon:"☾", bg1:"#0e1018", bg2:"#363b54", glow:"#ffe45f", frame:"#ffe45f" },
  dragon:{ label:"DRAGON", icon:"🐉", bg1:"#220c08", bg2:"#852d17", glow:"#ff8856", frame:"#ffbb85" },
  necromancer:{ label:"NECRO", icon:"☠", bg1:"#0c1222", bg2:"#2f4b76", glow:"#8fd5ff", frame:"#d2eeff" },
  giant:{ label:"GIANT", icon:"⛨", bg1:"#201810", bg2:"#725437", glow:"#ffcf8e", frame:"#ffe2b1" },
  giantWolf:{ label:"ALPHA", icon:"⚡", bg1:"#130915", bg2:"#4a1a66", glow:"#cb6cff", frame:"#e8b3ff" },
  p2:{ label:"ALLY", icon:"⚔", bg1:"#200a0a", bg2:"#7d2020", glow:"#ff8e8e", frame:"#ffc0c0" },
};
const unitArtCache = Object.create(null);

function escapeSvgText(text){
  return String(text||"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/\"/g,"&quot;")
    .replace(/'/g,"&#39;");
}
function buildFallbackArtUrl(key){
  const meta=UNIT_ART[key]||UNIT_ART.knight;
  const svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320'>"
    +"<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='"+meta.bg1+"'/><stop offset='100%' stop-color='"+meta.bg2+"'/></linearGradient><radialGradient id='r' cx='50%' cy='42%' r='52%'><stop offset='0%' stop-color='"+meta.glow+"' stop-opacity='.75'/><stop offset='100%' stop-color='"+meta.glow+"' stop-opacity='0'/></radialGradient></defs>"
    +"<rect width='320' height='320' rx='36' fill='url(#g)'/>"
    +"<rect x='12' y='12' width='296' height='296' rx='28' fill='none' stroke='"+meta.frame+"' stroke-opacity='.85' stroke-width='4'/>"
    +"<circle cx='162' cy='148' r='112' fill='url(#r)'/>"
    +"<path d='M66 260 C102 182 124 116 160 98 C196 116 222 182 254 260' fill='"+meta.bg1+"' fill-opacity='.58'/>"
    +"<text x='34' y='54' font-family='Cinzel, serif' font-size='28' font-weight='700' fill='"+meta.frame+"'>"+escapeSvgText(meta.label)+"</text>"
    +"<text x='160' y='210' text-anchor='middle' font-size='120' font-family='Segoe UI Emoji, Apple Color Emoji, sans-serif'>"+escapeSvgText(meta.icon)+"</text>"
    +"<text x='160' y='286' text-anchor='middle' font-family='Manrope, sans-serif' font-size='18' letter-spacing='4' fill='"+meta.frame+"'>ART SPRITE</text>"
    +"</svg>";
  return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
}
function getArtUrl(key){
  const meta=UNIT_ART[key]||UNIT_ART.knight;
  if(meta.src) return meta.src;
  if(!meta.dataUrl) meta.dataUrl=buildFallbackArtUrl(key);
  return meta.dataUrl;
}
function getArtImage(key){
  if(!unitArtCache[key]){
    const img=new Image();
    img.decoding="async";
    img.loading="eager";
    img.src=getArtUrl(key);
    img.onload=function(){
      if(typeof initMenuPreviews==="function") initMenuPreviews();
    };
    unitArtCache[key]=img;
  }
  return unitArtCache[key];
}
function paintFallbackArt(c,x,y,w,h,key){
  const meta=UNIT_ART[key]||UNIT_ART.knight;
  const grad=c.createLinearGradient(x,y,x+w,y+h);
  grad.addColorStop(0,meta.bg1);
  grad.addColorStop(1,meta.bg2);
  c.fillStyle=grad;
  rrPath(c,x,y,w,h,Math.min(w,h)*0.14);
  c.fill();
  const glow=c.createRadialGradient(x+w*.5,y+h*.42,0,x+w*.5,y+h*.42,w*.48);
  glow.addColorStop(0,meta.glow);
  glow.addColorStop(1,"transparent");
  c.globalAlpha=.42;
  c.fillStyle=glow;
  c.fillRect(x,y,w,h);
  c.globalAlpha=1;
  c.fillStyle="rgba(0,0,0,.26)";
  c.beginPath();
  c.moveTo(x+w*.2,y+h*.92);
  c.quadraticCurveTo(x+w*.35,y+h*.48,x+w*.5,y+h*.4);
  c.quadraticCurveTo(x+w*.7,y+h*.52,x+w*.82,y+h*.92);
  c.closePath();
  c.fill();
  c.fillStyle=meta.frame;
  c.font=Math.floor(h*.12)+"px Cinzel";
  c.textAlign="left";
  c.fillText(meta.label,x+w*.08,y+h*.16);
  c.font=Math.floor(h*.46)+"px sans-serif";
  c.textAlign="center";
  c.fillText(meta.icon,x+w*.5,y+h*.62);
}
function drawArtPortrait(c,x,y,w,h,key,alpha){
  const img=getArtImage(key);
  const radius=Math.min(w,h)*0.14;
  c.save();
  c.globalAlpha=alpha==null?1:alpha;
  rrPath(c,x,y,w,h,radius);
  c.clip();
  if(img.complete&&img.naturalWidth>0) c.drawImage(img,x,y,w,h);
  else paintFallbackArt(c,x,y,w,h,key);
  const shade=c.createLinearGradient(x,y,x,y+h);
  shade.addColorStop(0,"rgba(255,255,255,.12)");
  shade.addColorStop(.55,"rgba(255,255,255,0)");
  shade.addColorStop(1,"rgba(3,6,14,.44)");
  c.fillStyle=shade;
  c.fillRect(x,y,w,h);
  c.restore();
  c.save();
  c.strokeStyle=(UNIT_ART[key]||UNIT_ART.knight).frame;
  c.lineWidth=Math.max(1,Math.min(w,h)*0.06);
  rrPath(c,x,y,w,h,radius);
  c.stroke();
  c.restore();
}
function getHeroArtKey(key){
  return key||"knight";
}
function getUnitArtKey(unit){
  if(!unit) return "knight";
  if(unit.spriteKey) return unit.spriteKey;
  if(unit.isHero){
    if(unit.role==="Мечник") return "knight";
    if(unit.role==="Убийца") return "assassin";
    if(unit.role==="Маг") return "mage";
  }
  if(unit.isP2) return "p2";
  if(unit.isBoss) return unit.isBoss;
  return "wolf";
}
function setPortraitArt(el,key,fallbackText){
  if(!el) return;
  const url=getArtUrl(key);
  if(url){
    el.classList.add("has-art");
    el.style.backgroundImage='url("'+url.replace(/"/g,'%22')+'")';
    el.textContent="";
    return;
  }
  el.classList.remove("has-art");
  el.style.backgroundImage="";
  el.textContent=fallbackText||"";
}

function resizeCam(){
  arena.width  = arena.offsetWidth  || window.innerWidth;
  arena.height = arena.offsetHeight || window.innerHeight;
  if((gameState==="playing"||gameState==="dungeon")&&player&&!player.dead){
    snapCameraNow(player);
  } else {
    const {sx,sy}=toScreen(AW/2, AD/2);
    camX = arena.width/2  - sx;
    camY = arena.height*0.38 - sy;
  }
}
window.addEventListener("resize", resizeCam);

function getCameraTarget(){
  if(player&&!player.dead) return player;
  if(player2&&!player2.dead) return player2;
  return null;
}
function snapCameraNow(target){
  const t=target||getCameraTarget();
  if(!t) return;
  const cfg=getCameraCfg();
  const tx=t.wx+t.facing*cfg.lead;
  const tz=t.wz-cfg.back;
  const p=toScreen(tx,tz);
  camX=arena.width*0.5-p.sx;
  camY=arena.height*cfg.y-p.sy;
}
function updateFollowCam(){
  if(_dragMode) return;
  const t=getCameraTarget();
  if(!t) return;
  const cfg=getCameraCfg();
  const tx=t.wx+t.facing*cfg.lead;
  const tz=t.wz-cfg.back;
  const p=toScreen(tx,tz);
  camX+=(arena.width*0.5-p.sx-camX)*0.12;
  camY+=(arena.height*cfg.y-p.sy-camY)*0.12;
}
function updateCameraHUD(){
  const m=document.getElementById("camModeBtn");
  const z=document.getElementById("camZoomVal");
  if(m) m.textContent="Камера: "+getCameraCfg().name;
  if(z) z.textContent=Math.round(camZoom*100)+"%";
}
function cycleCameraMode(){
  const i=(CAM_MODES.indexOf(camMode)+1)%CAM_MODES.length;
  camMode=CAM_MODES[i];
  _dragMode=false;
  snapCameraNow();
  updateCameraHUD();
  announce("Режим камеры: "+getCameraCfg().name);
}
function changeCameraZoom(delta){
  const old=camZoom;
  camZoom=clamp(camZoom+delta,CAM_ZOOM_MIN,CAM_ZOOM_MAX);
  if(Math.abs(camZoom-old)<0.0001) return;
  _dragMode=false;
  snapCameraNow();
  updateCameraHUD();
}

// ══ АРЕНЫ ════════════════════════════════════════════
const ARENAS = {
  castle: {
    name:"Замок",
    skyTop:"#04091a", skyBot:"#0d1e3a",
    floorColors:["#1a2030","#1c2234","#18202e","#1e2436","#202638"],
    floorLight:"#2a3458", floorDark:"#0d1220",
    wallFace:"#12213a",   wallTop:"#1c3260",
    wallSide:"#0a1628",  wallAccent:"#2244aa",
    fogColor:"rgba(6,12,24,.55)",
    starColor:"#ccddff",
    torchColor:"#4488ff", torchGlow:"rgba(40,90,255,",
    wallHeight:2.4,
    pillarColor:"#0f1d35",
  },
  dungeon: {
    name:"Подземелье",
    skyTop:"#060208", skyBot:"#160a20",
    floorColors:["#1a0f0a","#1e1008","#170d08","#1c0f0a","#201108"],
    floorLight:"#2e1610", floorDark:"#0a0604",
    wallFace:"#1a0a08",   wallTop:"#2e100a",
    wallSide:"#100404",  wallAccent:"#aa3300",
    fogColor:"rgba(20,5,15,.6)",
    starColor:"#ff8888",
    torchColor:"#ff6600", torchGlow:"rgba(255,80,0,",
    wallHeight:2.8,
    pillarColor:"#150606",
  },
  forest: {
    name:"Лес",
    skyTop:"#091503", skyBot:"#1a3208",
    floorColors:["#0d1f08","#0f2409","#0b1a07","#112008","#0e220a"],
    floorLight:"#1a3a0c", floorDark:"#060f04",
    wallFace:"#0f2206",   wallTop:"#1a3a0a",
    wallSide:"#060f03",  wallAccent:"#44aa00",
    fogColor:"rgba(8,20,5,.55)",
    starColor:"#aaffaa",
    torchColor:"#44ee00", torchGlow:"rgba(50,200,0,",
    wallHeight:2.2,
    pillarColor:"#0a1a05",
  },
};
let currentArena = ARENAS.castle;


// ══ SCREEN SHAKE ════════════════════════
let shakeT=0,shakeMag=0;
function screenShake(mag,dur){mag=mag||8;dur=dur||220;shakeMag=Math.max(shakeMag,mag);shakeT=dur;}
function tickShake(dt){if(shakeT>0){shakeT=Math.max(0,shakeT-dt);shakeMag*=0.85;}}
function applyShake(){if(shakeT<=0)return;ctx.translate(rnd(-shakeMag,shakeMag),rnd(-shakeMag*0.5,shakeMag*0.5));}

// ══ ЧАСТИЦЫ ══════════════════════════════════════
const PARTS=[];
function parts(cx,cy,col,n=7,spd=2.5){
  for(let i=0;i<n;i++){
    const a=rnd(0,Math.PI*2);
    PARTS.push({x:cx,y:cy,vx:Math.cos(a)*rnd(.5,spd),vy:Math.sin(a)*rnd(.4,spd),
      r:rnd(2,5),col,life:1,dec:rnd(.04,.09)});
  }
}
function tickParts(dt){
  for(let i=PARTS.length-1;i>=0;i--){
    const p=PARTS[i];
    p.x+=p.vx*(dt/16); p.y+=p.vy*(dt/16); p.vy+=.06;
    p.life-=p.dec*(dt/16);
    if(p.life<=0) PARTS.splice(i,1);
  }
}
function drawParts(){
  PARTS.forEach(p=>{
    ctx.save(); ctx.globalAlpha=Math.max(0,p.life);
    ctx.fillStyle=p.col; ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore();
  });
}

// ══ ПРЕДМЕТЫ НА ПОЛЕ ══════════════════════════════
const DROPS=[];
const CHESTS=[];
let coins=0;
const INVENTORY_DEFAULT={hpPotion:5,manaPotion:3,energyPotion:3,elixir:1};
let inventory={...INVENTORY_DEFAULT};

function resetInventory(){
  inventory={...INVENTORY_DEFAULT};
}
function invCount(key){
  return Math.max(0,inventory[key]||0);
}
function addInventoryItem(key,n){
  inventory[key]=Math.max(0,(inventory[key]||0)+(n||1));
  updateInventoryUI();
}
function getResourceLabel(p){
  if(!p) return "MP";
  return p.resourceType==="energy"?"EN":"MP";
}
function hasResource(p,cost){
  if(!p) return false;
  return (p.mp||0)>=Math.max(0,cost||0);
}
function spendResource(p,cost){
  if(!p) return false;
  cost=Math.max(0,cost||0);
  if((p.mp||0)<cost) return false;
  p.mp=clamp((p.mp||0)-cost,0,p.maxMp||0);
  return true;
}

function spawnDrop(wx,wz){
  const r=Math.random();
  let t="coin";
  if(r<0.45) t="coin";
  else if(r<0.67) t="hpPotion";
  else if(r<0.83) t="manaPotion";
  else if(r<0.95) t="energyPotion";
  else t="elixir";
  DROPS.push({wx,wz,type:t,pulse:0});
}
function tickDrops(dt){
  for(let i=DROPS.length-1;i>=0;i--){
    const d=DROPS[i]; d.pulse=(d.pulse||0)+dt*.005;
    const hero=player&&!player.dead?player:null;
    const h2=player2&&!player2.dead?player2:null;
    const picked=(hero&&dist2(hero,d)<0.55)||(h2&&dist2(h2,d)<0.55);
    if(picked){
      if(d.type==="coin"){
        var cc=rndI(5,15); coins+=cc; _sessionCoins+=cc;
        const sc=w2c(d.wx,d.wz,.5);
        dmgt(sc.cx,sc.cy,"+монеты","#f4be5f");
        addLog("Подобрал монеты!","good");
      } else {
        const map={
          hpPotion:{k:"hpPotion",label:"Зелье HP"},
          manaPotion:{k:"manaPotion",label:"Зелье MP"},
          energyPotion:{k:"energyPotion",label:"Зелье EN"},
          elixir:{k:"elixir",label:"Эликсир"},
        };
        const info=map[d.type]||map.hpPotion;
        addInventoryItem(info.k,1);
        const sc=w2c(d.wx,d.wz,.5);
        dmgt(sc.cx,sc.cy,"+1 в инвентарь","#4ec97a");
        addLog(info.label+": добавлено в инвентарь","good");
      }
      DROPS.splice(i,1);
    }
  }
}
function drawDrops(){
  DROPS.forEach(d=>{
    const {cx,cy}=w2c(d.wx,d.wz,0);
    const bob=Math.sin(d.pulse)*4;
    ctx.save(); ctx.shadowBlur=14;
    if(d.type==="coin"){
      ctx.shadowColor="#f4be5f"; ctx.fillStyle="#f4be5f";
      ctx.beginPath(); ctx.arc(cx,cy-bob-10,7,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#c89a10"; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle="#fff9"; ctx.font="bold 8px Manrope"; ctx.textAlign="center";
      ctx.fillText("$",cx,cy-bob-7);
    } else if(d.type==="hpPotion") {
      ctx.shadowColor="#4ec97a"; ctx.fillStyle="#2a8a4a";
      ctx.beginPath(); ctx.ellipse(cx,cy-bob-10,5,9,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#4ec97a";
      ctx.beginPath(); ctx.ellipse(cx-1,cy-bob-14,3,5,-.3,0,Math.PI*2); ctx.fill();
    } else if(d.type==="manaPotion") {
      ctx.shadowColor="#55a7ff"; ctx.fillStyle="#2d5faf";
      ctx.beginPath(); ctx.ellipse(cx,cy-bob-10,5,9,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#9bd1ff"; ctx.fillRect(cx-1.5,cy-bob-15,3,8);
    } else if(d.type==="energyPotion") {
      ctx.shadowColor="#f4be5f"; ctx.fillStyle="#8e661a";
      ctx.beginPath(); ctx.ellipse(cx,cy-bob-10,5,9,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#f4be5f"; ctx.fillRect(cx-2,cy-bob-13,4,6);
    } else {
      ctx.shadowColor="#cf88ff"; ctx.fillStyle="#6b2b8e";
      ctx.beginPath(); ctx.ellipse(cx,cy-bob-10,6,10,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#f3d8ff"; ctx.font="bold 8px Manrope"; ctx.textAlign="center";
      ctx.fillText("EX",cx,cy-bob-7);
    }
    ctx.restore();
  });
}

function useInventoryItem(key,u){
  const p=u||player;
  if(!p||p.dead) return;
  if(invCount(key)<=0){ addLog("Нет предмета в инвентаре","bad"); return; }
  if(key==="hpPotion"){
    if(p.hp>=p.maxHp){ addLog("HP уже максимум","info"); return; }
    const v=rndI(150,250); p.hp=clamp(p.hp+v,0,p.maxHp);
    dmgt(arena.width*0.2,arena.height*0.2,"+"+v+" HP","#4ec97a");
  } else if(key==="manaPotion"){
    const v=rndI(300,500); p.mp=clamp(p.mp+v,0,p.maxMp);
    dmgt(arena.width*0.2,arena.height*0.24,"+"+v+" "+getResourceLabel(p),"#66aaff");
  } else if(key==="energyPotion"){
    const v=rndI(300,500); p.mp=clamp(p.mp+v,0,p.maxMp);
    dmgt(arena.width*0.2,arena.height*0.24,"+"+v+" "+getResourceLabel(p),"#f4be5f");
  } else if(key==="elixir"){
    const hv=rndI(200,320), mv=rndI(500,800);
    p.hp=clamp(p.hp+hv,0,p.maxHp);
    p.mp=clamp(p.mp+mv,0,p.maxMp);
    dmgt(arena.width*0.2,arena.height*0.2,"Эликсир!","#d9a2ff");
  }
  inventory[key]=Math.max(0,invCount(key)-1);
  updateInventoryUI();
}


// ══ СУНДУКИ ═══════════════════════════════════
function spawnChest(wx,wz){
  CHESTS.push({wx:wx||AW/2,wz:wz||AD/2,pulse:0,opened:false});
  addLog('Появился сундук с наградой!','good');
}
function tickChests(dt){
  CHESTS.forEach(function(c){
    if(c.opened) return;
    c.pulse=(c.pulse||0)+dt*0.005;
    const heroes=[player,player2].filter(function(h){return h&&!h.dead;});
    const near=heroes.some(function(h){return dist2(h,c)<0.8;});
    if(near) openChest(c);
  });
}
function openChest(c){
  if(c.opened) return;
  c.opened=true;
  const coinAmt=rndI(30,80); coins+=coinAmt; _sessionCoins+=coinAmt;
  const sc=w2c(c.wx,c.wz,.5);
  dmgt(sc.cx,sc.cy,'+'+coinAmt+' монет','#f4be5f');
  const potTypes=['hpPotion','manaPotion','energyPotion'];
  const pCount=rndI(1,3);
  for(let i=0;i<pCount;i++){
    const pk=potTypes[Math.floor(Math.random()*potTypes.length)];
    addInventoryItem(pk,1);
  }
  if(Math.random()<0.2&&player){
    const drop=rollGearDrop(player);
    if(drop){
      tryAutoEquip(drop,chosenKey);
      addLog('Редкая находка: '+drop.name+' ('+drop.rarity+')','good');
    }
  }
  announce('Сундук открыт! +'+coinAmt+' монет, '+pCount+' зелий');
  addLog('Сундук открыт: +'+coinAmt+' монет, '+pCount+' зелий','good');
}
function drawChests(){
  CHESTS.forEach(function(c){
    if(c.opened) return;
    const sc=w2c(c.wx,c.wz,0);
    const cx=sc.cx; const cy=sc.cy;
    const bob=Math.sin(c.pulse)*5;
    ctx.save();
    ctx.shadowBlur=22; ctx.shadowColor='#f4be5f';
    ctx.fillStyle='#8b5e10';
    ctx.fillRect(cx-16,cy-bob-26,32,20);
    ctx.fillStyle='#c8841a';
    ctx.fillRect(cx-17,cy-bob-30,34,8);
    ctx.strokeStyle='#f4be5f'; ctx.lineWidth=2;
    ctx.strokeRect(cx-17,cy-bob-30,34,28);
    ctx.fillStyle='#f4be5f';
    ctx.beginPath();
    ctx.arc(cx,cy-bob-16,4,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 10px Manrope'; ctx.textAlign='center';
    ctx.fillText('!',cx,cy-bob-40);
    ctx.restore();
  });
}
// ══ ЛОВУШКИ ═══════════════════════════════════
const TRAPS=[];
const TRAP_TYPES={spike:{col:"#cc4444",trigR:0.7,dmg:[30,50],cd:2200,dur:600,label:"Шипы",icon:"⚔"},pit:{col:"#334",trigR:0.6,dmg:[0,0],cd:0,dur:0,label:"Яма",icon:"⚫"},rune:{col:"#4488ff",trigR:0.8,dmg:[20,35],cd:3000,dur:400,label:"Руна",icon:"✦"}};
function spawnTraps(){
  TRAPS.length=0;
  const types=["spike","pit","rune"];
  const n=Math.min(3+Math.floor(wave*.5),9);
  for(let i=0;i<n;i++){
    const tp=types[i%3];
    TRAPS.push({type:tp,wx:rnd(4,AW-3),wz:rnd(1.5,AD-1.5),cooldown:0,activeTimer:0,pulse:rnd(0,6.28)});
  }
}
function tickTraps(dt){
  const heroes=[player,player2].filter(function(h){return h&&!h.dead;});
  TRAPS.forEach(function(tr){
    const T=TRAP_TYPES[tr.type]; tr.pulse+=dt*.003;
    if(tr.cooldown>0){tr.cooldown=Math.max(0,tr.cooldown-dt);return;}
    if(tr.activeTimer>0){tr.activeTimer=Math.max(0,tr.activeTimer-dt);}
    if(tr.type==="pit"){ heroes.forEach(function(h){if(dist2(h,tr)<T.trigR)h.spd=Math.max(h.spd*.994,1.2);}); return; }
    heroes.forEach(function(h){
      if(dist2(h,tr)<T.trigR&&tr.activeTimer===0&&tr.cooldown===0){
        tr.activeTimer=T.dur; tr.cooldown=T.cd;
        var dmg=rndI(T.dmg[0],T.dmg[1]);
        if(dmg>0){ h.hit(dmg); var sc=w2c(h.wx,h.wz,.5); dmgt(sc.cx,sc.cy,"-"+dmg,"#ff8866"); addLog(T.label+" ударил "+h.name+"!","bad"); screenShake(6,180); }
      }
    });
  });
}
function drawTraps(){
  TRAPS.forEach(function(tr){
    var T=TRAP_TYPES[tr.type]; var p=w2c(tr.wx,tr.wz,0); var cx=p.cx,cy=p.cy;
    var bob=Math.sin(tr.pulse)*3; var active=tr.activeTimer>0;
    ctx.save(); ctx.globalAlpha=tr.cooldown>0?.25:.82;
    ctx.shadowColor=T.col; ctx.shadowBlur=active?22:8;
    ctx.fillStyle=T.col; ctx.beginPath(); ctx.ellipse(cx,cy,20,8,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.font="15px sans-serif"; ctx.textAlign="center";
    ctx.fillText(T.icon,cx,cy-bob-8);
    if(active){ ctx.strokeStyle=T.col; ctx.lineWidth=2.5; ctx.globalAlpha=.5; ctx.beginPath(); ctx.arc(cx,cy-10,24+Math.sin(tr.pulse)*5,0,Math.PI*2); ctx.stroke(); }
    ctx.restore();
  });
}

// ══ ТЕКСТ УРОНА ══════════════════════════════════
const DMGT=[];
function dmgt(x,y,text,col){
  col=col||"#fff";
  DMGT.push({x,y,vy:-1.6,text,col,life:1,dec:.025});
}
function tickDmgt(dt){
  for(let i=DMGT.length-1;i>=0;i--){
    const t=DMGT[i]; t.y+=t.vy*(dt/16); t.life-=t.dec*(dt/16);
    if(t.life<=0) DMGT.splice(i,1);
  }
}
function drawDmgt(){
  DMGT.forEach(t=>{
    ctx.save(); ctx.globalAlpha=Math.max(0,t.life);
    ctx.font="bold 16px Manrope,sans-serif"; ctx.fillStyle=t.col;
    ctx.textAlign="center"; ctx.shadowColor="rgba(0,0,0,.9)"; ctx.shadowBlur=5;
    ctx.fillText(t.text,t.x,t.y); ctx.restore();
  });
}

// ══ СНАРЯДЫ ════════════════════════════════════════
const PROJ=[];
function proj(owner,target,dmg,col,r){
  r=r||8;
  const p=w2c(owner.wx,owner.wz,.8);
  PROJ.push({owner,target,x:p.cx,y:p.cy,dmg,col,r});
}
function tickProj(dt){
  for(let i=PROJ.length-1;i>=0;i--){
    const p=PROJ[i];
    if(p.target.dead){PROJ.splice(i,1);continue;}
    const tp=w2c(p.target.wx,p.target.wz,.8);
    const dx=tp.cx-p.x, dy=tp.cy-p.y, d=Math.hypot(dx,dy);
    const spd=9*(dt/16);
    if(d<spd+p.r){
      dealDmg(p.owner,p.target,p.dmg);
      parts(tp.cx,tp.cy,p.col,8,3);
      PROJ.splice(i,1);
    } else { p.x+=dx/d*spd; p.y+=dy/d*spd; }
  }
}
function drawProj(){
  PROJ.forEach(p=>{
    ctx.save(); ctx.shadowColor=p.col; ctx.shadowBlur=18;
    ctx.fillStyle=p.col; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=.35; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

// ══ УТИЛИТЫ ЦВЕТА ══════════════════════════════════
function hexRGB(h){ return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }
function darken(h,a){ try{const[r,g,b]=hexRGB(h);return"rgb("+~~(r*a)+","+~~(g*a)+","+~~(b*a)+")";}catch(e){return h;} }
function lighten(h,a){ try{const[r,g,b]=hexRGB(h);return"rgb("+~~(r+(255-r)*a)+","+~~(g+(255-g)*a)+","+~~(b+(255-b)*a)+")";}catch(e){return h;} }
function rrect(c,x,y,w,h,r){
  if(w<=0||h<=0)return; c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath(); c.fill();
}
function rrPath(c,x,y,w,h,r){
  if(w<=0||h<=0)return;
  c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath();
}


// ══ СИСТЕМА ПОДЗЕМЕЛИЙ ════════════════════════════════
const DUNG_W=58, DUNG_H=44;
const MAX_DUNGEON_FLOOR=10;
const DT={WALL:0,FLOOR:1,CORR:2,EXIT:3,ENTRY:4};
let dungFloor=1;
let dungMap=[];
let dungRooms=[];
let dungExit={wx:2,wz:2};
let dungExitOpen=false;
let dungTransition=false;
let dungTransT=0;
let dungDescending=false;
let dungDescentT=0;
let dungAscending=false;
let dungAscendT=0;
let _dungLights=[];
let _dungHUDTimer=0;

function dungWalkable(wx,wz){
  const tx=Math.floor(wx),tz=Math.floor(wz);
  if(tx<0||tz<0||tx>=DUNG_W||tz>=DUNG_H) return false;
  return dungMap[tz][tx]!==DT.WALL;
}
function _carveRect(x,y,w,h,tile){
  for(let z=y;z<y+h;z++) for(let xi=x;xi<x+w;xi++)
    if(z>=0&&z<DUNG_H&&xi>=0&&xi<DUNG_W) dungMap[z][xi]=tile;
}
function _carveCorridor(x1,y1,x2,y2){
  let x=x1,y=y1;
  while(x!==x2){if(dungMap[y])dungMap[y][x]=DT.CORR;x+=x<x2?1:-1;}
  while(y!==y2){if(dungMap[y])dungMap[y][x]=DT.CORR;y+=y<y2?1:-1;}
  if(dungMap[y2])dungMap[y2][x2]=DT.CORR;
}
function genDungeon(floor){
  dungMap=Array.from({length:DUNG_H},function(){return Array(DUNG_W).fill(DT.WALL);});
  dungRooms=[]; _dungLights=[];
    const numRooms=7+Math.min(floor,6);
    let attempts=300;
  while(dungRooms.length<numRooms&&attempts-->0){
      const w=rndI(7,14),h=rndI(6,11);
    const x=rndI(1,DUNG_W-w-1),y=rndI(1,DUNG_H-h-1);
    const ovl=dungRooms.some(function(r){return x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y;});
    if(!ovl){
      _carveRect(x,y,w,h,DT.FLOOR);
      dungRooms.push({x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2),visited:false,cleared:false,mIds:[]});
    }
  }
  dungRooms.sort(function(a,b){return a.cx-b.cx;});
  for(let i=1;i<dungRooms.length;i++)
    _carveCorridor(dungRooms[i-1].cx,dungRooms[i-1].cy,dungRooms[i].cx,dungRooms[i].cy);
  const firstR=dungRooms[0];
  _carveRect(firstR.cx-1,firstR.cy-1,2,2,DT.ENTRY);
  const lastR=dungRooms[dungRooms.length-1];
  dungExit={wx:lastR.cx,wz:lastR.cy};
  dungMap[lastR.cy][lastR.cx]=DT.EXIT;
  dungRooms.forEach(function(r){_dungLights.push({wx:r.cx,wz:r.cy});});
  monsters=[];
  dungRooms.forEach(function(r,i){
    if(i===0) return;
    if(floor===10&&i===dungRooms.length-1){
      const boss=makeGiantWolf(r.cx,r.cy);
      r.mIds=[monsters.length]; monsters.push(boss);
    } else {
      const count=rndI(1+Math.floor(floor*.5),2+floor);
      for(let m=0;m<count;m++){
        const mx=r.x+1+Math.random()*(r.w-2);
        const mz=r.y+1+Math.random()*(r.h-2);
        r.mIds.push(monsters.length); monsters.push(makeDungMonster(floor,mx,mz));
      }
    }
  });
  dungExitOpen=false; dungTransition=false; dungDescending=false; dungDescentT=0;
  dungAscending=true; dungAscendT=0;
  if(player){player.wx=firstR.cx;player.wz=firstR.cy;}
  if(player2){player2.wx=firstR.cx+1;player2.wz=firstR.cy;}
  TRAPS.length=0; PARTS.length=0; PROJ.length=0; DMGT.length=0; DROPS.length=0; CHESTS.length=0;
  battleActive=false;
  setTimeout(resizeDungCam,50);
}
function resizeDungCam(){
  if(!player) return;
  if(_dragMode) return; // не сбрасывать камеру при ручном перемещении
  snapCameraNow(player);
}
function updateDungCam(){
  if(!player||_dragMode) return;
  updateFollowCam();
}
function makeDungMonster(floor,wx,wz){
  const tier=Math.min(Math.floor((floor-1)/2),4);
  const T=[
    {name:"Скелет",hp:50+floor*12,spd:1.8,atk:[8+floor*2,14+floor*3],atkRange:1.0,atkCd:1100,r:20,color:"#aabbcc"},
    {name:"Зомби",hp:70+floor*15,spd:1.4,atk:[12+floor*3,20+floor*4],atkRange:1.1,atkCd:1300,r:22,color:"#66aa44"},
    {name:"Гоблин",hp:45+floor*10,spd:2.5,atk:[8+floor*2,14+floor*3],atkRange:0.9,atkCd:900,r:18,color:"#aacc00"},
    {name:"Орк",hp:100+floor*20,spd:1.6,atk:[16+floor*4,24+floor*5],atkRange:1.2,atkCd:1200,r:24,color:"#886633"},
    {name:"Страж Тьмы",hp:140+floor*28,spd:1.5,atk:[22+floor*5,34+floor*6],atkRange:1.3,atkCd:1100,r:26,color:"#5566aa"},
  ][tier];
  return new Unit({...T,wx,wz,isHero:false,atkTimer:rnd(0,T.atkCd)});
}
function makeGiantWolf(wx,wz){
  return new Unit({name:"ЧЁРНЫЙ ВОЛК",role:"boss",
    hp:12000,spd:1.5,atk:[120,200],atkRange:5.5,atkCd:1200,
    color:"#1a0a1a",r:90,isBoss:"giantWolf",wx,wz,isHero:false,atkTimer:600});
}
function checkDungExit(){
  if(!player||player.dead||dungTransition||dungDescending||!dungExitOpen) return;
  if(Math.hypot(player.wx-dungExit.wx,player.wz-dungExit.wz)<1.4){
    dungDescending=true; dungDescentT=0;
    player.wx=dungExit.wx; player.wz=dungExit.wz; // прижать к лестнице
    addLog("Спускаешься на следующий этаж...","info");
    if(dungFloor>=MAX_DUNGEON_FLOOR){
      screenShake(20,600);
      announce("ПОБЕДА! Чёрный Волк повержен!");
      setTimeout(function(){
        dungDescending=false; dungTransition=true; dungTransT=0;
        setTimeout(function(){gameState="victory";},2200);
      },900);
    } else {
      announce("Этаж "+(dungFloor+1)+" ↓ ...");
      setTimeout(function(){
        dungDescending=false; dungTransition=true; dungTransT=0;
        setTimeout(function(){
          dungFloor++;
          currentArena=dungFloor<=3?ARENAS.castle:dungFloor<=6?ARENAS.dungeon:ARENAS.forest;
          genDungeon(dungFloor);
          dungTransition=false;
        },1100);
      },900);
    }
  }
}
function _dungTileLight(x,z){
  let lum=0;
  _dungLights.forEach(function(tl){lum+=Math.max(0,1-Math.hypot(x-tl.wx,z-tl.wz)/5)*.65;});
  if(player) lum+=Math.max(0,1-Math.hypot(x-player.wx,z-player.wz)/3.5)*.5;
  return Math.min(1,lum);
}
function drawDungeonMap(){
  const ar=currentArena;
  const pulse=0.82+0.18*Math.sin(_torchT*.0022);
  const wallH=ISO*(ar.wallHeight||2.2);
  const VIS_R=8.5;  // радиус видимости (плитки)
  const FADE_START=4.5; // с этого расстояния начинается туман

  function pdist(x,z){
    return player?Math.hypot(x+.5-player.wx,z+.5-player.wz):99;
  }

  // ── ПОЛ ──────────────────────────────────────────
  for(let z=0;z<DUNG_H;z++) for(let x=0;x<DUNG_W;x++){
    const cell=dungMap[z][x]; if(cell===DT.WALL) continue;
    const d=pdist(x,z);
    const tl=w2c(x,z),tr=w2c(x+1,z),br=w2c(x+1,z+1),bl=w2c(x,z+1);
    ctx.beginPath(); ctx.moveTo(tl.cx,tl.cy); ctx.lineTo(tr.cx,tr.cy);
    ctx.lineTo(br.cx,br.cy); ctx.lineTo(bl.cx,bl.cy); ctx.closePath();
    ctx.fillStyle=cell===DT.EXIT?(dungExitOpen?"#0d2218":"#0a0a1a"):
                  cell===DT.CORR?ar.floorColors[4]:ar.floorColors[(x+z*3)%5];
    ctx.fill();
    const lum=_dungTileLight(x+.5,z+.5)*pulse;
    if(lum>0.04&&cell!==DT.EXIT){
      ctx.globalAlpha=lum*.38;ctx.fillStyle=ar.torchColor;
      ctx.beginPath();ctx.moveTo(tl.cx,tl.cy);ctx.lineTo(tr.cx,tr.cy);ctx.lineTo(br.cx,br.cy);ctx.lineTo(bl.cx,bl.cy);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
    }
    ctx.strokeStyle="rgba(255,255,255,.04)"; ctx.lineWidth=.5; ctx.stroke();
    // ── метка точки входа ──
    if(cell===DT.ENTRY){
      const ec=w2c(x+.5,z+.5);
      ctx.save();ctx.globalAlpha=0.55;ctx.font="bold 10px sans-serif";ctx.textAlign="center";
      ctx.fillStyle="#88aaff";ctx.shadowColor="#88aaff";ctx.shadowBlur=8;
      ctx.fillText("▲",ec.cx,ec.cy+3);ctx.shadowBlur=0;ctx.restore();
    }
    // ── Лестница вниз ──────────────────────────────
    if(cell===DT.EXIT){
      const pv=0.4+0.6*Math.sin(_torchT*.004);
      ctx.save();
      if(dungExitOpen){
        const gx=w2c(x+.5,z+.5); const gr=ctx.createRadialGradient(gx.cx,gx.cy+8,0,gx.cx,gx.cy+8,40);
        gr.addColorStop(0,'rgba(40,220,120,'+(0.45*pv)+')'); gr.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=gr; ctx.fillRect(gx.cx-45,gx.cy-20,90,90);
      }
      const steps=4;
      for(let si=0;si<steps;si++){
        const t=si/steps;
        const mx0=x+t, mx1=x+t+1/steps, mz0=z+t, mz1=z+t+1/steps;
        const sa=w2c(mx0,mz0), sb=w2c(mx1,mz0), sc2=w2c(mx1,mz1), sd=w2c(mx0,mz1);
        const stepH=(steps-si)*5;
        const dark=dungExitOpen?(0.15+0.85*(si/steps)):(0.06+0.3*(si/steps));
        ctx.fillStyle=dungExitOpen?'rgba(20,'+(60+si*30)+','+(40+si*20)+','+dark+')':"rgba(15,15,30,"+dark+")";
        ctx.beginPath(); ctx.moveTo(sa.cx,sa.cy-stepH); ctx.lineTo(sb.cx,sb.cy-stepH); ctx.lineTo(sc2.cx,sc2.cy-stepH); ctx.lineTo(sd.cx,sd.cy-stepH); ctx.closePath(); ctx.fill();
        if(si<steps-1){
          const nx0=x+(si+1)/steps, nz1=z+(si+1)/steps;
          const ea=w2c(nx0,nz1), eb=w2c(nx0+1/steps,nz1);
          ctx.fillStyle=dungExitOpen?'rgba(30,'+(50+si*25)+','+(35+si*18)+',0.75)':"rgba(20,20,40,0.7)";
          ctx.beginPath(); ctx.moveTo(sa.cx,sa.cy-stepH); ctx.lineTo(sb.cx,sb.cy-stepH); ctx.lineTo(eb.cx,eb.cy-(steps-si-1)*5); ctx.lineTo(ea.cx,ea.cy-(steps-si-1)*5); ctx.closePath(); ctx.fill();
        }
      }
      if(dungExitOpen){
        const pc=w2c(x+.5,z+.5);
        ctx.globalAlpha=0.65+0.35*pv; ctx.fillStyle="#55ffaa";
        ctx.shadowColor="#55ffaa"; ctx.shadowBlur=16; ctx.font="bold 14px sans-serif"; ctx.textAlign="center";
        ctx.fillText("▼",pc.cx,pc.cy+4); ctx.shadowBlur=0;
      }
      ctx.restore();
    }
  }

  // ── СТЕНЫ (с кирпичными деталями и пиллярами) ───
  for(let z=0;z<DUNG_H;z++) for(let x=0;x<DUNG_W;x++){
    if(dungMap[z][x]!==DT.WALL) continue;
    const d=pdist(x,z);
    const hasFN=(z>0&&dungMap[z-1][x]!==DT.WALL)||(z<DUNG_H-1&&dungMap[z+1][x]!==DT.WALL)||
                (x>0&&dungMap[z][x-1]!==DT.WALL)||(x<DUNG_W-1&&dungMap[z][x+1]!==DT.WALL);
    if(!hasFN) continue;
    const tl=w2c(x,z),tr=w2c(x+1,z),br=w2c(x+1,z+1),bl=w2c(x,z+1);
    const lum=_dungTileLight(x+.5,z+.5)*pulse;

    // ── Верхняя (крышная) грань стены ──
    ctx.beginPath();ctx.moveTo(tl.cx,tl.cy+wallH);ctx.lineTo(tr.cx,tr.cy+wallH);ctx.lineTo(tr.cx,tr.cy);ctx.lineTo(tl.cx,tl.cy);ctx.closePath();
    ctx.fillStyle=ar.wallTop;ctx.fill();
    // Кирпичные швы на крыше
    ctx.strokeStyle="rgba(0,0,0,.35)"; ctx.lineWidth=0.8;
    for(let bi=1;bi<=2;bi++){
      const frac=bi/3;
      ctx.beginPath();
      ctx.moveTo(tl.cx+(tr.cx-tl.cx)*frac, tl.cy+(tr.cy-tl.cy)*frac+wallH);
      ctx.lineTo(tl.cx+(tr.cx-tl.cx)*frac, tl.cy+(tr.cy-tl.cy)*frac);
      ctx.stroke();
    }

    // ── Передняя (фронтальная) грань ──
    if(z<DUNG_H-1&&dungMap[z+1][x]!==DT.WALL){
      ctx.beginPath();ctx.moveTo(bl.cx,bl.cy);ctx.lineTo(br.cx,br.cy);ctx.lineTo(br.cx,br.cy+wallH);ctx.lineTo(bl.cx,bl.cy+wallH);ctx.closePath();
      ctx.fillStyle=ar.wallFace;ctx.fill();
      if(lum>0.04){ctx.globalAlpha=lum*.32;ctx.fillStyle=ar.torchColor;ctx.fill();ctx.globalAlpha=1;}
      // кирпичные горизонтальные швы
      const brickH=wallH/4;
      ctx.strokeStyle="rgba(0,0,0,.4)"; ctx.lineWidth=0.9;
      for(let bi=1;bi<4;bi++){
        const fy=bi*brickH;
        const lerp=function(a,b,t){return a+(b-a)*t;};
        ctx.beginPath();
        ctx.moveTo(lerp(bl.cx,br.cx,0), lerp(bl.cy,br.cy,0)+fy);
        ctx.lineTo(lerp(bl.cx,br.cx,1), lerp(bl.cy,br.cy,1)+fy);
        ctx.stroke();
      }
      // вертикальный шов (кирпичная кладка в шахмату)
      ctx.strokeStyle="rgba(0,0,0,.25)"; ctx.lineWidth=0.7;
      for(let bi=0;bi<4;bi++){
        const fy0=bi*brickH, fy1=(bi+1)*brickH;
        const offX=(bi%2===0)?0.5:0;
        const lerp=function(a,b,t){return a+(b-a)*t;};
        ctx.beginPath();
        ctx.moveTo(lerp(bl.cx,br.cx,offX), lerp(bl.cy,br.cy,offX)+fy0);
        ctx.lineTo(lerp(bl.cx,br.cx,offX), lerp(bl.cy,br.cy,offX)+fy1);
        ctx.stroke();
      }
      ctx.strokeStyle="rgba(255,255,255,.07)";ctx.lineWidth=.7;
      ctx.beginPath();ctx.moveTo(bl.cx,bl.cy);ctx.lineTo(br.cx,br.cy);ctx.lineTo(br.cx,br.cy+wallH);ctx.lineTo(bl.cx,bl.cy+wallH);ctx.closePath();ctx.stroke();
    }
    // ── Боковая (правая) грань ──
    if(x<DUNG_W-1&&dungMap[z][x+1]!==DT.WALL){
      ctx.beginPath();ctx.moveTo(tr.cx,tr.cy);ctx.lineTo(br.cx,br.cy);ctx.lineTo(br.cx,br.cy+wallH);ctx.lineTo(tr.cx,tr.cy+wallH);ctx.closePath();
      ctx.fillStyle=ar.wallSide;ctx.fill();
      if(lum>0.04){ctx.globalAlpha=lum*.26;ctx.fillStyle=ar.torchColor;ctx.fill();ctx.globalAlpha=1;}
      // горизонтальные швы на боку
      const brickH=wallH/4;
      ctx.strokeStyle="rgba(0,0,0,.3)"; ctx.lineWidth=0.8;
      for(let bi=1;bi<4;bi++){
        const fy=bi*brickH;
        const lerp=function(a,b,t){return a+(b-a)*t;};
        ctx.beginPath();
        ctx.moveTo(lerp(tr.cx,br.cx,0), lerp(tr.cy,br.cy,0)+fy);
        ctx.lineTo(lerp(tr.cx,br.cx,1), lerp(tr.cy,br.cy,1)+fy);
        ctx.stroke();
      }
      ctx.strokeStyle="rgba(255,255,255,.04)";ctx.lineWidth=.5;
      ctx.beginPath();ctx.moveTo(tr.cx,tr.cy);ctx.lineTo(br.cx,br.cy);ctx.lineTo(br.cx,br.cy+wallH);ctx.lineTo(tr.cx,tr.cy+wallH);ctx.closePath();ctx.stroke();
    }
    // ── Угловой пилляр (ребро) ──
    if((z<DUNG_H-1&&dungMap[z+1][x]!==DT.WALL)&&(x<DUNG_W-1&&dungMap[z][x+1]!==DT.WALL)){
      const pw=4;
      ctx.save(); ctx.fillStyle=ar.pillarColor||"#060e1a";
      ctx.beginPath(); ctx.moveTo(br.cx-pw*.7,br.cy); ctx.lineTo(br.cx+pw*.7,br.cy); ctx.lineTo(br.cx+pw*.7,br.cy+wallH); ctx.lineTo(br.cx-pw*.7,br.cy+wallH); ctx.closePath(); ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,.12)"; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
    }
  }

  // ── ФАКЕЛЫ ──────────────────────────────────────
  _dungLights.forEach(function(tl){
    const p=w2c(tl.wx,tl.wz,.4);
    const d=player?Math.hypot(tl.wx-player.wx,tl.wz-player.wz):99;
    const fp=0.7+0.3*Math.sin(_torchT*.006+tl.wx);
    ctx.save();
    const gw=ctx.createRadialGradient(p.cx,p.cy,0,p.cx,p.cy,50*fp);
    gw.addColorStop(0,ar.torchGlow+(0.2*fp)+')');gw.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gw;ctx.fillRect(p.cx-55,p.cy-55,110,110);
    ctx.fillStyle=ar.torchColor;ctx.shadowColor=ar.torchColor;ctx.shadowBlur=14;ctx.globalAlpha=fp;
    ctx.beginPath();ctx.ellipse(p.cx,p.cy,3,7*fp,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff";ctx.globalAlpha=fp*.45;
    ctx.beginPath();ctx.ellipse(p.cx,p.cy,1.5,4*fp,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });

}

function drawDungHUD(){
  const W=arena.width,H=arena.height;
  ctx.save();
  ctx.fillStyle="rgba(0,0,0,.6)";
  ctx.beginPath();if(ctx.roundRect)ctx.roundRect(W/2-90,8,180,34,10);else ctx.rect(W/2-90,8,180,34);ctx.fill();
  ctx.font="bold 15px Cinzel,serif";ctx.textAlign="center";ctx.fillStyle="#f4be5f";
  ctx.shadowColor="#f4be5f";ctx.shadowBlur=10;
  ctx.fillText("Этаж "+dungFloor+" / "+MAX_DUNGEON_FLOOR,W/2,30);ctx.shadowBlur=0;
  const alive=monsters.filter(function(m){return !m.dead;}).length;
  if(alive>0){
    ctx.fillStyle="rgba(0,0,0,.5)";
    ctx.beginPath();if(ctx.roundRect)ctx.roundRect(W/2-70,48,140,24,8);else ctx.rect(W/2-70,48,140,24);ctx.fill();
    ctx.font="13px Manrope,sans";ctx.fillStyle="#ff8866";
    ctx.fillText("Врагов: "+alive,W/2,65);
  } else if(monsters.length>0&&!dungExitOpen){
    dungExitOpen=true;
    announce("Все повержены! Найди выход 🚪");
    addLog("Все враги убиты — ищи лестницу вниз!","good");
    screenShake(8,300);
  }
  if(dungExitOpen&&!dungTransition){
    const pulse=0.55+0.45*Math.sin(_torchT*.005);
    ctx.globalAlpha=pulse;ctx.font="bold 13px Manrope,sans";ctx.fillStyle="#88ffcc";
    ctx.fillText("▼ Спустись вниз",W/2,H-20);ctx.globalAlpha=1;
  }
  if(dungTransition){
    dungTransT+=16;const a=Math.min(1,dungTransT/900);
    ctx.fillStyle="rgba(0,0,0,"+a+")";ctx.fillRect(0,0,W,H);
    if(a>.45){
      ctx.font="bold 30px Cinzel,serif";ctx.textAlign="center";ctx.fillStyle="#f4be5f";
      ctx.shadowColor="#f4be5f";ctx.shadowBlur=20;
      ctx.fillText(dungFloor>=MAX_DUNGEON_FLOOR?"ПОБЕДА!":"Этаж "+(dungFloor+1),W/2,H/2);
      ctx.shadowBlur=0;
    }
  }
  // ── Подсказка управления камерой (fade-out за 6 сек) ──
  if(!_dungHUDTimer) _dungHUDTimer=performance.now();
  const _hintAge=(performance.now()-_dungHUDTimer)/1000;
  if(_hintAge<7){
    const _ha=Math.max(0,1-(_hintAge-5)/2);
    ctx.save(); ctx.globalAlpha=_ha*0.75;
    ctx.fillStyle="rgba(0,0,0,.6)";
    ctx.beginPath(); if(ctx.roundRect)ctx.roundRect(8,H-80,260,68,8); else ctx.rect(8,H-80,260,68); ctx.fill();
    ctx.font="12px Manrope,sans"; ctx.fillStyle="#ccddf5"; ctx.textAlign="left";
    ctx.fillText("ПКМ / Средняя кнопка — тащить камеру",18,H-60);
    ctx.fillText("C — режимы: Сверху / Сзади / Изометрия",18,H-44);
    ctx.fillText("[ ] или колесо — приближение камеры",18,H-28);
    ctx.restore();
  }
  // ── Миникарта подземелья (правый верхний угол) ──
  const MS=4, MX=W-DUNG_W*MS-12, MY=58;
  ctx.globalAlpha=0.72;
  ctx.fillStyle="rgba(0,0,0,.65)";
  ctx.fillRect(MX-3,MY-3,DUNG_W*MS+6,DUNG_H*MS+6);
  for(let z=0;z<DUNG_H;z++){
    for(let x=0;x<DUNG_W;x++){
      const t=dungMap[z][x];
      if(t===DT.WALL) continue;
      ctx.fillStyle=t===DT.EXIT?(dungExitOpen?"#55ffaa":"#223333"):t===DT.ENTRY?"#88aaff":t===DT.CORR?"#334":"#446";
      ctx.fillRect(MX+x*MS,MY+z*MS,MS,MS);
      // лестница на миникарте: ▼
      if(t===DT.EXIT&&dungExitOpen){
        ctx.save();ctx.fillStyle="#55ffaa";ctx.font="bold 7px sans-serif";ctx.textAlign="center";
        ctx.fillText("▼",MX+x*MS+MS/2,MY+z*MS+MS);ctx.restore();
      }
    }
  }
  // посещённые комнаты ярче
  dungRooms.forEach(function(r){
    if(!r.visited) return;
    ctx.fillStyle="rgba(100,160,255,0.35)";
    ctx.fillRect(MX+r.x*MS,MY+r.y*MS,r.w*MS,r.h*MS);
  });
  // игрок на миникарте
  if(player){
    ctx.fillStyle="#ffe866";
    ctx.beginPath();
    ctx.arc(MX+player.wx*MS,MY+player.wz*MS,MS*.8,0,Math.PI*2);
    ctx.fill();
  }
  // выход мигает
  const ep=0.5+0.5*Math.sin(_torchT*.008);
  ctx.fillStyle="rgba(80,255,170,"+ep+")";
  ctx.beginPath();
  ctx.arc(MX+dungExit.wx*MS,MY+dungExit.wz*MS,MS,0,Math.PI*2);
  ctx.fill();
  ctx.globalAlpha=1;
  ctx.restore();
}

// ══ РИСОВАНИЕ ПОЛА И СТЕН (3D) ══════════════════════
const TORCH_LOCS=[[0,0],[0,AD/2],[0,AD-1],[AW/2,0],[AW-1,0],[AW-1,AD-1]];
let _torchT=0;

function _tileLight(x,z){
  // возвращает 0..1 — освещённость тайла от факелов
  let lum=0;
  TORCH_LOCS.forEach(function(tl){
    const d=Math.hypot(x-tl[0],z-tl[1]);
    lum+=Math.max(0,1-d/7)*.6;
  });
  return Math.min(1,lum);
}

function _blendHex(c1,c2,t){
  // быстрый lerp двух hex-цветов
  const p=function(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]};
  const a=p(c1),b=p(c2);
  const r=Math.round(a[0]+(b[0]-a[0])*t);
  const g=Math.round(a[1]+(b[1]-a[1])*t);
  const bv=Math.round(a[2]+(b[2]-a[2])*t);
  return'rgb('+r+','+g+','+bv+')';
}

function drawFloor(){
  const ar=currentArena;
  const pulseTorch=0.85+0.15*Math.sin(_torchT*.0025);
  for(let z=0;z<AD;z++) for(let x=0;x<AW;x++){
    const tl=w2c(x,z), tr=w2c(x+1,z), br=w2c(x+1,z+1), bl=w2c(x,z+1);
    // базовый цвет тайла
    const base=ar.floorColors[(x+z*3)%5];
    ctx.beginPath();
    ctx.moveTo(tl.cx,tl.cy); ctx.lineTo(tr.cx,tr.cy);
    ctx.lineTo(br.cx,br.cy); ctx.lineTo(bl.cx,bl.cy); ctx.closePath();
    ctx.fillStyle=base; ctx.fill();
    // освещение от факелов (динамическое)
    const lum=_tileLight(x+.5,z+.5)*pulseTorch;
    if(lum>0.05){
      ctx.globalAlpha=lum*.45;
      ctx.fillStyle=ar.torchColor;
      ctx.fill();
      ctx.globalAlpha=1;
    }
    // линии сетки
    ctx.strokeStyle="rgba(255,255,255,.05)"; ctx.lineWidth=.6; ctx.stroke();
    // угловое затенение (ambient occlusion)
    if(x===0||z===0||x===AW-1||z===AD-1){
      ctx.globalAlpha=.25; ctx.fillStyle="#000";
      ctx.beginPath();
      ctx.moveTo(tl.cx,tl.cy); ctx.lineTo(tr.cx,tr.cy);
      ctx.lineTo(br.cx,br.cy); ctx.lineTo(bl.cx,bl.cy); ctx.closePath();
      ctx.fill(); ctx.globalAlpha=1;
    }
  }
  // рёбра пола — тонкая яркая линия сверху (bevel)
  ctx.strokeStyle=ar.wallAccent||"#2244aa"; ctx.lineWidth=1.2; ctx.globalAlpha=.18;
  ctx.beginPath();
  const c00=w2c(0,0),cAW=w2c(AW,0),c0AD=w2c(0,AD);
  ctx.moveTo(c00.cx,c00.cy); ctx.lineTo(cAW.cx,cAW.cy);
  ctx.moveTo(c00.cx,c00.cy); ctx.lineTo(c0AD.cx,c0AD.cy);
  ctx.stroke(); ctx.globalAlpha=1;
}

function drawWalls(){
  const ar=currentArena;
  const h=ISO*(ar.wallHeight||2.2);
  const pulseTorch=0.85+0.15*Math.sin(_torchT*.0025);

  // ━━ Левая стена (Z-ось, x=0) ━━
  for(let z=0;z<AD;z++){
    const t=w2c(0,z), b=w2c(0,z+1);
    const lum=_tileLight(0,z+.5)*pulseTorch;

    // Боковая грань (темнее)
    ctx.beginPath(); ctx.moveTo(t.cx,t.cy); ctx.lineTo(b.cx,b.cy);
    ctx.lineTo(b.cx,b.cy+h); ctx.lineTo(t.cx,t.cy+h); ctx.closePath();
    ctx.fillStyle=ar.wallSide; ctx.fill();
    // подсветка факелом
    if(lum>0.05){ctx.globalAlpha=lum*.3;ctx.fillStyle=ar.torchColor;ctx.fill();ctx.globalAlpha=1;}
    // рёбра
    ctx.strokeStyle="rgba(255,255,255,.06)"; ctx.lineWidth=.7; ctx.stroke();

    // Верхняя грань (немного светлее)
    const tx=[t.cx,b.cx,b.cx,t.cx];
    const ty=[t.cy,b.cy,b.cy+h,t.cy+h];
    // горизонтальная верхушка стены
    const depthX=ISO*0.5, depthY=ISO*0.25;
    ctx.beginPath();
    ctx.moveTo(t.cx,t.cy+h); ctx.lineTo(b.cx,b.cy+h);
    ctx.lineTo(b.cx-depthX,b.cy+h-depthY); ctx.lineTo(t.cx-depthX,t.cy+h-depthY); ctx.closePath();
    ctx.fillStyle=ar.wallTop; ctx.fill();
    if(lum>0.05){ctx.globalAlpha=lum*.2;ctx.fillStyle=ar.torchColor;ctx.fill();ctx.globalAlpha=1;}
    ctx.strokeStyle="rgba(255,255,255,.07)"; ctx.lineWidth=.5; ctx.stroke();

    // Передняя грань
    ctx.beginPath();
    ctx.moveTo(t.cx-depthX,t.cy+h-depthY); ctx.lineTo(b.cx-depthX,b.cy+h-depthY);
    ctx.lineTo(b.cx-depthX,b.cy-depthY); ctx.lineTo(t.cx-depthX,t.cy-depthY); ctx.closePath();
    ctx.fillStyle=ar.wallFace; ctx.fill();
    if(lum>0.05){ctx.globalAlpha=lum*.4;ctx.fillStyle=ar.torchColor;ctx.fill();ctx.globalAlpha=1;}
    ctx.strokeStyle="rgba(255,255,255,.04)"; ctx.lineWidth=.5; ctx.stroke();
  }

  // ━━ Передняя стена (X-ось, z=AD) ━━
  for(let x=0;x<AW;x++){
    const l=w2c(x,AD), r=w2c(x+1,AD);
    const lum=_tileLight(x+.5,AD)*pulseTorch;

    ctx.beginPath(); ctx.moveTo(l.cx,l.cy); ctx.lineTo(r.cx,r.cy);
    ctx.lineTo(r.cx,r.cy+h); ctx.lineTo(l.cx,l.cy+h); ctx.closePath();
    ctx.fillStyle=ar.wallFace; ctx.fill();
    if(lum>0.05){ctx.globalAlpha=lum*.35;ctx.fillStyle=ar.torchColor;ctx.fill();ctx.globalAlpha=1;}
    ctx.strokeStyle="rgba(255,255,255,.05)"; ctx.lineWidth=.7; ctx.stroke();

    // верхушка
    const depthX=-ISO*0.5, depthY=-ISO*0.25;
    ctx.beginPath();
    ctx.moveTo(l.cx,l.cy+h); ctx.lineTo(r.cx,r.cy+h);
    ctx.lineTo(r.cx-depthX,r.cy+h+depthY); ctx.lineTo(l.cx-depthX,l.cy+h+depthY); ctx.closePath();
    ctx.fillStyle=ar.wallTop; ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,.07)"; ctx.lineWidth=.5; ctx.stroke();
  }

  // ━━ Угловые колонны (пиллары) ━━
  [[0,0],[0,AD],[AW,0],[AW,AD]].forEach(function(corner){
    const p=w2c(corner[0],corner[1]);
    const pr=8, ph=h+8;
    ctx.save();
    ctx.fillStyle=ar.pillarColor||"#0f1d35";
    ctx.shadowColor=ar.torchColor; ctx.shadowBlur=12*pulseTorch;
    // столб
    ctx.beginPath(); ctx.ellipse(p.cx,p.cy+ph*.35,pr*.8,pr*.3,0,0,Math.PI*2); ctx.fill();
    ctx.fillRect(p.cx-pr*.7,p.cy-ph*.65,pr*1.4,ph);
    // капитель
    ctx.fillStyle=ar.wallAccent; ctx.globalAlpha=.6;
    ctx.fillRect(p.cx-pr,p.cy-ph*.65-4,pr*2,5);
    ctx.globalAlpha=1;
    ctx.restore();
  });

  // ━━ Факелы с анимацией ━━
  const flamePulse=0.7+0.3*Math.sin(_torchT*.006);
  TORCH_LOCS.forEach(function(tl){
    if(tl[0]!==0&&tl[1]!==0&&tl[0]!==AW&&tl[1]!==AD&&tl[0]!==AW/2&&tl[1]!==AD/2) return;
    const wall_pts=[];
    // только угловые и средние торцы стен
    const p=w2c(tl[0]===0?0:tl[0],tl[1]);
    ctx.save();
    // ореол
    const glow=ctx.createRadialGradient(p.cx,p.cy-h*.4,0,p.cx,p.cy-h*.4,60*flamePulse);
    glow.addColorStop(0,ar.torchGlow+(0.22*flamePulse)+')');
    glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow;
    ctx.beginPath(); ctx.arc(p.cx,p.cy-h*.4,60*flamePulse,0,Math.PI*2); ctx.fill();
    // факел-держатель
    ctx.fillStyle=ar.wallAccent; ctx.globalAlpha=.8;
    ctx.fillRect(p.cx-2,p.cy-h*.5+2,4,12);
    // огонь
    ctx.globalAlpha=flamePulse;
    ctx.fillStyle=ar.torchColor;
    ctx.shadowColor=ar.torchColor; ctx.shadowBlur=18;
    ctx.beginPath();
    ctx.ellipse(p.cx,p.cy-h*.5-4,4,7*flamePulse,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.globalAlpha=flamePulse*.4;
    ctx.beginPath(); ctx.ellipse(p.cx,p.cy-h*.5-5,2,4*flamePulse,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

// ══ КЛАСС ЮНИТА ════════════════════════════════════
class Unit {
  constructor(o){
    this.name=o.name||"?"; this.role=o.role||"unit";
    this.wx=o.wx!=null?o.wx:3; this.wz=o.wz!=null?o.wz:3; this.wy=0;
    this.portrait=o.portrait||"";
    this.spriteKey=o.spriteKey||null;
    this.hp=o.hp||100; this.maxHp=o.hp||100;
    this.mp=o.mp||0; this.maxMp=o.mp||0;
    this.resourceType=o.resourceType||"mana";
    this.spd=o.spd||3; this.atk=o.atk||[15,22];
    this.atkRange=o.atkRange||1.2; this.atkCd=o.atkCd||900;
    this.atkTimer=rnd(0,o.atkCd||900);
    this.color=o.color||"#73a5ff"; this.isHero=!!o.isHero; this.isP2=!!o.isP2;
    this.r=o.r||22; this.facing=(this.isHero||this.isP2)?1:-1;
    this.walkP=0; this.state="idle"; this.atkAnim=0;
    this.attackSide=Math.random()<.5?-1:1;
    this.attackHand="right";
    this.dualStrikeT=0;
    this.flashT=0; this.flashC="#fff";
    this.dead=false; this.poisonTicks=0; this.poisonDmg=0; this.poisonTimer=0;
    this.dodgeTimer=0; this.dodgeCd=0; this.dodgeVx=0; this.dodgeVz=0;
    this.comboCount=0; this.comboTimer=0;
    this.ab1Cd=0; this.ab1Max=o.ab1Max||5000;
    this.ab2Cd=0; this.ab2Max=o.ab2Max||8000;
    this.ab3Cd=0; this.ab3Max=o.ab3Max||9000;
    this.ab4Cd=0; this.ab4Max=o.ab4Max||12000;
    this.weaponCd=0; this.weaponMax=o.weaponMax||10000;
    this.level=1; this.xp=0; this.xpNext=100;
    this.isBoss=o.isBoss||false;
    this.burnTimer=0;this.burnDmg=0;this.burnTick=0;
    this.freezeTimer=0;this.freezeMult=1;
    this.stunTimer=0;
  }
  get enemy(){
    if(this.isHero||this.isP2) return monsters;
    const h=[];
    if(player&&!player.dead) h.push(player);
    if(player2&&!player2.dead) h.push(player2);
    return h;
  }
  closest(){
    let best=null,bd=Infinity;
    for(const u of this.enemy){ if(!u||u.dead)continue; const d=dist2(this,u); if(d<bd){bd=d;best=u;} }
    return best;
  }
  hit(amount, attacker){
    if(this.dodgeTimer>0) return;
    // Passive: damage reduction (iron_skin, stone_skin, ice_armor)
    if(this._dmgReduce) amount=Math.max(1,Math.floor(amount*(1-this._dmgReduce)));
    this.hp=clamp(this.hp-amount,0,this.maxHp);
    this.flashT=performance.now()+200;
    this.flashC=(this.isHero||this.isP2)?"#ff4444":"#ffee44";
    // Passive: thorns/fire_shield — reflect damage to attacker
    if(attacker&&!attacker.dead){
      if(this._thorns) attacker.hit(Math.floor(amount*this._thorns));
      if(this._fireShield){
        attacker.hit(Math.floor(amount*0.35));
        const sc=w2c(attacker.wx,attacker.wz,.5);
        parts(sc.cx,sc.cy,"#ff6600",6,2);
      }
    }
    if(this.hp<=0){this.dead=true;onDeath(this);}
  }
  gainXp(amount){
    // Прокачка героя происходит в профиле, а не в бою.
    return amount;
  }
  startDodge(){
    if(this.dodgeCd>0||this.dead) return;
    this.dodgeVx=this.facing*2.8; this.dodgeVz=0;
    if(keys["KeyS"]||keys["ArrowDown"]||(this.isP2&&keys["KeyK"])) this.dodgeVz=2.8;
    if(keys["KeyW"]||keys["ArrowUp"]  ||(this.isP2&&keys["KeyI"])) this.dodgeVz=-2.8;
    this.dodgeTimer=300; this.dodgeCd=1200;
    const p=w2c(this.wx,this.wz,.5); parts(p.cx,p.cy,"#88bbff",8,3);
  }
  doSwing(t){
    const base=rndI(this.atk[0],this.atk[1]);
    this.attackSide*= -1;
    this.attackHand=this.attackHand==="right"?"left":"right";
    this.comboCount=Math.min(3,(this.comboCount||0)+1);
    this.comboTimer=1200;
    const mult=(this.comboCount>=3)?(this._comboMult||2.2):1;
    const dmg=(this.comboCount>=3)?Math.floor(base*mult):base;
    if(this.comboCount>=3){
      this.dualStrikeT=430;
      screenShake(12,220);
      const step=this.facing*0.34;
      const nx=this.wx+step;
      if(gameState==="dungeon"){
        if(dungWalkable(nx,this.wz)) this.wx=nx;
      } else {
        this.wx=clamp(nx,.25,AW-.25);
      }
      this.comboCount=0;
      const p=w2c(this.wx,this.wz,.8);
      parts(p.cx,p.cy,"#f4be5f",18,5);
      dmgt(p.cx,p.cy,"КОМБО!","#f4be5f");
      addLog(this.name+" — КОМБО-УДАР!","good");
      _comboAchiev=true;
    }
    dealDmg(this,t,dmg);
    if(this.dualStrikeT>360&&t&&!t.dead){
      dealDmg(this,t,Math.floor(dmg*0.55));
      const tp=w2c(t.wx,t.wz,.8);
      parts(tp.cx,tp.cy,"#d7ebff",9,4);
    }
  }
  aiUpdate(dt){
    if(this.dead)return;
    // статусы
    if(this.burnTimer>0){this.burnTimer-=dt;this.burnTick-=dt;if(this.burnTick<=0){this.burnTick=600;if(!this.dead){this.hit(this.burnDmg);var bs=w2c(this.wx,this.wz,.5);parts(bs.cx,bs.cy,"#ff8822",4,2);}}}
    if(this.freezeTimer>0){this.freezeTimer-=dt;this.freezeMult=0.45;}else{this.freezeMult=1;}
    if(this.stunTimer>0){this.stunTimer-=dt;this.state="idle";return;}
    if(!battleActive){
      if(player) this.facing=player.wx>this.wx?1:-1;
      this.state="idle"; return;
    }
    this.atkTimer=Math.max(0,this.atkTimer-dt);
    if(this.atkAnim>0) this.atkAnim=Math.max(0,this.atkAnim-dt/280);
    if(this.dualStrikeT>0) this.dualStrikeT=Math.max(0,this.dualStrikeT-dt);
    const t=this.closest(); if(!t){this.state="idle";return;}
    const d=dist2(this,t); this.facing=t.wx>this.wx?1:-1;
    if(d<=this.atkRange){
      this.state="attack";
      if(this.atkTimer===0){
        this.atkTimer=this.atkCd; this.atkAnim=1;
        dealDmg(this,t,rndI(this.atk[0],this.atk[1]));
        if(this.isBoss==="dragon"&&(t.isHero||t.isP2)){t.burnTimer=3000;t.burnDmg=rndI(8,15);t.burnTick=600;const bs=w2c(t.wx,t.wz,.5);parts(bs.cx,bs.cy,"#ff8822",6,3);addLog("Рагнар горит!","bad");}
        if(this.isBoss==="necromancer"&&(t.isHero||t.isP2)){t.freezeTimer=2500;const fs=w2c(t.wx,t.wz,.5);parts(fs.cx,fs.cy,"#88ddff",6,2);addLog(t.name+" заморожен!","bad");}
        if(this.isBoss==="giant"&&(t.isHero||t.isP2)&&rnd(0,1)<0.3){t.stunTimer=800;addLog(t.name+" оглушён!","bad");screenShake(14,300);}
      }
    } else {
      this.state="move";
      const dx=t.wx-this.wx, dz=t.wz-this.wz, l=Math.hypot(dx,dz)||1;
      const s=this.spd*(dt/1000);
      const nwx=this.wx+dx/l*s, nwz=this.wz+dz/l*s;
      if(gameState==="dungeon"){
        if(dungWalkable(nwx,nwz)){ this.wx=nwx; this.wz=nwz; }
        else if(dungWalkable(nwx,this.wz)) this.wx=nwx;
        else if(dungWalkable(this.wx,nwz)) this.wz=nwz;
      } else {
        this.wx=clamp(nwx,.2,AW-.2); this.wz=clamp(nwz,.2,AD-.2);
      }
      this.walkP+=dt*.008;
    }
  }

  draw(){
    const {cx,cy}=w2c(this.wx,this.wz,this.wy);
    const bob=(this.state==="move")?Math.sin(this.walkP)*2.5:0;
    const atkPhase=this.atkAnim>0?(1-this.atkAnim):0;
    const attackArc=this.atkAnim>0?Math.sin(atkPhase*Math.PI):0;
    const recoil=this.atkAnim>0?Math.sin(atkPhase*Math.PI*2):0;
    const finPhase=this.dualStrikeT>0?(this.dualStrikeT/430):0;
    const finLunge=finPhase*finPhase;
    const aoff=(this.atkAnim*5+attackArc*8+finLunge*12-Math.max(0,-recoil)*2)*this.facing;
    const bodyRise=-attackArc*2.4;
    const bodyTilt=(this.attackSide||1)*this.facing*attackArc*0.09 + recoil*0.03*this.facing + finLunge*0.05*this.facing;
    const flash=performance.now()<this.flashT;
    const s=this.r/22;
    const unitScale=(gameState==="dungeon"&&dungZoom>0)?(1/dungZoom):1;

    ctx.save();
    if(unitScale!==1){
      ctx.translate(cx,cy);
      ctx.scale(unitScale,unitScale);
      ctx.translate(-cx,-cy);
    }

    // тень 3D: мягкое пятно с размытием
    ctx.save(); ctx.globalAlpha=.38; ctx.shadowColor="#000"; ctx.shadowBlur=18;
    ctx.fillStyle="rgba(0,0,0,.55)";
    ctx.beginPath(); ctx.ellipse(cx,cy+this.r*.6,this.r*1.1,this.r*.32,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=.15; ctx.fillStyle="#000";
    ctx.beginPath(); ctx.ellipse(cx,cy+this.r*.6,this.r*1.6,this.r*.5,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    if(this.dodgeTimer>0){
      ctx.save(); ctx.globalAlpha=.28; ctx.fillStyle="#88bbff";
      ctx.beginPath(); ctx.ellipse(cx-this.facing*18,cy,this.r*.7,this.r*.3,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    ctx.save();
    if(this.dead) ctx.globalAlpha=.3;
    ctx.translate(cx+aoff,cy+bob+bodyRise);
    ctx.rotate(bodyTilt);
    if(this.isHero&&this.role==="Мечник")       this._ragnar(0,0,s,flash);
    else if(this.isHero&&this.role==="Убийца")  this._assassin(0,0,s,flash);
    else if(this.isHero&&this.role==="Маг")     this._mage(0,0,s,flash);
    else if(this.isP2)                           this._p2body(0,0,s,flash);
    else if(this.isBoss==="dragon")            this._dragon(0,0,s,flash);
    else if(this.isBoss==="necromancer")       this._necromancer(0,0,s,flash);
    else if(this.isBoss==="giant")             this._giant(0,0,s,flash);
    else if(this.isBoss==="blackwolf")         this._blackWolf(0,0,s,flash);
    else if(this.isBoss==="giantWolf")         this._giantWolf(0,0,s,flash);
    else                                        this._wolf(0,0,s,flash);
    ctx.restore();
    if(!this.dead) this._hpbar(cx,cy-this.r*2.1-6);
    if(!this.dead) drawArtPortrait(ctx,cx-this.r*1.35,cy-this.r*2.85,18+s*6,18+s*6,getUnitArtKey(this),.98);

    // иконки статусов
    if(!this.dead){
      var sicons=[];
      if(this.poisonTicks>0) sicons.push({i:'☠',c:'#44ff44'});
      if(this.burnTimer>0)   sicons.push({i:'🔥',c:'#ff8844'});
      if(this.freezeTimer>0) sicons.push({i:'❄',c:'#88ddff'});
      if(this.stunTimer>0)   sicons.push({i:'💫',c:'#ffff44'});
      if(sicons.length){
        ctx.save(); ctx.font='13px sans-serif'; ctx.textAlign='center';
        sicons.forEach(function(ic,i){
          ctx.fillStyle=ic.c; ctx.shadowColor=ic.c; ctx.shadowBlur=7;
          ctx.fillText(ic.i,cx-12*(sicons.length-1)/2+i*13,cy-this_.r*2.5-24);
        }.bind({this_:this}));
        ctx.restore();
      }
    }
    if((this.isHero||this.isP2)&&this.comboCount>0&&!this.dead){
      ctx.save(); ctx.font="bold 13px Manrope"; ctx.textAlign="center";
      ctx.fillStyle="#f4be5f"; ctx.shadowColor="#000"; ctx.shadowBlur=4;
      ctx.fillText("●".repeat(this.comboCount),cx,cy-this.r*2.4-18); ctx.restore();
    }
    ctx.restore();
  }

  // ── РАГНАР ─────────────────────────────────────
  _ragnar(cx,cy,s,fl){
    const f=this.facing;
    const walk=(this.state==="move")?Math.sin(this.walkP):0;
    const walk2=(this.state==="move")?Math.cos(this.walkP*0.9):0;
    const atk=this.atkAnim;
    const atkPhase=atk>0?(1-atk):0;
    const strike=atk>0?Math.sin(atkPhase*Math.PI):0;
    const recoil=atk>0?Math.sin(atkPhase*Math.PI*2):0;
    const side=this.attackSide||1;
    const sc=s*1.18;
    const SKIN=fl?"#ffe5d2":"#efbf9e";
    const HAIR=fl?"#5c6d88":"#0a0d14";
    const HAIR_HI=fl?"#c7d6ff":"#1d2334";
    const ARMOR=fl?"#7d90b4":"#121722";
    const ARMOR_MID=fl?"#9ab2d8":"#1c2434";
    const ARMOR_EDGE=fl?"#dce9ff":"#4f6ea8";
    const ARMOR_GLOW=fl?"#e5f0ff":"#5a78c8";
    const CLOTH=fl?"#7e89ba":"#20263a";
    const STRAP=fl?"#b29f86":"#4e4034";
    const BLADE=fl?"#f6fbff":"#2b313d";
    const BLADE_HI=fl?"#ffffff":"#7f90b6";
    const LEAN=walk*0.09 + strike*0.16*side - Math.max(0,-recoil)*0.04;
    const chestY=-8*sc + walk2*1.2*sc;
    const hipY=9*sc + Math.max(0,recoil)*1.2*sc;
    const rightLeg=walk*11*sc - strike*8*sc + side*2.4*sc;
    const leftLeg=-walk*11*sc + strike*4*sc - side*1.6*sc;
    const rightArm=strike*27*sc + walk*5*sc + Math.max(0,-recoil)*8*sc;
    const leftArm=-strike*15*sc - walk*6*sc + side*1.4*sc;
    const capeSwing=walk*8*sc - strike*15*sc;
    const dual=this.dualStrikeT>0;
    const rightSwing=dual||this.attackHand!=="left";
    const leftSwing=dual||this.attackHand!=="right";

    ctx.save();
    ctx.translate(cx,cy);
    if(f<0) ctx.scale(-1,1);
    ctx.rotate(LEAN);

    // плащ и силуэт сзади
    ctx.fillStyle=CLOTH;
    ctx.beginPath();
    ctx.moveTo(-4*sc,-16*sc);
    ctx.quadraticCurveTo(-25*sc+capeSwing,-2*sc,-20*sc+capeSwing,32*sc);
    ctx.quadraticCurveTo(-2*sc+capeSwing*.35,26*sc,8*sc,4*sc);
    ctx.lineTo(10*sc,-8*sc);
    ctx.quadraticCurveTo(4*sc,-16*sc,-4*sc,-16*sc);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle=fl?"rgba(255,255,255,.18)":"rgba(110,135,210,.16)";
    ctx.beginPath();
    ctx.moveTo(-2*sc,-13*sc);
    ctx.quadraticCurveTo(-16*sc+capeSwing*.7,0,-11*sc+capeSwing*.45,24*sc);
    ctx.quadraticCurveTo(-2*sc+capeSwing*.2,18*sc,3*sc,2*sc);
    ctx.lineTo(5*sc,-9*sc);
    ctx.closePath();
    ctx.fill();

    // ноги
    ctx.strokeStyle=ARMOR; ctx.lineWidth=6.4*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(4*sc,hipY); ctx.lineTo(8*sc+rightLeg*.30,24*sc); ctx.lineTo(10*sc+rightLeg*.42,31*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2*sc,hipY); ctx.lineTo(-7*sc+leftLeg*.28,24*sc); ctx.lineTo(-8*sc+leftLeg*.38,31*sc); ctx.stroke();
    ctx.fillStyle=ARMOR_MID;
    [[8*sc+rightLeg*.30,24*sc],[-7*sc+leftLeg*.28,24*sc]].forEach(function(p){
      ctx.beginPath(); ctx.ellipse(p[0],p[1],4.8*sc,3.2*sc,0,0,Math.PI*2); ctx.fill();
    });
    ctx.fillStyle="#0a0d13";
    [[10*sc+rightLeg*.42,31*sc],[-8*sc+leftLeg*.38,31*sc]].forEach(function(p){
      ctx.beginPath(); ctx.ellipse(p[0]+1.4*sc,p[1]+.8*sc,5.6*sc,2.2*sc,.12,0,Math.PI*2); ctx.fill();
    });

    // таз и ремни
    ctx.fillStyle=STRAP;
    rrPath(ctx,-10*sc,8*sc,20*sc,6*sc,2*sc); ctx.fill();
    ctx.fillStyle=fl?"#f1f3fa":"#202734";
    rrPath(ctx,-1.8*sc,8.8*sc,4.2*sc,4.2*sc,1.2*sc); ctx.fill();
    ctx.strokeStyle=fl?"#7c8596":"#5e6470"; ctx.lineWidth=1*sc;
    ctx.strokeRect(-0.4*sc,9.9*sc,1.2*sc,2.1*sc);
    ctx.strokeStyle=STRAP; ctx.lineWidth=2*sc;
    ctx.beginPath(); ctx.moveTo(-7*sc,-10*sc); ctx.lineTo(8*sc,10*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2*sc,-11*sc); ctx.lineTo(-8*sc,12*sc); ctx.stroke();

    // торс и броня
    const chestGrad=ctx.createLinearGradient(0,-24*sc,0,16*sc);
    chestGrad.addColorStop(0,ARMOR_MID);
    chestGrad.addColorStop(.45,ARMOR);
    chestGrad.addColorStop(1,"#0b1018");
    ctx.fillStyle=chestGrad;
    rrPath(ctx,-11*sc,-15*sc,22*sc,30*sc,5*sc); ctx.fill();
    ctx.fillStyle=fl?"rgba(255,255,255,.2)":"rgba(108,134,214,.18)";
    for(let i=0;i<4;i++){
      rrPath(ctx,-7.5*sc+i*.5*sc,-10*sc+i*5.2*sc,15*sc-i*1.0*sc,4.2*sc,2*sc);
      ctx.fill();
    }
    ctx.fillStyle=ARMOR_EDGE;
    ctx.beginPath();
    ctx.moveTo(0,-10.5*sc); ctx.lineTo(3.8*sc,-4*sc); ctx.lineTo(0,2*sc); ctx.lineTo(-3.8*sc,-4*sc); ctx.closePath();
    ctx.shadowColor=ARMOR_GLOW; ctx.shadowBlur=fl?16:10; ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle="rgba(255,255,255,.08)"; ctx.lineWidth=.9*sc;
    rrPath(ctx,-11*sc,-15*sc,22*sc,30*sc,5*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-14*sc); ctx.lineTo(0,15*sc); ctx.stroke();

    // наплечники
    [[12*sc,-10*sc,-.35],[-12*sc,-10*sc,.35]].forEach(function(p){
      ctx.fillStyle=ARMOR;
      ctx.beginPath(); ctx.ellipse(p[0],p[1],7.4*sc,5.1*sc,p[2],0,Math.PI*2); ctx.fill();
      ctx.fillStyle=ARMOR_MID;
      ctx.beginPath(); ctx.ellipse(p[0],p[1]-1.2*sc,5.8*sc,2.6*sc,p[2],0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=ARMOR_EDGE; ctx.lineWidth=1*sc;
      ctx.beginPath(); ctx.ellipse(p[0],p[1],7.4*sc,5.1*sc,p[2],0,Math.PI*2); ctx.stroke();
    });

    // руки
    ctx.strokeStyle=ARMOR; ctx.lineWidth=5.4*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(10*sc,-8*sc); ctx.lineTo(16*sc+rightArm,2*sc+rightArm*.36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10*sc,-8*sc); ctx.lineTo(-15*sc+leftArm,2*sc-leftArm*.05); ctx.stroke();
    ctx.fillStyle="#0b0f16";
    ctx.beginPath(); ctx.arc(16*sc+rightArm,2*sc+rightArm*.36,3.8*sc,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-15*sc+leftArm,2*sc-leftArm*.05,3.8*sc,0,Math.PI*2); ctx.fill();

    // правый меч
    ctx.save();
    const rightArmX=18*sc+(rightSwing?rightArm:rightArm*.25);
    const rightArmY=-19*sc+(rightSwing?rightArm*.62:-2.2*sc);
    ctx.translate(rightArmX,rightArmY);
    ctx.rotate(.18+(rightSwing?atk*.72:0.08));
    ctx.fillStyle="#171c24"; rrPath(ctx,-2.1*sc,8*sc,4.2*sc,12*sc,1.6*sc); ctx.fill();
    ctx.fillStyle=ARMOR_EDGE; ctx.beginPath(); ctx.ellipse(0,8.5*sc,7.4*sc,2.4*sc,.12,0,Math.PI*2); ctx.fill();
    const bladeGrad=ctx.createLinearGradient(0,-31*sc,0,10*sc);
    bladeGrad.addColorStop(0,BLADE_HI); bladeGrad.addColorStop(.45,BLADE); bladeGrad.addColorStop(1,"#11161f");
    ctx.strokeStyle=bladeGrad; ctx.lineWidth=4*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(0,7*sc); ctx.lineTo(0,-26*sc); ctx.stroke();
    ctx.strokeStyle="rgba(255,255,255,.55)"; ctx.lineWidth=1.1*sc;
    ctx.beginPath(); ctx.moveTo(1*sc,5.5*sc); ctx.lineTo(1*sc,-21*sc); ctx.stroke();
    ctx.fillStyle=BLADE_HI; ctx.beginPath(); ctx.moveTo(-1.5*sc,-26*sc); ctx.lineTo(0,-33*sc); ctx.lineTo(1.5*sc,-26*sc); ctx.closePath(); ctx.fill();
    if(rightSwing&&atk>0.12){
      ctx.globalAlpha=.2+.25*strike;
      ctx.strokeStyle="rgba(170,210,255,.8)";
      ctx.lineWidth=2.6*sc;
      ctx.beginPath();
      ctx.arc(0,-7*sc,19*sc,-1.9,-.5);
      ctx.stroke();
      ctx.globalAlpha=1;
    }
    ctx.restore();

    // левый меч назад / активный удар левой рукой
    ctx.save();
    const leftArmX=-17*sc+(leftSwing?leftArm*.92:leftArm*.35);
    const leftArmY=-12*sc+(leftSwing?-strike*6*sc:0);
    ctx.translate(leftArmX,leftArmY);
    ctx.rotate(-.95-(leftSwing?atk*.48:atk*.12));
    ctx.fillStyle="#141923"; rrPath(ctx,-1.8*sc,7*sc,3.6*sc,10*sc,1.4*sc); ctx.fill();
    ctx.fillStyle=ARMOR_EDGE; ctx.beginPath(); ctx.ellipse(0,7*sc,5.8*sc,2*sc,-.1,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#7787ab"; ctx.lineWidth=2.8*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(0,6*sc); ctx.lineTo(0,-18*sc); ctx.stroke();
    ctx.fillStyle="#a9b8db"; ctx.beginPath(); ctx.moveTo(-1.1*sc,-18*sc); ctx.lineTo(0,-23*sc); ctx.lineTo(1.1*sc,-18*sc); ctx.closePath(); ctx.fill();
    if(leftSwing&&atk>0.12){
      ctx.globalAlpha=.2+.25*strike;
      ctx.strokeStyle="rgba(170,210,255,.8)";
      ctx.lineWidth=2.4*sc;
      ctx.beginPath();
      ctx.arc(0,-5*sc,16*sc,-2.45,-1.1);
      ctx.stroke();
      ctx.globalAlpha=1;
    }
    ctx.restore();

    // голова и лицо
    ctx.fillStyle=SKIN;
    ctx.beginPath(); ctx.ellipse(0,-21*sc,8.6*sc,10.4*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,.16)";
    ctx.beginPath(); ctx.ellipse(2.4*sc,-19*sc,5.5*sc,7.6*sc,.18,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(90,60,45,.55)"; ctx.lineWidth=1.1*sc;
    ctx.beginPath(); ctx.moveTo(-2*sc,-15.6*sc); ctx.quadraticCurveTo(1*sc,-13.4*sc,4.8*sc,-15.1*sc); ctx.stroke();
    ctx.fillStyle="#0f1118";
    ctx.beginPath(); ctx.ellipse(2.8*sc,-21*sc,2.8*sc,2.1*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#9ac3ff":"#9ec2ff";
    ctx.beginPath(); ctx.ellipse(2.8*sc,-21*sc,1.7*sc,1.5*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#05070b";
    ctx.beginPath(); ctx.arc(2.8*sc,-21*sc,1*sc,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.9)";
    ctx.beginPath(); ctx.arc(3.6*sc,-21.7*sc,.6*sc,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=HAIR; ctx.lineWidth=1.6*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-1*sc,-24*sc); ctx.lineTo(5.3*sc,-24.9*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2.8*sc,-18.6*sc); ctx.lineTo(5*sc,-17.3*sc); ctx.stroke();

    // волосы как на референсе: тёмные рваные пряди
    ctx.fillStyle=HAIR;
    ctx.beginPath(); ctx.ellipse(0,-27.5*sc,9.3*sc,6.8*sc,0,0,Math.PI*2); ctx.fill();
    [[-7,-28,-11,-35,-3,-31],[-3,-31,-5,-39,1,-33],[1,-32,1,-41,5,-33],[5,-30,9,-38,10,-29],[8,-24,13,-27,10,-18],[-8,-24,-13,-20,-9,-17]].forEach(function(p){
      ctx.beginPath(); ctx.moveTo(p[0]*sc,p[1]*sc); ctx.lineTo(p[2]*sc,p[3]*sc); ctx.lineTo(p[4]*sc,p[5]*sc); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle=HAIR_HI;
    ctx.globalAlpha=fl?.35:.16;
    ctx.beginPath(); ctx.moveTo(-4*sc,-28*sc); ctx.lineTo(-1*sc,-34*sc); ctx.lineTo(2*sc,-29*sc); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3*sc,-27*sc); ctx.lineTo(6*sc,-33*sc); ctx.lineTo(7*sc,-27*sc); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1;

    ctx.restore();
  }


  // ── УБИЙЦА ─────────────────────────────────────
  _assassin(cx,cy,s,fl){
    const f=this.facing, walk=(this.state==="move")?Math.sin(this.walkP):0, atk=this.atkAnim, sc=s*1.1;
    const atkPhase=atk>0?(1-atk):0, strike=atk>0?Math.sin(atkPhase*Math.PI):0, recoil=atk>0?Math.sin(atkPhase*Math.PI*2):0, side=this.attackSide||1;
    ctx.save(); ctx.translate(cx,cy); if(f<0) ctx.scale(-1,1);
    ctx.translate(strike*4*sc,-strike*1.6*sc);
    ctx.rotate(side*strike*0.12-recoil*0.04);
    ctx.fillStyle=fl?"#ffe0a0":"#2a1a04";
    ctx.beginPath(); ctx.ellipse(0,-27*sc,10*sc,13*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#fff":"#1a1004"; ctx.beginPath(); ctx.arc(0,-22*sc,8*sc,Math.PI,0); ctx.fill();
    ctx.fillStyle=fl?"#ffe0a0":"#3a2a08"; rrPath(ctx,-7*sc,-12*sc,14*sc,22*sc,3*sc); ctx.fill();
    const lr=walk*10*sc, ll=-lr;
    ctx.strokeStyle=fl?"#ffe0a0":"#2a1a04"; ctx.lineWidth=5*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(2*sc,10*sc); ctx.lineTo(4*sc+lr,24*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2*sc,10*sc); ctx.lineTo(-4*sc+ll,24*sc); ctx.stroke();
    const ar2=strike*24*sc+Math.max(0,-recoil)*7*sc, al2=-strike*18*sc-side*3*sc;
    ctx.beginPath(); ctx.moveTo(7*sc,-6*sc); ctx.lineTo(12*sc+ar2,4*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7*sc,-6*sc); ctx.lineTo(-12*sc+al2,4*sc); ctx.stroke();
    ctx.strokeStyle=fl?"#fff":"#ffe0a0"; ctx.lineWidth=2.5*sc;
    ctx.beginPath(); ctx.moveTo(13*sc+ar2,-12*sc); ctx.lineTo(18*sc+ar2,8*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-13*sc+al2,-10*sc); ctx.lineTo(-18*sc+al2,6*sc); ctx.stroke();
    ctx.fillStyle=fl?"#fff":"#f0c090";
    ctx.beginPath(); ctx.ellipse(1*sc,-22*sc,6*sc,7*sc,.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#1a1030"; ctx.beginPath(); ctx.ellipse(3*sc,-22*sc,2*sc,1.8*sc,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ── МАГ ─────────────────────────────────────────
  _mage(cx,cy,s,fl){
    const f=this.facing, sc=s*1.05, T=performance.now();
    const atk=this.atkAnim, atkPhase=atk>0?(1-atk):0, strike=atk>0?Math.sin(atkPhase*Math.PI):0, recoil=atk>0?Math.sin(atkPhase*Math.PI*2):0, side=this.attackSide||1;
    ctx.save(); ctx.translate(cx,cy); if(f<0) ctx.scale(-1,1);
    ctx.translate(strike*3.2*sc,-strike*2.2*sc);
    ctx.rotate(side*strike*0.06-recoil*0.03);
    ctx.fillStyle=fl?"#e0aaff":"#1a0830";
    ctx.beginPath(); ctx.moveTo(-9*sc,-14*sc); ctx.lineTo(9*sc,-14*sc); ctx.lineTo(12*sc,28*sc); ctx.lineTo(-12*sc,28*sc); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=fl?"#fff":"#6622cc"; ctx.lineWidth=1.5*sc;
    ctx.beginPath(); ctx.moveTo(-6*sc,-10*sc); ctx.lineTo(0,4*sc); ctx.lineTo(6*sc,-10*sc); ctx.stroke();
    ctx.fillStyle=fl?"#fff":"#f0c090";
    ctx.beginPath(); ctx.ellipse(0,-22*sc,8*sc,9*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#e0aaff":"#2a1050";
    ctx.beginPath(); ctx.moveTo(-9*sc,-20*sc); ctx.lineTo(9*sc,-20*sc); ctx.lineTo(9*sc,-18*sc); ctx.lineTo(-9*sc,-18*sc); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,-40*sc); ctx.lineTo(-8*sc,-18*sc); ctx.lineTo(8*sc,-18*sc); ctx.closePath(); ctx.fill();
    ctx.fillStyle=fl?"#fff":"#c47aff"; ctx.shadowColor="#c47aff"; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(0,-40*sc,3*sc,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle="#1a1030"; ctx.beginPath(); ctx.ellipse(3*sc,-23*sc,2.5*sc,2*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#ff88ff":"#8822cc"; ctx.beginPath(); ctx.ellipse(3*sc,-23*sc,1.5*sc,1.5*sc,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=fl?"#fff":"#6622cc"; ctx.lineWidth=3*sc;
    ctx.beginPath(); ctx.moveTo(12*sc+strike*4*sc,-24*sc-strike*6*sc); ctx.lineTo(12*sc-strike*2*sc,24*sc); ctx.stroke();
    ctx.fillStyle=fl?"#fff":"#e0aaff"; ctx.shadowColor="#c47aff"; ctx.shadowBlur=12+Math.sin(T*.004)*4;
    ctx.beginPath(); ctx.arc(12*sc+strike*4*sc,-28*sc-strike*8*sc,6*sc+strike*1.2*sc,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    for(let i=0;i<3;i++){
      ctx.globalAlpha=.4; ctx.fillStyle="#c47aff";
      const ang=T*.002+i*(Math.PI*2/3);
      ctx.beginPath(); ctx.arc(12*sc+Math.cos(ang)*10*sc,-28*sc+Math.sin(ang)*8*sc,2.5*sc,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1; ctx.restore();
  }

  // ── P2 тело ─────────────────────────────────────
  _p2body(cx,cy,s,fl){
    const f=this.facing, sc=s*1.1;
    const atk=this.atkAnim, atkPhase=atk>0?(1-atk):0, strike=atk>0?Math.sin(atkPhase*Math.PI):0, recoil=atk>0?Math.sin(atkPhase*Math.PI*2):0, side=this.attackSide||1;
    ctx.save(); ctx.translate(cx,cy); if(f<0) ctx.scale(-1,1);
    ctx.translate(strike*3.4*sc,-strike*1.4*sc);
    ctx.rotate(side*strike*0.1-recoil*0.04);
    // отличительный красный плащ
    ctx.fillStyle=fl?"#ffa0a0":"#220a0a";
    ctx.beginPath(); ctx.moveTo(-4*sc,-14*sc);
    ctx.quadraticCurveTo(-12*sc,2*sc,-8*sc,26*sc); ctx.lineTo(-2*sc,28*sc);
    ctx.quadraticCurveTo(-4*sc,8*sc,2*sc,-12*sc); ctx.closePath(); ctx.fill();
    ctx.fillStyle=fl?"#ffa0a0":"#331010"; rrPath(ctx,-8*sc,-12*sc,16*sc,28*sc,3*sc); ctx.fill();
    ctx.strokeStyle=fl?"#ffa0a0":"#4a1818"; ctx.lineWidth=5*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(3*sc,14*sc); ctx.lineTo(6*sc,27*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1*sc,14*sc); ctx.lineTo(-4*sc,27*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8*sc,-8*sc); ctx.lineTo(13*sc+strike*8*sc,4*sc-strike*5*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8*sc,-8*sc); ctx.lineTo(-13*sc+side*2*sc,4*sc); ctx.stroke();
    ctx.fillStyle=fl?"#fff":"#f0c090";
    ctx.beginPath(); ctx.ellipse(0,-21*sc,8.5*sc,10*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#111"; ctx.beginPath(); ctx.ellipse(2*sc,-22*sc,2*sc,1.8*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#ffaaaa":"#ff3333"; ctx.shadowColor="#ff3333"; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.ellipse(2*sc,-22*sc,1.2*sc,1.4*sc,0,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    // меч
    ctx.strokeStyle=fl?"#fff":"#ffaaaa"; ctx.lineWidth=3*sc;
    ctx.beginPath(); ctx.moveTo(14*sc+strike*8*sc,-20*sc-strike*8*sc); ctx.lineTo(14*sc+strike*2*sc,6*sc); ctx.stroke();
    ctx.strokeStyle=fl?"#fff":"#cc5555"; ctx.lineWidth=2.5*sc;
    ctx.beginPath(); ctx.moveTo(7*sc,-10*sc); ctx.lineTo(18*sc,-10*sc); ctx.stroke();
    // значок P2
    ctx.fillStyle="#ff3333"; ctx.font="bold "+(9*sc)+"px Manrope"; ctx.textAlign="center";
    ctx.fillText("P2",0,-32*sc);
    ctx.restore();
  }

  // ── СЕРЫЙ ВОЛК ──────────────────────────────────
  _wolf(cx,cy,s,fl){
    const f=this.facing, walk=(this.state==="move")?Math.sin(this.walkP):0, walk2=(this.state==="move")?Math.cos(this.walkP):0, atk=this.atkAnim, sc=s*1.16;
    const atkPhase=atk>0?(1-atk):0, strike=atk>0?Math.sin(atkPhase*Math.PI):0, recoil=atk>0?Math.sin(atkPhase*Math.PI*2):0;
    const jawOpen=.7*strike+.22*Math.max(0,walk2);
    ctx.save(); ctx.translate(cx,cy); if(f<0) ctx.scale(-1,1);
    ctx.translate(strike*4*sc,-strike*1.8*sc);
    ctx.rotate(walk*0.03+strike*0.1-recoil*0.04);

    // хвост
    ctx.strokeStyle=fl?"#d9e4ef":"#677587"; ctx.lineWidth=4.2*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-11*sc,6*sc); ctx.quadraticCurveTo(-21*sc,-1*sc-walk2*2*sc,-18*sc,-14*sc-walk*3*sc); ctx.stroke();

    // тело
    const bodyGrad=ctx.createLinearGradient(-8*sc,-8*sc,12*sc,12*sc);
    bodyGrad.addColorStop(0,fl?"#eef5ff":"#b4bec8");
    bodyGrad.addColorStop(.55,fl?"#c6d1dd":"#8f9bab");
    bodyGrad.addColorStop(1,fl?"#8f9eb1":"#5b6776");
    ctx.fillStyle=bodyGrad;
    ctx.beginPath(); ctx.ellipse(0,4*sc,13*sc,8.6*sc,-.18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"rgba(255,255,255,.18)":"rgba(255,255,255,.08)";
    ctx.beginPath(); ctx.ellipse(-1*sc,1*sc,9*sc,3.5*sc,-.22,0,Math.PI*2); ctx.fill();

    // лапы
    const legA=walk*9*sc;
    const legB=-walk*9*sc;
    ctx.strokeStyle=fl?"#eef5ff":"#6f7a89"; ctx.lineWidth=4.4*sc; ctx.lineCap="round";
    [[5,10,7+legA*.25,23],[ -5,10,-7+legB*.25,23],[8,5,12-legA*.18,16],[-8,5,-12+legB*.18,16]].forEach(function(p){
      ctx.beginPath(); ctx.moveTo(p[0]*sc,p[1]*sc); ctx.lineTo(p[2]*sc,p[3]*sc); ctx.stroke();
    });

    // голова
    ctx.fillStyle=fl?"#e8eef6":"#98a4b2";
    ctx.beginPath(); ctx.ellipse(12*sc,-2*sc+walk2*.4*sc,9.5*sc,7.2*sc,.28,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#f2f6fa":"#c2cbd4";
    ctx.beginPath(); ctx.ellipse(19*sc,0,6.5*sc,4.8*sc,.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#222"; ctx.beginPath(); ctx.ellipse(22*sc,-1*sc,2.1*sc,1.6*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(20,24,32,.65)";
    ctx.beginPath(); ctx.ellipse(19.2*sc,2.4*sc+jawOpen*2.2*sc,4.2*sc,1.6*sc+jawOpen*1.6*sc,.1,0,Math.PI*2); ctx.fill();

    // уши
    ctx.fillStyle=fl?"#eef2f7":"#8b96a4";
    [[8,-6,6,-15,12,-8],[13,-7,12,-16,17,-8]].forEach(function(p){
      ctx.beginPath(); ctx.moveTo(p[0]*sc,p[1]*sc); ctx.lineTo(p[2]*sc,p[3]*sc); ctx.lineTo(p[4]*sc,p[5]*sc); ctx.closePath(); ctx.fill();
    });

    // пасть и глаз
    ctx.strokeStyle=fl?"#fff":"#dae2f0"; ctx.lineWidth=1.2*sc;
    ctx.beginPath(); ctx.moveTo(18*sc,2*sc+jawOpen*1.1*sc); ctx.lineTo(24*sc,1*sc-atk*1.5*sc+jawOpen*1.4*sc); ctx.stroke();
    ctx.fillStyle="#ff4b35"; ctx.beginPath(); ctx.arc(14*sc,-4*sc,2.3*sc,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(14.8*sc,-4.7*sc,.8*sc,0,Math.PI*2); ctx.fill();

    // шерсть на спине
    ctx.fillStyle=fl?"#cad5e3":"#737f8f";
    [[-2,-6],[2,-7],[6,-7],[10,-6]].forEach(function(p){
      ctx.beginPath(); ctx.moveTo(p[0]*sc,p[1]*sc); ctx.lineTo((p[0]+2)*sc,(p[1]-5)*sc); ctx.lineTo((p[0]+4)*sc,(p[1]-1)*sc); ctx.closePath(); ctx.fill();
    });

    if(Math.random()<0.18){
      ctx.globalAlpha=.12+.15*Math.random();
      ctx.fillStyle="#d9edf8";
      ctx.beginPath();
      ctx.ellipse(25.5*sc+Math.random()*3*sc,1.5*sc+jawOpen*1.5*sc,2.2*sc,1.2*sc,.1,0,Math.PI*2);
      ctx.fill();
      ctx.globalAlpha=1;
    }

    ctx.restore();
  }


  // ── ЧЁРНЫЙ ВОЛК ─────────────────────────────────
  _blackWolf(cx,cy,s,fl){
    const f=this.facing, walk=(this.state==="move")?Math.sin(this.walkP):0, walk2=(this.state==="move")?Math.cos(this.walkP*0.9):0, atk=this.atkAnim, sc=s*1.45, T=performance.now();
    const atkPhase=atk>0?(1-atk):0, strike=atk>0?Math.sin(atkPhase*Math.PI):0, recoil=atk>0?Math.sin(atkPhase*Math.PI*2):0;
    const jawOpen=.9*strike+.16*(1+Math.sin(T*.006));
    ctx.save(); ctx.translate(cx,cy); if(f<0) ctx.scale(-1,1);
    ctx.translate(strike*5*sc,-strike*2.2*sc);

    ctx.save();
    ctx.globalAlpha=.22+.08*Math.sin(T*.003);
    ctx.fillStyle="#6e2dff"; ctx.shadowColor="#6e2dff"; ctx.shadowBlur=34;
    ctx.beginPath(); ctx.ellipse(4*sc,1*sc,23*sc,15*sc,0,0,Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.rotate(walk*0.03+strike*0.11-recoil*0.05);
    const bodyGrad=ctx.createLinearGradient(-14*sc,-8*sc,18*sc,14*sc);
    bodyGrad.addColorStop(0,fl?"#9f79ff":"#2a2f3b");
    bodyGrad.addColorStop(.5,fl?"#7150dc":"#181c25");
    bodyGrad.addColorStop(1,fl?"#4b37a4":"#0c0f15");
    ctx.fillStyle=bodyGrad;
    ctx.beginPath(); ctx.ellipse(0,4*sc,14.5*sc,9.5*sc,-.18,0,Math.PI*2); ctx.fill();

    ctx.fillStyle=fl?"rgba(216,184,255,.35)":"rgba(118,88,201,.24)";
    [[-1,0],[4,-2],[-4,1],[1,6]].forEach(function(p){ ctx.beginPath(); ctx.ellipse(p[0]*sc,p[1]*sc,4.6*sc,2.4*sc,0,0,Math.PI*2); ctx.fill(); });

    const legA=walk*10*sc;
    const legB=-walk*10*sc;
    ctx.strokeStyle=fl?"#c8aeff":"#2f3340"; ctx.lineWidth=5.2*sc; ctx.lineCap="round";
    [[5,10,6+legA*.24,25],[-5,10,-6+legB*.24,25],[8,5,11-legA*.14,17],[-8,5,-11+legB*.14,17]].forEach(function(p){
      ctx.beginPath(); ctx.moveTo(p[0]*sc,p[1]*sc); ctx.lineTo(p[2]*sc,p[3]*sc); ctx.stroke();
    });

    ctx.fillStyle=fl?"#8f63ff":"#111520";
    ctx.beginPath(); ctx.ellipse(12*sc,-3*sc+walk2*.5*sc,11.5*sc,8.4*sc,.24,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#cebaff":"#2d2144";
    ctx.beginPath(); ctx.ellipse(20*sc,0,7.1*sc,5.2*sc,.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(15,7,25,.72)";
    ctx.beginPath(); ctx.ellipse(20.5*sc,2.4*sc+jawOpen*1.4*sc,5.2*sc,2.2*sc+jawOpen*1.8*sc,.08,0,Math.PI*2); ctx.fill();

    // клыки и пасть
    ctx.fillStyle="#f5f2ff";
    for(let i=0;i<3;i++) ctx.fillRect((17+i*2.6)*sc,-1*sc,1.5*sc,4.2*sc+atk*1.6*sc+jawOpen*1.3*sc);
    ctx.fillStyle="#fff36a"; ctx.shadowColor="#fff36a"; ctx.shadowBlur=16;
    ctx.beginPath(); ctx.arc(13*sc,-5*sc,3.1*sc,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(18*sc,-5.6*sc,2.6*sc,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle="#120a1d";
    ctx.beginPath(); ctx.arc(14*sc,-5.3*sc,1.2*sc,0,Math.PI*2); ctx.fill();

    // уши и грива
    [[8,-8,5,-18,14,-10],[14,-8,12,-18,18,-9]].forEach(function(p){
      ctx.fillStyle=fl?"#a579ff":"#1d2130";
      ctx.beginPath(); ctx.moveTo(p[0]*sc,p[1]*sc); ctx.lineTo(p[2]*sc,p[3]*sc); ctx.lineTo(p[4]*sc,p[5]*sc); ctx.closePath(); ctx.fill();
    });
    ctx.strokeStyle=fl?"#9b7fff":"#6d2cff"; ctx.lineWidth=5.8*sc; ctx.shadowColor="#6d2cff"; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.moveTo(-8*sc,8*sc); ctx.quadraticCurveTo(-22*sc,-2*sc-walk2*2*sc,-20*sc,-16*sc-walk*3*sc); ctx.stroke();
    ctx.shadowBlur=0;

    if(Math.random()<0.24){
      ctx.globalAlpha=.22;
      ctx.fillStyle="#c5b9ff";
      ctx.beginPath();
      ctx.ellipse(27*sc+Math.random()*4*sc,1.5*sc+jawOpen*1.8*sc,2.6*sc,1.5*sc,.1,0,Math.PI*2);
      ctx.fill();
      ctx.globalAlpha=1;
    }

    ctx.restore();
  }



  // ── ГРОМОВОЙ ВОЛК (ФИНАЛЬНЫЙ БОСС) ───────────────
  _giantWolf(cx,cy,s,fl){
    const f=this.facing, walk=(this.state==="move")?Math.sin(this.walkP):0;
    const T=performance.now();
    // Масштаб 3.2x — огромный
    const sc=s*3.2;
    ctx.save(); ctx.translate(cx,cy); if(f<0) ctx.scale(-1,1);

    // Пульсирующая аура тьмы
    const aurPulse=0.15+0.12*Math.sin(T*.0015);
    ctx.globalAlpha=aurPulse;
    ctx.fillStyle="#000"; ctx.shadowColor="#220022"; ctx.shadowBlur=60;
    ctx.beginPath(); ctx.ellipse(0,8*sc,38*sc,22*sc,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=aurPulse*.6;
    ctx.fillStyle="#440044";
    ctx.beginPath(); ctx.ellipse(0,5*sc,30*sc,18*sc,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1; ctx.shadowBlur=0;

    // Тело — основа
    ctx.fillStyle=fl?"#6633aa":"#0d0d12";
    ctx.beginPath(); ctx.ellipse(0,4*sc,17*sc,11*sc,-.15,0,Math.PI*2); ctx.fill();

    // Шерсть — слой тёмных штрихов вокруг тела
    ctx.strokeStyle=fl?"#9944cc":"#1a1025"; ctx.lineWidth=3*sc; ctx.lineCap="round";
    for(let i=0;i<10;i++){
      const a=i/10*Math.PI*2;
      const rx=Math.cos(a)*16*sc, rz=Math.sin(a)*10*sc;
      ctx.beginPath(); ctx.moveTo(rx*.85,rz*.85); ctx.lineTo(rx*1.4+Math.cos(a)*3*sc,rz*1.4); ctx.stroke();
    }

    // Ноги (с анимацией ходьбы)
    const lr=walk*12*sc, ll=-lr;
    ctx.strokeStyle=fl?"#7722aa":"#0d0d12"; ctx.lineWidth=6*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(7*sc,12*sc); ctx.lineTo(7*sc+lr,28*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7*sc,12*sc); ctx.lineTo(-7*sc+ll,28*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10*sc,10*sc); ctx.lineTo(10*sc-lr*.5,25*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10*sc,10*sc); ctx.lineTo(-10*sc+ll*.5,25*sc); ctx.stroke();

    // Когти
    ctx.strokeStyle=fl?"#ddccff":"#eeeeff"; ctx.lineWidth=1.5*sc; ctx.lineCap="round";
    [7*sc+lr,-7*sc+ll,10*sc-lr*.5,-10*sc+ll*.5].forEach(function(legX,li){
      const ly=28*sc;
      for(let ci=0;ci<3;ci++){
        ctx.beginPath();
        ctx.moveTo(legX-2*sc+ci*2*sc,ly);
        ctx.lineTo(legX-2.5*sc+ci*2*sc,ly+5*sc);
        ctx.stroke();
      }
    });

    // Голова
    ctx.fillStyle=fl?"#5522aa":"#0f0f18";
    ctx.beginPath(); ctx.ellipse(15*sc,-4*sc,13*sc,10*sc,.2,0,Math.PI*2); ctx.fill();

    // Грива/шерсть на голове
    ctx.fillStyle=fl?"#331155":"#050508";
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI-Math.PI*.2;
      ctx.beginPath();
      ctx.ellipse(15*sc+Math.cos(a)*9*sc,-4*sc+Math.sin(a)*8*sc,4*sc,2.5*sc,a,0,Math.PI*2);
      ctx.fill();
    }

    // Уши
    [[9*sc,-12*sc,5*sc,-22*sc,13*sc,-12*sc],[17*sc,-11*sc,15*sc,-22*sc,21*sc,-11*sc]].forEach(function(p){
      ctx.fillStyle=fl?"#7722aa":"#0d0d18";
      ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[2],p[3]); ctx.lineTo(p[4],p[5]); ctx.closePath(); ctx.fill();
      ctx.fillStyle=fl?"#cc66ff":"#330044";
      ctx.beginPath(); ctx.moveTo(p[0]+1*sc,p[1]+1*sc); ctx.lineTo(p[2]+.5*sc,p[3]+2*sc); ctx.lineTo(p[4]-1*sc,p[5]+1*sc); ctx.closePath(); ctx.fill();
    });

    // Морда — оскал
    ctx.fillStyle=fl?"#ddbbff":"#1a1028";
    ctx.beginPath(); ctx.ellipse(22*sc,-2*sc,7*sc,5*sc,.1,0,Math.PI*2); ctx.fill();
    // Зубы
    ctx.fillStyle="#fff";
    for(let i=0;i<4;i++){
      ctx.beginPath(); ctx.moveTo(19*sc+i*2.2*sc,0); ctx.lineTo(18.5*sc+i*2.2*sc,5*sc); ctx.lineTo(20*sc+i*2.2*sc,5*sc); ctx.closePath(); ctx.fill();
    }
    // Нижние клыки
    ctx.fillStyle="#f0f0f0";
    ctx.beginPath(); ctx.moveTo(20*sc,2*sc); ctx.lineTo(19*sc,-3*sc); ctx.lineTo(21*sc,-3*sc); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24*sc,2*sc); ctx.lineTo(23*sc,-3*sc); ctx.lineTo(25*sc,-3*sc); ctx.closePath(); ctx.fill();

    // Нос
    ctx.fillStyle="#1a0011";
    ctx.beginPath(); ctx.ellipse(26*sc,-3*sc,3*sc,2.2*sc,0,0,Math.PI*2); ctx.fill();

    // Глаза — ярко-жёлтые светящиеся
    ctx.fillStyle=fl?"#fff":"#ffcc00"; ctx.shadowColor="#ffcc00"; ctx.shadowBlur=20+Math.sin(T*.004)*8;
    ctx.beginPath(); ctx.arc(12*sc,-6.5*sc,3.5*sc,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(18*sc,-7*sc,3*sc,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#000"; ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(12.8*sc,-6.8*sc,1.6*sc,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(18.8*sc,-7.3*sc,1.4*sc,0,Math.PI*2); ctx.fill();
    // блики в глазах
    ctx.fillStyle="#fff";
    ctx.beginPath(); ctx.arc(12*sc,-7.5*sc,.8*sc,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(18*sc,-8*sc,.7*sc,0,Math.PI*2); ctx.fill();

    // Хвост
    ctx.strokeStyle=fl?"#7722aa":"#0d0d18"; ctx.lineWidth=8*sc;
    ctx.beginPath(); ctx.moveTo(-15*sc,8*sc);
    ctx.quadraticCurveTo(-32*sc+walk*4*sc,16*sc,-30*sc+walk*6*sc,-10*sc+walk*8*sc); ctx.stroke();
    // кончик хвоста
    ctx.fillStyle=fl?"#9944cc":"#220033";
    ctx.beginPath(); ctx.ellipse(-30*sc+walk*6*sc,-12*sc+walk*8*sc,6*sc,4*sc,-.3+walk*.2,0,Math.PI*2); ctx.fill();

    // Дымовые частицы из ноздрей (анимированные)
    ctx.globalAlpha=0.4+0.3*Math.sin(T*.004);
    ctx.fillStyle="#553366";
    ctx.beginPath(); ctx.arc(27*sc+Math.sin(T*.003)*2*sc,-4*sc-Math.abs(Math.sin(T*.003))*4*sc,2.5*sc,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.3+0.2*Math.sin(T*.004+1);
    ctx.beginPath(); ctx.arc(27*sc+Math.sin(T*.003+1)*3*sc,-4*sc-Math.abs(Math.sin(T*.003+1))*6*sc,1.8*sc,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;

    ctx.restore();
  }

  // ── ДРАКОН ─────────────────────────────────────
  _dragon(cx,cy,s,fl){
    const T=performance.now(), sc=s*1.6, f=this.facing;
    ctx.save(); ctx.translate(cx,cy); if(f<0) ctx.scale(-1,1);
    ctx.fillStyle=fl?"#ff8844":"#660000"; ctx.globalAlpha=.7;
    ctx.beginPath(); ctx.moveTo(0,-8*sc); ctx.quadraticCurveTo(-30*sc,-24*sc,-22*sc,10*sc); ctx.quadraticCurveTo(-10*sc,14*sc,0,8*sc); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,-8*sc); ctx.quadraticCurveTo(30*sc,-24*sc,22*sc,10*sc); ctx.quadraticCurveTo(10*sc,14*sc,0,8*sc); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle=fl?"#ff6633":"#8b1a00";
    ctx.beginPath(); ctx.ellipse(0,4*sc,13*sc,10*sc,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=fl?"#ffaa44":"#aa3300"; ctx.lineWidth=1.5*sc;
    for(let i=-2;i<=2;i++) for(let j=0;j<2;j++){
      ctx.beginPath(); ctx.arc(i*5*sc,(j*8-2)*sc,2.5*sc,Math.PI,0); ctx.stroke();
    }
    ctx.strokeStyle=fl?"#ff9966":"#6b1400"; ctx.lineWidth=5*sc; ctx.lineCap="round";
    [[-6*sc,10*sc,-9*sc,24*sc],[6*sc,10*sc,9*sc,24*sc],[-10*sc,4*sc,-16*sc,16*sc],[10*sc,4*sc,16*sc,16*sc]].forEach(function(p){
      ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[2],p[3]); ctx.stroke();
    });
    ctx.fillStyle=fl?"#ff6633":"#8b1a00";
    ctx.beginPath(); ctx.ellipse(14*sc,-4*sc,13*sc,9*sc,.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#ffcc44":"#cc6600";
    [[10*sc,-10*sc,8*sc,-22*sc,14*sc,-11*sc],[16*sc,-9*sc,15*sc,-21*sc,19*sc,-9.5*sc]].forEach(function(p){
      ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[2],p[3]); ctx.lineTo(p[4],p[5]); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle=fl?"#fff":"#ff4400"; ctx.shadowColor="#ff4400"; ctx.shadowBlur=16;
    ctx.beginPath(); ctx.arc(12*sc,-5*sc,3*sc,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(12.8*sc,-5.5*sc,1.2*sc,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#cc0000"; ctx.beginPath(); ctx.moveTo(20*sc,-2*sc); ctx.lineTo(26*sc,0); ctx.lineTo(20*sc,4*sc); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#ffaa00"; ctx.shadowColor="#ff4400"; ctx.shadowBlur=10+Math.sin(T*.005)*5;
    ctx.beginPath(); ctx.arc(24*sc,2*sc,3*sc,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle=fl?"#ff9966":"#8b1a00"; ctx.lineWidth=7*sc;
    ctx.beginPath(); ctx.moveTo(-12*sc,6*sc); ctx.quadraticCurveTo(-28*sc,14*sc,-24*sc,-6*sc); ctx.stroke();
    ctx.restore();
  }

  // ── НЕКРОМАНТ ──────────────────────────────────
  _necromancer(cx,cy,s,fl){
    const T=performance.now(), sc=s*1.4;
    ctx.save(); ctx.translate(cx,cy); if(this.facing<0) ctx.scale(-1,1);
    ctx.translate(0,-Math.sin(T*.002)*5);
    ctx.fillStyle=fl?"#88aaff":"#0d0d1a";
    ctx.beginPath(); ctx.moveTo(-14*sc,-14*sc); ctx.lineTo(14*sc,-14*sc);
    ctx.quadraticCurveTo(20*sc,10*sc,16*sc,30*sc);
    ctx.quadraticCurveTo(0,28*sc,-16*sc,30*sc);
    ctx.quadraticCurveTo(-20*sc,10*sc,-14*sc,-14*sc); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=fl?"#fff":"#4444aa"; ctx.lineWidth=1.5*sc;
    ctx.beginPath(); ctx.moveTo(-6*sc,-10*sc); ctx.lineTo(0,6*sc); ctx.lineTo(6*sc,-10*sc); ctx.stroke();
    ctx.strokeStyle=fl?"#ccddff":"#6644aa"; ctx.lineWidth=3*sc;
    ctx.beginPath(); ctx.moveTo(14*sc,-22*sc); ctx.lineTo(14*sc,24*sc); ctx.stroke();
    ctx.fillStyle=fl?"#fff":"#ddeeff";
    ctx.beginPath(); ctx.ellipse(14*sc,-28*sc,7*sc,8*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#88aaff":"#1a1a3a";
    ctx.beginPath(); ctx.ellipse(11*sc,-29*sc,2.5*sc,3*sc,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(17*sc,-29*sc,2.5*sc,3*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#aaccff":"#4422cc"; ctx.shadowColor="#4422cc"; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(11*sc,-29*sc,1.5*sc,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(17*sc,-29*sc,1.5*sc,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle=fl?"#fff":"#c8c8e0"; ctx.beginPath(); ctx.ellipse(0,-20*sc,8*sc,9*sc,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#88aaff":"#0d0d1a";
    ctx.beginPath(); ctx.ellipse(0,-26*sc,10*sc,10*sc,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10*sc,-20*sc); ctx.lineTo(10*sc,-20*sc); ctx.lineTo(8*sc,-12*sc); ctx.lineTo(-8*sc,-12*sc); ctx.closePath(); ctx.fill();
    ctx.fillStyle=fl?"#fff":"#9922ff"; ctx.shadowColor="#9922ff"; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.arc(-3*sc,-22*sc,2.5*sc,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(3*sc,-22*sc,2.5*sc,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    for(let i=0;i<4;i++){
      const a=T*.001+i*(Math.PI/2);
      ctx.fillStyle=fl?"#ccaaff":"#6622cc"; ctx.globalAlpha=.5+.4*Math.sin(T*.003+i);
      ctx.beginPath(); ctx.arc(Math.cos(a)*20*sc,Math.sin(a)*14*sc,2*sc,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1; ctx.restore();
  }

  // ── ГОРНЫЙ ВЕЛИКАН ──────────────────────────────
  _giant(cx,cy,s,fl){
    const sc=s*1.8, walk=(this.state==="move")?Math.sin(this.walkP):0;
    ctx.save(); ctx.translate(cx,cy); if(this.facing<0) ctx.scale(-1,1);
    const lr=walk*14*sc, ll=-lr;
    ctx.strokeStyle=fl?"#ccc":"#5a4a38"; ctx.lineWidth=10*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(6*sc,14*sc); ctx.lineTo(8*sc+lr,30*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6*sc,14*sc); ctx.lineTo(-8*sc+ll,30*sc); ctx.stroke();
    ctx.fillStyle=fl?"#ddd":"#4a3a28";
    ctx.beginPath(); ctx.ellipse(9*sc+lr,31*sc,8*sc,3.5*sc,.1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-9*sc+ll,31*sc,8*sc,3.5*sc,-.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#ccc":"#6b5a47";
    ctx.beginPath(); ctx.moveTo(-14*sc,-12*sc); ctx.lineTo(14*sc,-14*sc); ctx.lineTo(16*sc,14*sc); ctx.lineTo(-16*sc,14*sc); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=fl?"#999":"#4a3a28"; ctx.lineWidth=1.5*sc;
    ctx.beginPath(); ctx.moveTo(-8*sc,-8*sc); ctx.lineTo(-4*sc,0); ctx.lineTo(-8*sc,8*sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5*sc,-10*sc); ctx.lineTo(8*sc,0); ctx.lineTo(5*sc,10*sc); ctx.stroke();
    const gAr=this.atkAnim*25*sc;
    ctx.strokeStyle=fl?"#ccc":"#6b5a47"; ctx.lineWidth=9*sc; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(14*sc,-8*sc); ctx.lineTo(22*sc+gAr,8*sc+gAr*.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14*sc,-8*sc); ctx.lineTo(-22*sc,8*sc); ctx.stroke();
    ctx.fillStyle=fl?"#bbb":"#5a4a38";
    ctx.beginPath(); ctx.arc(23*sc+gAr,9*sc+gAr*.3,6*sc,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-23*sc,9*sc,6*sc,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=fl?"#ccc":"#7a6a55";
    ctx.beginPath(); ctx.moveTo(-12*sc,-14*sc); ctx.lineTo(12*sc,-16*sc); ctx.lineTo(14*sc,-30*sc); ctx.lineTo(-10*sc,-32*sc); ctx.closePath(); ctx.fill();
    ctx.fillStyle=fl?"#999":"#4a3a28";
    ctx.fillRect(-10*sc,-27*sc,8*sc,3*sc); ctx.fillRect(2*sc,-27.5*sc,8*sc,3*sc);
    ctx.fillStyle=fl?"#fff":"#ff4400"; ctx.shadowColor="#ff4400"; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(-6*sc,-24*sc,4*sc,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6*sc,-24.5*sc,4*sc,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(-4.8*sc,-25*sc,1.5*sc,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=fl?"#999":"#3a2a18"; ctx.lineWidth=2*sc;
    ctx.beginPath(); ctx.moveTo(-9*sc,-19*sc); ctx.lineTo(-5*sc,-16*sc); ctx.lineTo(-2*sc,-18*sc); ctx.lineTo(2*sc,-16.5*sc); ctx.lineTo(6*sc,-18*sc); ctx.lineTo(9*sc,-16*sc); ctx.stroke();
    ctx.restore();
  }

  _hpbar(cx,ty){
    const bw=this.r*2.8, bh=5, bx=cx-bw/2;
    const pct=this.hp/this.maxHp;
    const col=pct>.6?"#4ec97a":pct>.3?"#f4be5f":"#f06058";
    ctx.fillStyle="rgba(0,0,0,.5)"; rrect(ctx,bx-1,ty-1,bw+2,bh+2,3);
    ctx.fillStyle=col; if(bw*pct>0) rrect(ctx,bx,ty,bw*pct,bh,3);
    ctx.save(); ctx.font="bold 11px Manrope,sans-serif"; ctx.textAlign="center";
    ctx.fillStyle="#ccddff"; ctx.shadowColor="rgba(0,0,0,.9)"; ctx.shadowBlur=5;
    ctx.fillText(this.name+" Lv."+this.level,cx,ty-3); ctx.restore();
  }
}

// ══ УРОН / СМЕРТЬ ══════════════════════════════════
function dealDmg(atk,tgt,dmg){
  if(!tgt||tgt.dead)return;
  // Passive: deathMark — double damage vs targets below 30% HP
  if(atk._deathMark && tgt.hp/tgt.maxHp < 0.3) dmg=Math.floor(dmg*2);
  // Passive: backstab — +80% dmg first hit (consumed)
  if(atk._backstabReady){ dmg=Math.floor(dmg*1.8); atk._backstabReady=false; }
  tgt.hit(dmg, atk);
  if(tgt.dead)return;
  const p=w2c(tgt.wx,tgt.wz,.9);
  const isGood=atk.isHero||atk.isP2;
  dmgt(p.cx,p.cy,"-"+dmg,isGood?"#f4be5f":"#f06058");
  addLog(atk.name+" -> "+tgt.name+": "+dmg+" урона.",isGood?"good":"bad");
}
function onDeath(u){
  const p=w2c(u.wx,u.wz,.5);
  parts(p.cx,p.cy,u.color,16,4);
  addLog(u.name+" пал!",(u.isHero||u.isP2)?"bad":"good");
  if(!u.isHero&&!u.isP2){
    _sessionKills++;
    metaProgress.seasonGoals.kills=(metaProgress.seasonGoals.kills||0)+1;
    gainMetaXp(u.isBoss?20:6);
    if(Math.random()<0.42) addInventoryItem('energyPotion',1);
    if(Math.random()<0.18) addInventoryItem('manaPotion',1);
    if(player&&!player.dead&&chosenKey){
      heroProgress[chosenKey].coins=(heroProgress[chosenKey].coins||0)+rndI(1,2);
      addGearDrop(u);
    }
    if(player2&&!player2.dead&&p2ChosenKey){
      heroProgress[p2ChosenKey].coins=(heroProgress[p2ChosenKey].coins||0)+rndI(1,2);
    }
    if(u.isBoss) metaProgress.seasonGoals.bosses=(metaProgress.seasonGoals.bosses||0)+1;
    if(Math.random()<0.55) spawnDrop(u.wx,u.wz);
    coins+=rndI(1,5);
    saveMetaProgress();
  }
  if(u.isHero){
    if(chosenKey&&heroProgress[chosenKey]){ heroProgress[chosenKey].coins=coins; saveHeroProgress(); }
    if(!player2||player2.dead) setTimeout(function(){gameState="defeat";},300);
  }
}

// ══ ШАБЛОНЫ ГЕРОЕВ ════════════════════════════════
const HEROES={
  knight:{
    name:"Рагнар",role:"Мечник",portrait:"⚔️",spriteKey:"knight",
    hp:500,mp:1200,resourceType:"energy",spd:2.8,atk:[150,150],atkRange:1.25,atkCd:700,color:"#73a5ff",r:24,
    ab1Name:"Вихрь",ab1Max:5000, ab2Name:"Рывок",ab2Max:7000,
    ab3Name:"Щитовой удар",ab3Max:8500,ab4Name:"Боевой клич",ab4Max:13000,
    ab1Cost:30,ab2Cost:42,ab3Cost:55,ab4Cost:75,
    ab1(p){ monsters.filter(function(m){return !m.dead&&dist2(p,m)<1.9;}).forEach(function(m){dealDmg(p,m,rndI(38,58));}); const c=w2c(p.wx,p.wz,.8); parts(c.cx,c.cy,"#73a5ff",22,5); addLog("Рагнар — Вихрь клинков!","info"); },
    ab2(p){ const t=p.closest(); if(!t)return; const dx=t.wx-p.wx,dz=t.wz-p.wz,l=Math.hypot(dx,dz)||1; p.wx=clamp(t.wx-dx/l*1.1,.2,AW-.2); p.wz=clamp(t.wz-dz/l*1.1,.2,AD-.2); dealDmg(p,t,rndI(50,70)); addLog("Рагнар — Боевой рывок!","info"); },
  },
  assassin:{
    name:"Лиора",role:"Убийца",portrait:"🗡️",spriteKey:"assassin",
    hp:200,mp:1400,resourceType:"energy",spd:4.2,atk:[80,110],atkRange:1.0,atkCd:500,color:"#f4be5f",r:20,
    ab1Name:"Двойной удар",ab1Max:5000, ab2Name:"Яд",ab2Max:8000,
    ab3Name:"Тень",ab3Max:7000,ab4Name:"Клинковая буря",ab4Max:12500,
    ab1Cost:26,ab2Cost:34,ab3Cost:44,ab4Cost:68,
    ab1(p){ const t=p.closest(); if(!t)return; dealDmg(p,t,rndI(80,120)); dealDmg(p,t,rndI(80,120)); addLog("Лиора — Двойной удар!","info"); },
    ab2(p){ monsters.filter(function(m){return !m.dead&&dist2(p,m)<2.5;}).forEach(function(m){m.poisonTicks=6;m.poisonDmg=rndI(20,30);m.poisonTimer=0;}); addLog("Лиора — Яд!","info"); },
  },
  mage:{
    name:"Селена",role:"Маг",portrait:"🔮",spriteKey:"mage",
    hp:280,mp:1800,resourceType:"mana",spd:2.4,atk:[120,160],atkRange:3.2,atkCd:1600,color:"#c47aff",r:20,
    ab1Name:"Огн.шар",ab1Max:4000, ab2Name:"Метеор",ab2Max:10000,
    ab3Name:"Мист.вспышка",ab3Max:7600,ab4Name:"Арканный купол",ab4Max:14000,
    ab1Cost:34,ab2Cost:64,ab3Cost:48,ab4Cost:82,
    ab1(p){ const t=p.closest(); if(!t)return; proj(p,t,rndI(100,140),"#ff9940",10); addLog("Селена — Огненный шар!","info"); },
    ab2(p){ monsters.filter(function(m){return !m.dead;}).forEach(function(m){dealDmg(p,m,rndI(80,120));const c=w2c(m.wx,m.wz,.5);parts(c.cx,c.cy,"#ff5520",14,5);}); addLog("Селена — МЕТЕОР!","info"); },
  },
};

const WEAPON_ABILITIES={
  sw_iron:{name:"Секущий выпад",cd:6500,cost:36,act:function(p){const t=p.closest();if(!t)return false;dealDmg(p,t,rndI(85,120));return true;}},
  sw_steel:{name:"Стальная дуга",cd:7600,cost:42,act:function(p){monsters.filter(function(m){return !m.dead&&dist2(p,m)<1.8;}).forEach(function(m){dealDmg(p,m,rndI(70,100));});return true;}},
  sw_shadow:{name:"Теневая резь",cd:9000,cost:48,act:function(p){const t=p.closest();if(!t)return false;dealDmg(p,t,rndI(120,150));t.stunTimer=500;return true;}},
  sw_legend:{name:"Световой разлом",cd:12000,cost:62,act:function(p){monsters.filter(function(m){return !m.dead;}).forEach(function(m){if(dist2(p,m)<2.6)dealDmg(p,m,rndI(95,130));});screenShake(12,280);return true;}},
  ax_war:{name:"Топор войны",cd:8200,cost:44,act:function(p){const t=p.closest();if(!t)return false;dealDmg(p,t,rndI(130,180));return true;}},
  sp_pike:{name:"Пробивной укол",cd:7400,cost:38,act:function(p){const t=p.closest();if(!t)return false;dealDmg(p,t,rndI(92,122));return true;}},
  dg_basic:{name:"Резкий укол",cd:5600,cost:28,act:function(p){const t=p.closest();if(!t)return false;dealDmg(p,t,rndI(75,95));return true;}},
  dg_poison:{name:"Ядовитый порез",cd:6200,cost:30,act:function(p){const t=p.closest();if(!t)return false;dealDmg(p,t,rndI(72,92));t.poisonTicks=6;t.poisonDmg=20;t.poisonTimer=0;return true;}},
  dg_twin:{name:"Парный шквал",cd:8200,cost:46,act:function(p){const t=p.closest();if(!t)return false;dealDmg(p,t,rndI(80,100));dealDmg(p,t,rndI(80,100));return true;}},
  dg_void:{name:"Пустотный разрез",cd:10800,cost:58,act:function(p){const t=p.closest();if(!t)return false;dealDmg(p,t,rndI(145,175));return true;}},
  bow_short:{name:"Быстрый выстрел",cd:7000,cost:34,act:function(p){const t=p.closest();if(!t)return false;proj(p,t,rndI(85,110),"#f7d17a",7);return true;}},
  sc_fan:{name:"Залп сюрикенов",cd:9200,cost:50,act:function(p){monsters.filter(function(m){return !m.dead;}).slice(0,3).forEach(function(m){proj(p,m,rndI(70,95),"#d7e4ff",6);});return true;}},
  st_wood:{name:"Пульс маны",cd:6200,cost:36,act:function(p){const t=p.closest();if(!t)return false;proj(p,t,rndI(92,120),"#caa4ff",9);return true;}},
  st_fire:{name:"Огненный луч",cd:7600,cost:44,act:function(p){const t=p.closest();if(!t)return false;proj(p,t,rndI(115,145),"#ff7b34",10);t.burnTimer=2300;t.burnDmg=18;t.burnTick=600;return true;}},
  st_ice:{name:"Ледяной шип",cd:7600,cost:44,act:function(p){const t=p.closest();if(!t)return false;proj(p,t,rndI(105,130),"#88d8ff",10);t.freezeTimer=1800;return true;}},
  st_storm:{name:"Грозовой импульс",cd:8800,cost:52,act:function(p){monsters.filter(function(m){return !m.dead&&dist2(p,m)<2.4;}).forEach(function(m){dealDmg(p,m,rndI(92,118));m.stunTimer=650;});return true;}},
  st_arch:{name:"Архонский ливень",cd:12600,cost:68,act:function(p){monsters.filter(function(m){return !m.dead;}).forEach(function(m){proj(p,m,rndI(100,130),"#dcb1ff",9);});return true;}},
  tome_anc:{name:"Древний резонанс",cd:9800,cost:56,act:function(p){const t=p.closest();if(!t)return false;dealDmg(p,t,rndI(118,152));p.ab1Cd=Math.max(0,p.ab1Cd-1200);p.ab2Cd=Math.max(0,p.ab2Cd-1200);return true;}},
};

function defaultWeaponFor(key){
  if(key==="knight") return "sw_iron";
  if(key==="assassin") return "dg_basic";
  return "st_wood";
}
function applyProfileLoadout(p,key){
  if(!p||!heroProgress[key]) return;
  const h=heroProgress[key];
  p.level=h.level||1;
  p.xp=h.xp||0;
  p.xpNext=xpForLevel(p.level||1);
  const wid=h.weapon||defaultWeaponFor(key);
  p.weaponId=wid;
  const bonus={
    sw_iron:15,sw_steel:35,sw_shadow:60,sw_legend:100,ax_war:50,sp_pike:40,
    dg_basic:10,dg_poison:28,dg_twin:45,dg_void:80,bow_short:35,sc_fan:30,
    st_wood:10,st_fire:35,st_ice:30,st_storm:55,st_arch:90,tome_anc:40,
  }[wid]||0;
  p.atk=[p.atk[0]+bonus,p.atk[1]+bonus];
  if(wid==="sp_pike") p.atkRange+=0.3;
  if(wid==="dg_twin") p.atkCd=Math.max(280,Math.floor(p.atkCd*0.88));
  if(wid==="tome_anc"){
    p.ab1Max=Math.floor(p.ab1Max*0.85);
    p.ab2Max=Math.floor(p.ab2Max*0.85);
    p.ab3Max=Math.floor(p.ab3Max*0.9);
    p.ab4Max=Math.floor(p.ab4Max*0.9);
  }
  applyGearAndSets(p,key);
}

// ══ БОССЫ ════════════════════════════════════════════
const BOSS_T=[
  {name:"Чёрный волк",  hp:800,  spd:2.2, atk:[160,180], atkRange:1.3, atkCd:900,  color:"#8800ff", r:32, isBoss:"blackwolf"},
  {name:"Пламенный дракон", hp:1400, spd:1.8, atk:[200,260], atkRange:2.0, atkCd:1100, color:"#ff4400", r:38, isBoss:"dragon"},
  {name:"Некромант",    hp:1000, spd:1.6, atk:[180,220], atkRange:3.5, atkCd:1400, color:"#4422cc", r:30, isBoss:"necromancer"},
  {name:"Горный великан",hp:2000,spd:1.4, atk:[280,340], atkRange:1.8, atkCd:1600, color:"#7a6a55", r:44, isBoss:"giant"},
];

// ══ МАГА СТИХИИ ════════════════════════════════════
let mageElement='fire';
const MAGE_EL_DESCS={
  fire:{color:"#ff6633",name:"Огонь",ab1Name:"Огненный шар",ab1Max:3800,ab2Name:"Метеор",ab2Max:9000,
    ab1(p){const t=p.closest();if(!t)return;proj(p,t,rndI(90,130)*(p._fireBallMult||1),"#ff9940",10);t.burnTimer=2200;t.burnDmg=18;t.burnTick=600;const c=w2c(t.wx,t.wz,.5);parts(c.cx,c.cy,"#ff6622",8,4);addLog("🔥 Огненный шар!","info");},
    ab2(p){const mult=p._meteorMult||1;monsters.filter(function(m){return !m.dead;}).forEach(function(m){dealDmg(p,m,rndI(90,130)*mult);m.burnTimer=3500;m.burnDmg=20;m.burnTick=600;const c=w2c(m.wx,m.wz,.5);parts(c.cx,c.cy,"#ff5520",14,5);});screenShake(14,400);addLog("☄️ МЕТЕОР!","info");}},
  water:{color:"#44aaff",name:"Вода",ab1Name:"Ледяной болт",ab1Max:3200,ab2Name:"Приливная волна",ab2Max:8500,
    ab1(p){const t=p.closest();if(!t)return;proj(p,t,rndI(70,100),"#88ddff",9);t.freezeTimer=1600;const c=w2c(t.wx,t.wz,.5);parts(c.cx,c.cy,"#88ddff",8,3);if(p._healWave){addInventoryItem("hpPotion",1);addLog("+1 HP зелье в инвентарь","good");}addLog("🧊 Ледяной болт!","info");},
    ab2(p){const pull=p._tidalWave;monsters.filter(function(m){return !m.dead;}).forEach(function(m){dealDmg(p,m,rndI(80,110));m.freezeTimer=2200;if(pull){var dx=p.wx-m.wx,dz=p.wz-m.wz,l=Math.hypot(dx,dz)||1;m.wx+=dx/l*2.5;m.wz+=dz/l*2.5;}const c=w2c(m.wx,m.wz,.5);parts(c.cx,c.cy,"#88ddff",10,3);});screenShake(8,300);addLog("🌊 Приливная волна!","info");}},
  earth:{color:"#88bb44",name:"Земля",ab1Name:"Каменный бросок",ab1Max:2800,ab2Name:"Землетрясение",ab2Max:10000,
    ab1(p){const t=p.closest();if(!t)return;proj(p,t,rndI(80,120),"#ccaa66",6);if(p._stoneThrow)t.stunTimer=600;addLog("🪨 Камень!","info");},
    ab2(p){monsters.filter(function(m){return !m.dead;}).forEach(function(m){dealDmg(p,m,rndI(100,150));m.stunTimer=1400;const c=w2c(m.wx,m.wz,.5);parts(c.cx,c.cy,"#ccaa66",12,4);});screenShake(20,500);addLog("🌋 ЗЕМЛЕТРЯСЕНИЕ!","info");}},
  air:{color:"#c8e8ff",name:"Воздух",ab1Name:"Ветряной порез",ab1Max:2300,ab2Name:"Торнадо",ab2Max:8000,
    ab1(p){const t=p.closest();if(!t)return;proj(p,t,rndI(60,90),"#99ddff",15);addLog("🌬️ Ветряной порез!","info");},
    ab2(p){const pull=p._tornado;monsters.filter(function(m){return !m.dead;}).forEach(function(m){dealDmg(p,m,rndI(70,100));if(pull){var dx=p.wx-m.wx,dz=p.wz-m.wz,l=Math.hypot(dx,dz)||1;m.wx+=dx/l*3;m.wz+=dz/l*3;}m.stunTimer=600;const c=w2c(m.wx,m.wz,.5);parts(c.cx,c.cy,"#99ddff",10,3);});const pc=w2c(p.wx,p.wz,.5);parts(pc.cx,pc.cy,"#ffffff",20,5);addLog("🌪️ ТОРНАДО!","info");}},
};

// ══ ДРЕВА НАВЫКОВ ════════════════════════════════════
const SKILL_TREES={
  knight:{name:"Рагнар — Древо навыков",skills:[
    {id:"hp_boost",tier:1,col:1,name:"Закалённость",desc:"+80 макс. HP",icon:"🛡️",req:[],cost:1,apply:function(p){p.maxHp+=80;p.hp=Math.min(p.hp+80,p.maxHp);}},
    {id:"whirl_dmg",tier:1,col:2,name:"Острые лезвия",desc:"+40% урон Вихря",icon:"⚔️",req:[],cost:1,apply:function(p){p._whirlBonus=(p._whirlBonus||1)+0.4;}},
    {id:"rush_stun",tier:1,col:3,name:"Оглушающий рывок",desc:"Рывок оглушает врага",icon:"💥",req:[],cost:1,apply:function(p){p._rushStun=true;}},
    {id:"iron_skin",tier:2,col:1,name:"Железная кожа",desc:"-20% урон по тебе",icon:"🪖",req:["hp_boost"],cost:2,apply:function(p){p._dmgReduce=(p._dmgReduce||0)+0.2;}},
    {id:"berserker",tier:2,col:2,name:"Берсерк",desc:"Скорость атаки +30%",icon:"🔥",req:["whirl_dmg"],cost:2,apply:function(p){p.atkCd=Math.round(p.atkCd*0.7);}},
    {id:"shield_bash",tier:2,col:3,name:"Удар щитом",desc:"AOE удар с оглушением 1с",icon:"🏛️",req:["rush_stun"],cost:2,apply:function(p){p._shieldBash=true;}},
    {id:"avatar_war",tier:3,col:2,name:"Аватар войны",desc:"+120HP +25%ATK +20%SPD",icon:"⚡",req:["iron_skin","berserker"],cost:3,apply:function(p){p.maxHp+=120;p.hp=Math.min(p.hp+120,p.maxHp);p.atk[0]=Math.round(p.atk[0]*1.25);p.atk[1]=Math.round(p.atk[1]*1.25);p.spd*=1.2;}},
  ]},
  assassin:{name:"Лиора — Древо навыков",skills:[
    {id:"spd_boost",tier:1,col:1,name:"Молниеносность",desc:"+0.8 скорость",icon:"💨",req:[],cost:1,apply:function(p){p.spd+=0.8;}},
    {id:"poison_plus",tier:1,col:2,name:"Смертельный яд",desc:"Яд наносит х2 урона",icon:"☠️",req:[],cost:1,apply:function(p){p._poisonMult=2;}},
    {id:"backstab",tier:1,col:3,name:"Удар в спину",desc:"+80% урон первого удара",icon:"🗡️",req:[],cost:1,apply:function(p){p._backstab=true;}},
    {id:"shadow_step",tier:2,col:1,name:"Шаг в тень",desc:"Двойной удар телепортирует",icon:"🌑",req:["spd_boost"],cost:2,apply:function(p){p._shadowStep=true;}},
    {id:"lethal_poison",tier:2,col:2,name:"Летальный яд",desc:"Яд длится в 2 раза дольше",icon:"💀",req:["poison_plus"],cost:2,apply:function(p){p._lethalPoison=true;}},
    {id:"death_mark",tier:2,col:3,name:"Метка смерти",desc:"х2 урон по врагам <30% HP",icon:"🎯",req:["backstab"],cost:2,apply:function(p){p._deathMark=true;}},
    {id:"shadowdancer",tier:3,col:2,name:"Танец теней",desc:"+60% атака, шаг в тень всегда",icon:"🌟",req:["shadow_step","lethal_poison"],cost:3,apply:function(p){p.atk[0]=Math.round(p.atk[0]*1.6);p.atk[1]=Math.round(p.atk[1]*1.6);p._shadowStep=true;p.spd+=0.6;}},
  ]},
  mage_fire:{name:"Огонь — Древо навыков",skills:[
    {id:"fire_bow",tier:1,col:1,name:"Огненный лук",desc:"Автоматический огненный снаряд",icon:"🏹",req:[],cost:1,apply:function(p){p._fireBow=true;}},
    {id:"burn_chance",tier:1,col:2,name:"Жгучее касание",desc:"Атаки всегда поджигают",icon:"🔥",req:[],cost:1,apply:function(p){p._burnAlways=true;}},
    {id:"fire_aura",tier:1,col:3,name:"Огненная аура",desc:"Враги рядом горят постоянно",icon:"☀️",req:[],cost:1,apply:function(p){p._fireAura=true;}},
    {id:"fire_fist",tier:2,col:1,name:"Огненный кулак",desc:"AOE взрыв рядом с собой",icon:"👊",req:["fire_bow"],cost:2,apply:function(p){p._fireFist=true;}},
    {id:"fire_shield",tier:2,col:2,name:"Огненный щит",desc:"Отражает 25% урона врагу",icon:"🛡️",req:["burn_chance"],cost:2,apply:function(p){p._fireShield=0.25;}},
    {id:"meteor_plus",tier:2,col:3,name:"Мегаметеор",desc:"Метеор наносит х2 урона",icon:"☄️",req:["fire_aura"],cost:2,apply:function(p){p._meteorMult=(p._meteorMult||1)*2;}},
    {id:"inferno",tier:3,col:2,name:"Инферно",desc:"Огненный шар горит х3",icon:"🌋",req:["fire_fist","fire_shield"],cost:3,apply:function(p){p._fireBallMult=(p._fireBallMult||1)*3;}},
  ]},
  mage_water:{name:"Вода — Древо навыков",skills:[
    {id:"ice_bolt",tier:1,col:1,name:"Ледяной болт+",desc:"Болт замораживает на 2с",icon:"🧊",req:[],cost:1,apply:function(p){p._iceBoltExtra=1;}},
    {id:"heal_wave",tier:1,col:2,name:"Волна поддержки",desc:"Болт даёт HP-зелье",icon:"💊",req:[],cost:1,apply:function(p){p._healWave=true;}},
    {id:"water_shield",tier:1,col:3,name:"Водяной щит",desc:"+80 HP и -10% урона",icon:"💧",req:[],cost:1,apply:function(p){p.maxHp+=80;p._dmgReduce=(p._dmgReduce||0)+0.1;}},
    {id:"frost_nova",tier:2,col:1,name:"Ледяная звезда",desc:"Волна замораживает ВСЕХ",icon:"❄️",req:["ice_bolt"],cost:2,apply:function(p){p._frostNova=true;}},
    {id:"tidal_wave",tier:2,col:2,name:"Приливная волна",desc:"Волна притягивает врагов",icon:"🌊",req:["heal_wave"],cost:2,apply:function(p){p._tidalWave=true;}},
    {id:"ice_armor",tier:2,col:3,name:"Ледяная броня",desc:"Нападающий замедляется",icon:"🏔️",req:["water_shield"],cost:2,apply:function(p){p._iceArmor=true;}},
    {id:"absolute_zero",tier:3,col:2,name:"Абсолютный ноль",desc:"Все заморожены на 5с",icon:"🌨️",req:["frost_nova","tidal_wave"],cost:3,apply:function(p){p._frostNova=true;p._absoluteZero=true;}},
  ]},
  mage_earth:{name:"Земля — Древо навыков",skills:[
    {id:"stone_throw",tier:1,col:1,name:"Каменный бросок",desc:"Снаряд оглушает на 0.6с",icon:"🪨",req:[],cost:1,apply:function(p){p._stoneThrow=true;}},
    {id:"earth_armor",tier:1,col:2,name:"Земляная броня",desc:"-30% урон по тебе",icon:"🏔️",req:[],cost:1,apply:function(p){p._dmgReduce=(p._dmgReduce||0)+0.3;}},
    {id:"thorns",tier:1,col:3,name:"Шипы",desc:"Отражает 15% урона атакующему",icon:"🌵",req:[],cost:1,apply:function(p){p._thorns=0.15;}},
    {id:"tremor",tier:2,col:1,name:"Землетрясение+",desc:"Землетрясение оглушает 2с",icon:"💥",req:["stone_throw"],cost:2,apply:function(p){p._tremorExtra=true;}},
    {id:"boulder",tier:2,col:2,name:"Валун",desc:"+50% урон снарядов",icon:"🪨",req:["earth_armor"],cost:2,apply:function(p){p._boulderBonus=1.5;}},
    {id:"stone_skin",tier:2,col:3,name:"Каменная кожа",desc:"-40% урон (суммарно)",icon:"🛡️",req:["thorns"],cost:2,apply:function(p){p._dmgReduce=(p._dmgReduce||0)+0.15;}},
    {id:"earthquake",tier:3,col:2,name:"Извержение",desc:"Стихия поражает х2 + оглушение",icon:"🌋",req:["tremor","boulder"],cost:3,apply:function(p){p._boulderBonus=(p._boulderBonus||1)*2;p._tremorExtra=true;}},
  ]},
  mage_air:{name:"Воздух — Древо навыков",skills:[
    {id:"wind_slash",tier:1,col:1,name:"Ветряной разрез",desc:"+60% скорость снарядов",icon:"🌬️",req:[],cost:1,apply:function(p){p._windSlash=true;}},
    {id:"haste",tier:1,col:2,name:"Ускорение",desc:"+1.0 скорость движения",icon:"💨",req:[],cost:1,apply:function(p){p.spd+=1.0;}},
    {id:"lightning",tier:1,col:3,name:"Молния",desc:"Атаки имеют шанс оглушить",icon:"⚡",req:[],cost:1,apply:function(p){p._lightning=true;}},
    {id:"tornado",tier:2,col:1,name:"Торнадо+",desc:"Торнадо притягивает врагов",icon:"🌪️",req:["wind_slash"],cost:2,apply:function(p){p._tornado=true;}},
    {id:"storm_aura",tier:2,col:2,name:"Штормовая аура",desc:"Аура бьёт молниями рядом",icon:"⛈️",req:["haste"],cost:2,apply:function(p){p._stormAura=true;}},
    {id:"chain_lightning",tier:2,col:3,name:"Цепная молния",desc:"Молния поражает до 3 врагов",icon:"⚡",req:["lightning"],cost:2,apply:function(p){p._chainLightning=true;}},
    {id:"cyclone",tier:3,col:2,name:"Циклон",desc:"+100% урон, все притянуты",icon:"🌀",req:["tornado","storm_aura"],cost:3,apply:function(p){p.atk[0]=Math.round(p.atk[0]*2);p.atk[1]=Math.round(p.atk[1]*2);p._tornado=true;}},
  ]},
};


const WOLF_T={name:"Серый волк",role:"Монстр",hp:200,spd:2.35,atk:[50,50],atkRange:1.08,atkCd:980,color:"#9da9b6",r:20};

function makeMonster(wave){
  const isBoss=wave>0&&wave%5===0;
  let tmpl;
  if(isBoss){
    const bt={...BOSS_T[Math.min(Math.floor((wave-1)/5)-1,BOSS_T.length-1)||0]};
    const sc=1+(Math.floor(wave/5)-1)*.25;
    tmpl={...bt, hp:Math.floor(bt.hp*sc), atk:[Math.floor(bt.atk[0]*sc),Math.floor(bt.atk[1]*sc)], role:"Босс"};
  } else {
    const bs=1+(wave-1)*.12;
    tmpl={...WOLF_T, hp:~~(WOLF_T.hp*bs), atk:[~~(WOLF_T.atk[0]*bs),~~(WOLF_T.atk[1]*bs)], spd:WOLF_T.spd*(1+(wave-1)*.04)};
  }
  const m=new Unit({...tmpl, wx:AW-1.5+rnd(-.4,.4), wz:rnd(.6,AD-.6), isHero:false, atkTimer:rnd(0,tmpl.atkCd||900)});
  if(tmpl.isBoss) m.isBoss=tmpl.isBoss;
  return m;
}
function makeWave(w){
  if(w%5===0){ const bt=BOSS_T[Math.min(Math.floor((w-1)/5)-1,BOSS_T.length-1)||0]; addLog("Босс: "+bt.name+" !","bad"); return [makeMonster(w)]; }
  return Array.from({length:Math.min(1+Math.floor(w*.7),8)},function(){return makeMonster(w);});
}


// ══ МАГАЗИН ═══════════════════════════════════════
const SHOP_ITEMS=[
  {id:"potion_s",label:"Малое зелье",icon:"🧪",cost:30,desc:"+2 HP зелья в инвентарь",apply(){addInventoryItem("hpPotion",2);}},
  {id:"potion_l",label:"Большое зелье",icon:"💊",cost:65,desc:"+1 эликсир в инвентарь",apply(){addInventoryItem("elixir",1);}},
  {id:"sword1",label:"Заточка",icon:"⚔️",cost:50,desc:"+20% урон",apply(p){p.atk=[Math.floor(p.atk[0]*1.2),Math.floor(p.atk[1]*1.2)];}},
  {id:"armor1",label:"Броня",icon:"🛡️",cost:50,desc:"+25% HP",apply(p){p.maxHp=Math.floor(p.maxHp*1.25);}},
  {id:"boots",label:"Сапоги",icon:"👟",cost:40,desc:"+20% скорость",apply(p){p.spd*=1.2;}},
  {id:"elixir",label:"Элексир силы",icon:"⚗️",cost:90,desc:"+15% урон и +1 эликсир",apply(p){p.atk=[Math.floor(p.atk[0]*1.15),Math.floor(p.atk[1]*1.15)];p.maxHp=Math.floor(p.maxHp*1.15);addInventoryItem("elixir",1);}},
  {id:"regen",label:"Набор алхимии",icon:"💍",cost:80,desc:"+2 EN и +2 MP зелья",apply(){addInventoryItem("energyPotion",2);addInventoryItem("manaPotion",2);}},
  {id:"cdring",label:"Кольцо силы",icon:"🌀",cost:70,desc:"-25% кулдаун способностей",apply(p){p.ab1Max=Math.floor(p.ab1Max*.75);p.ab2Max=Math.floor(p.ab2Max*.75);}},
];
let shopScreen=false;
function showShop(){
  shopScreen=true;
  var el=document.getElementById("shopOverlay");
  if(!el){el=document.createElement("div");el.id="shopOverlay";el.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:101;font-family:Cinzel,serif;";document.body.appendChild(el);}
  var shopHtml='<h2 style="color:#f4be5f;font-size:1.8rem;margin:0 0 6px">🏪 Магазин</h2><p style="color:#f4be5f;font-family:Manrope,sans;margin:0 0 18px">Монеты: <span id="shopCoins">0</span> 🪙</p><div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;max-width:700px">';
  SHOP_ITEMS.forEach(function(it,i){ shopHtml+='<button id="shopBtn'+i+'" onclick="buyItem('+i+')" style="background:linear-gradient(135deg,#0d1828,#1a2840);border:2px solid #334466;color:#cde;padding:14px 16px;border-radius:12px;cursor:pointer;font-family:Manrope,sans;min-width:130px;max-width:160px;text-align:center"><div style="font-size:1.8rem">'+it.icon+'</div><div style="font-weight:700;color:#f4be5f;margin:6px 0 2px;font-size:.88rem">'+it.label+'</div><div style="font-size:.75rem;color:#8899cc">'+it.desc+'</div><div style="margin-top:6px;color:#f4be5f;font-weight:800">'+it.cost+' 🪙</div></button>'; });
  shopHtml+='</div><button onclick="closeShop()" style="margin-top:20px;padding:10px 32px;background:linear-gradient(135deg,#1a2840,#223560);border:1.5px solid #f4be5f;color:#f4be5f;border-radius:10px;font-family:Cinzel,serif;font-size:.9rem;cursor:pointer">Закрыть магазин</button>';
  el.innerHTML=shopHtml;
  document.getElementById("shopCoins").textContent=coins;
  el.style.display="flex";
  updateShopBtns();
}
function updateShopBtns(){
  SHOP_ITEMS.forEach(function(it,i){
    var btn=document.getElementById("shopBtn"+i);
    if(btn){ if(coins<it.cost){btn.style.opacity=".4";btn.style.cursor="not-allowed";}else{btn.style.opacity="1";btn.style.cursor="pointer";} }
  });
  var sc=document.getElementById("shopCoins");
  if(sc) sc.textContent=coins;
}
function buyItem(idx){
  var it=SHOP_ITEMS[idx]; if(coins<it.cost)return;
  coins-=it.cost;
  if(player&&!player.dead) it.apply(player);
  if(player2&&!player2.dead) it.apply(player2);
  addLog("Куплено: "+it.label,"good");
  updateShopBtns();
  updateHUD();
}
function closeShop(){
  shopScreen=false;
  document.getElementById("shopOverlay").style.display="none";
  battleActive=false;
  currentArena=Object.values(ARENAS)[Math.floor(Math.random()*3)];
  monsters=makeWave(wave);
  announce("Волна "+wave);
  addLog("Волна "+wave+": иди к месту боя!","info");
}
window.buyItem=buyItem;
window.closeShop=closeShop;

// ══ ПРОКАЧКА МЕЖДУ ВОЛНАМИ ═════════════════════════
let upgradeScreen=false, upgradeOptions=[];
const UPG=[
  {label:"Больше HP",     desc:"+20% HP",                  icon:"❤️",  apply(p){p.maxHp=Math.floor(p.maxHp*1.2);}},
  {label:"Острие",        desc:"+25% урон",                 icon:"⚔️",  apply(p){p.atk=[Math.floor(p.atk[0]*1.25),Math.floor(p.atk[1]*1.25)];}},
  {label:"Быстрые ноги",  desc:"+15% скорость",             icon:"💨",  apply(p){p.spd*=1.15;}},
  {label:"Острый клинок", desc:"-20% кулдаун удара",        icon:"⏱️",  apply(p){p.atkCd=Math.floor(p.atkCd*.8);}},
  {label:"Мастер уклонения",desc:"Перекат быстрее",         icon:"🌀",  apply(p){p.dodgeCdBase=(p.dodgeCdBase||1200)*.75;}},
  {label:"Алхимик",       desc:"+2 HP и +1 Эликсир",       icon:"🧪",  apply(){addInventoryItem("hpPotion",2);addInventoryItem("elixir",1);}},
  {label:"Комбо-мастер",  desc:"Комбо x3 вместо x2.2",      icon:"✨",  apply(p){p._comboMult=3;}},
  {label:"Убийца",        desc:"+30% скорость атаки",       icon:"🗡️",  apply(p){p.atkCd=Math.floor(p.atkCd*.7);}},
];
function showUpgradeScreen(){
  upgradeScreen=true;
  upgradeOptions=[...UPG].sort(function(){return Math.random()-.5;}).slice(0,3);
  var el=document.getElementById("upgradeOverlay");
  if(!el){ el=document.createElement("div"); el.id="upgradeOverlay"; el.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100;font-family:Cinzel,serif;"; document.body.appendChild(el); }
  el.innerHTML='<h2 style="color:#f4be5f;font-size:2rem;margin-bottom:8px;text-shadow:0 0 20px #f4be5f88">Выбери улучшение</h2><p style="color:#8899cc;margin-bottom:28px;font-family:Manrope,sans">Волна пройдена! Выбери одно улучшение для героя.</p><div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center">'+upgradeOptions.map(function(u,i){ return '<button onclick="applyUpgrade('+i+')" style="background:linear-gradient(135deg,#0d1828,#1a2840);border:2px solid #334466;color:#cde;padding:22px 24px;border-radius:14px;cursor:pointer;font-family:Manrope,sans;min-width:160px;max-width:200px;" onmouseover="this.style.borderColor=\'#f4be5f\';this.style.transform=\'translateY(-4px)\'" onmouseout="this.style.borderColor=\'#334466\';this.style.transform=\'\'"><div style="font-size:2.2rem">'+u.icon+'</div><div style="font-size:1rem;font-weight:700;color:#f4be5f;margin:8px 0 4px">'+u.label+'</div><div style="font-size:.82rem;color:#8899cc">'+u.desc+'</div></button>'; }).join('')+'</div>';
  el.style.display="flex";
}
function applyUpgrade(idx){
  const u=upgradeOptions[idx];
  if(player&&!player.dead) u.apply(player);
  if(player2&&!player2.dead) u.apply(player2);
  upgradeScreen=false;
  document.getElementById("upgradeOverlay").style.display="none";
  battleActive=false;
  currentArena=Object.values(ARENAS)[Math.floor(Math.random()*3)];
  monsters=makeWave(wave);
  announce("Волна "+wave);
}
window.applyUpgrade=applyUpgrade;


// ══ РЕКОРДЫ ═══════════════════════════════════════
var _records=[];
function loadRecords(){try{_records=JSON.parse(localStorage.getItem("kia_records")||"[]");}catch(e){_records=[];}}
function saveRecord(wavesReached,kills,coinsEarned,heroName,lvl){
  loadRecords();
  _records.push({date:new Date().toLocaleDateString("ru"),wave:wavesReached,kills:kills,coins:coinsEarned,hero:heroName,level:lvl});
  _records.sort(function(a,b){return b.wave-a.wave;});
  _records=_records.slice(0,10);
  try{localStorage.setItem("kia_records",JSON.stringify(_records));}catch(e){}
}
function showRecordsOverlay(){
  loadRecords();
  var el=document.getElementById("recordsOverlay");
  if(!el){el=document.createElement("div");el.id="recordsOverlay";el.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;font-family:Cinzel,serif;";document.body.appendChild(el);}
  var rows=_records.length?_records.map(function(r,i){return'<tr style="color:'+(['#f4be5f','#ccddff','#88aacc'][Math.min(i,2)])+'""><td style="padding:4px 12px">'+(['🥇','🥈','🥉'][i]||'  ')+(i+1)+'.</td><td style="padding:4px 12px">'+r.hero+'</td><td style="padding:4px 12px">Lv.'+r.level+'</td><td style="padding:4px 12px">Волна '+r.wave+'</td><td style="padding:4px 12px">🪙'+r.coins+'</td><td style="padding:4px 12px">'+r.date+'</td></tr>';}).join(""):'<tr><td colspan="6" style="color:#556;padding:20px">Нет рекордов</td></tr>';
  var recHtml='<h2 style="color:#f4be5f;font-size:1.8rem;margin:0 0 16px">🏆 Рекорды</h2>';
  recHtml+='<table style="border-collapse:collapse;color:#cde;font-family:Manrope,sans;font-size:.88rem"><thead><tr style="color:#8899cc;border-bottom:1px solid #334466"><th style="padding:4px 12px">№</th><th>Герой</th><th>Уровень</th><th>Волна</th><th>Монеты</th><th>Дата</th></tr></thead><tbody>'+rows+'</tbody></table>';
  recHtml+='<button id="recCloseBtn" style="margin-top:20px;padding:10px 32px;background:linear-gradient(135deg,#1a2840,#223560);border:1.5px solid #f4be5f;color:#f4be5f;border-radius:10px;font-family:Cinzel,serif;cursor:pointer">Закрыть</button>';
  el.innerHTML=recHtml;
  document.getElementById("recCloseBtn").onclick=function(){el.style.display="none";};
  el.style.display="flex";
}
window.showRecordsOverlay=showRecordsOverlay;
var _sessionKills=0, _sessionCoins=0;


// ══ АЧИВКИ ════════════════════════════════════════
const ACHIEVEMENTS=[
  {id:"kills10",label:"Первая кровь",desc:"Убить 10 врагов",icon:"⚔️",check:function(){return _sessionKills>=10;}},
  {id:"kills50",label:"Воин",desc:"Убить 50 врагов",icon:"🗡️",check:function(){return _sessionKills>=50;}},
  {id:"wave5",label:"Выживший",desc:"Дожить до волны 5",icon:"🏅",check:function(){return wave>=5;}},
  {id:"wave10",label:"Герой",desc:"Дожить до волны 10",icon:"🏆",check:function(){return wave>=10;}},
  {id:"rich",label:"Богач",desc:"Накопить 200 монет",icon:"💰",check:function(){return coins>=200;}},
  {id:"combo",label:"Комбо-мастер",desc:"Сделать КОМБО-удар",icon:"✨",check:function(){return _comboAchiev;}},
  {id:"level5",label:"Легенда",desc:"Достичь 5 уровня",icon:"⭐",check:function(){return player&&player.level>=5;}},
];
var _unlockedAchieves=new Set();
var _comboAchiev=false;
var _pendingAchiev=[];
function checkAchievements(){
  ACHIEVEMENTS.forEach(function(a){
    if(!_unlockedAchieves.has(a.id)&&a.check()){
      _unlockedAchieves.add(a.id);
      _pendingAchiev.push(a);
      showAchievNotif(a);
    }
  });
}
function showAchievNotif(a){
  var el=document.createElement("div");
  el.style.cssText="position:fixed;right:18px;top:18px;background:linear-gradient(135deg,#0d1828,#1a2840);border:2px solid #f4be5f;border-radius:12px;padding:12px 18px;color:#f4be5f;font-family:Cinzel,serif;font-size:.9rem;z-index:500;animation:slideIn .3s ease;max-width:240px;box-shadow:0 4px 24px rgba(244,190,95,.3);";
  el.innerHTML='<div style="font-size:1.5rem">'+a.icon+'</div><div style="font-weight:700;margin:4px 0 2px">'+a.label+'</div><div style="font-size:.75rem;color:#8899cc;font-family:Manrope,sans">'+a.desc+'</div>';
  document.body.appendChild(el);
  setTimeout(function(){el.style.opacity="0";el.style.transition="opacity .5s";setTimeout(function(){el.remove();},500);},3000);
}


// ══ СКИНЫ ═════════════════════════════════════════
const SKINS={
  knight:[
    {name:"Синий",cost:0,color:"#73a5ff"},
    {name:"Золотой",cost:80,color:"#f4be5f"},
    {name:"Алый",cost:100,color:"#ff5555"},
    {name:"Изумрудный",cost:120,color:"#44cc88"},
  ],
  assassin:[
    {name:"Жёлтый",cost:0,color:"#f4be5f"},
    {name:"Лиловый",cost:80,color:"#c47aff"},
    {name:"Стальной",cost:100,color:"#aabbcc"},
    {name:"Огненный",cost:120,color:"#ff6633"},
  ],
  mage:[
    {name:"Фиолетовый",cost:0,color:"#c47aff"},
    {name:"Лазурный",cost:80,color:"#44ddff"},
    {name:"Розовый",cost:100,color:"#ff88cc"},
    {name:"Солнечный",cost:120,color:"#ffcc22"},
  ],
};
var _boughtSkins={};
function loadSkins(){try{_boughtSkins=JSON.parse(localStorage.getItem("kia_skins")||"{}");}catch(e){_boughtSkins={};}}
function saveSkins(){try{localStorage.setItem("kia_skins",JSON.stringify(_boughtSkins));}catch(e){}}
function getActiveSkin(heroKey){
  loadSkins();
  var idx=_boughtSkins[heroKey+"_active"]||0;
  return SKINS[heroKey][idx]||SKINS[heroKey][0];
}

// ══ СОСТОЯНИЕ ИГРЫ ══════════════════════════════════
let player=null, player2=null, monsters=[], wave=1, gameState="menu";
let wavePause=0, lastT=null, chosenKey=null, p2ChosenKey=null;
let battleActive=false, coopMode=false;

function castHeroAbility(p,slot){
  if(!p||p.dead) return;
  const hk=p.isP2?p2ChosenKey:chosenKey;
  const tpl=HEROES[hk];
  if(!tpl) return;
  const map={
    1:{cd:"ab1Cd",max:"ab1Max",cost:tpl.ab1Cost||0,fn:function(){_fireHeroAb1(p);}},
    2:{cd:"ab2Cd",max:"ab2Max",cost:tpl.ab2Cost||0,fn:function(){_fireHeroAb2(p);}},
    3:{cd:"ab3Cd",max:"ab3Max",cost:tpl.ab3Cost||0,fn:function(){_fireHeroAb3(p);}},
    4:{cd:"ab4Cd",max:"ab4Max",cost:tpl.ab4Cost||0,fn:function(){_fireHeroAb4(p);}},
  };
  const s=map[slot];
  if(!s||p[s.cd]>0) return;
  if(!hasResource(p,s.cost)){
    addLog("Недостаточно "+getResourceLabel(p)+" для способности","bad");
    return;
  }
  if(!spendResource(p,s.cost)) return;
  p[s.cd]=p[s.max]||0;
  s.fn();
}

function castWeaponAbility(p){
  if(!p||p.dead) return;
  const w=WEAPON_ABILITIES[p.weaponId||""];
  if(!w) return;
  if(p.weaponCd>0) return;
  if(!hasResource(p,w.cost||0)){
    addLog("Недостаточно "+getResourceLabel(p)+" для умения оружия","bad");
    return;
  }
  if(!spendResource(p,w.cost||0)) return;
  const ok=w.act(p);
  if(ok===false){
    p.mp=clamp(p.mp+(w.cost||0),0,p.maxMp||0);
    return;
  }
  p.weaponCd=w.cd||9000;
  addLog("Оружие: "+w.name,"info");
}

// ══ ВВОД ════════════════════════════════════════════
const keys={};
let mouseBtn=false;
window.addEventListener("keydown",function(e){
  keys[e.code]=true;
  if(["Space","KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyI","KeyJ","KeyK","KeyL","KeyC","BracketLeft","BracketRight","Equal","Minus","NumpadAdd","NumpadSubtract","KeyR","KeyF","KeyG","Digit1","Digit2","Digit3","Digit4","Tab"].includes(e.code)) e.preventDefault();
  if(gameState!=="playing"&&gameState!=="dungeon")return;
  if(e.code==="KeyC") cycleCameraMode();
  if(e.code==="BracketRight"||e.code==="Equal"||e.code==="NumpadAdd") changeCameraZoom(0.08);
  if(e.code==="BracketLeft"||e.code==="Minus"||e.code==="NumpadSubtract") changeCameraZoom(-0.08);
  if(player&&!player.dead){
    if(e.code==="Space") playerManualSwing(player);
    if(e.code==="KeyQ") castHeroAbility(player,1);
    if(e.code==="KeyE") castHeroAbility(player,2);
    if(e.code==="KeyR") castHeroAbility(player,3);
    if(e.code==="KeyF") castHeroAbility(player,4);
    if(e.code==="KeyG") castWeaponAbility(player);
    if(e.code==="Digit1") useInventoryItem("hpPotion",player);
    if(e.code==="Digit2") useInventoryItem("manaPotion",player);
    if(e.code==="Digit3") useInventoryItem("energyPotion",player);
    if(e.code==="Digit4") useInventoryItem("elixir",player);
    if(e.code==="Tab") toggleInventoryOverlay();
    if(e.code==="ShiftLeft"||e.code==="ShiftRight") player.startDodge();
  }
  // Подземелье: T = вернуть камеру на игрока, колёсико = зум уже на мыши
  if(gameState==='dungeon'&&e.code==='KeyT'){ _dragMode=false; resizeDungCam(); }
  if(player2&&!player2.dead){
    if(e.code==="KeyL") playerManualSwing(player2);
    if(e.code==="KeyU") castHeroAbility(player2,1);
    if(e.code==="KeyO") castHeroAbility(player2,2);
    if(e.code==="KeyP") player2.startDodge();
  }
});
window.addEventListener("keyup",function(e){ keys[e.code]=false; });
// ── Drag pan в подземелье (правая/средняя кнопка мыши, или левая когда нет атаки) ──
arena.addEventListener("mousedown",function(e){
  if(gameState==='dungeon'){
    // Правая или средняя — всегда панорама
    if(e.button===1||e.button===2){ e.preventDefault(); _dragActive=true; _dragMode=true; _dragLastX=e.clientX; _dragLastY=e.clientY; return; }
    // Левая — панорама если не вблизи врагов
    if(e.button===0){
      _dragActive=true; _dragLastX=e.clientX; _dragLastY=e.clientY;
      return;
    }
  }
  if(e.button===0){ mouseBtn=true; if(gameState==="playing"&&player&&!player.dead) playerManualSwing(player); }
});
arena.addEventListener("mousemove",function(e){
  if(!_dragActive) return;
  const dx=e.clientX-_dragLastX, dy=e.clientY-_dragLastY;
  _dragLastX=e.clientX; _dragLastY=e.clientY;
  if(Math.abs(dx)+Math.abs(dy)>2) _dragMode=true;
  camX+=dx; camY+=dy;
});
arena.addEventListener("mouseup",function(e){
  _dragActive=false;
  if(e.button===0&&!_dragMode&&gameState==="playing"&&player&&!player.dead) playerManualSwing(player);
  // Сбросить _dragMode после небольшой задержки (чтобы клик не стрелял)
  setTimeout(function(){_dragMode=false;},80);
  mouseBtn=false;
});
arena.addEventListener("mouseleave",function(){ _dragActive=false; mouseBtn=false; });
arena.addEventListener("contextmenu",function(e){ if(gameState==='dungeon') e.preventDefault(); });
// ── Колёсико: приближение/отдаление камеры ──
arena.addEventListener("wheel",function(e){
  if(gameState!=="playing"&&gameState!=="dungeon") return;
  e.preventDefault();
  changeCameraZoom(e.deltaY<0?0.05:-0.05);
},{passive:false});
// ── Touch: один палец/мышь двигает камеру, два пальца двигают карту (без зума) ──
(function(){
  let pt1=null,lastPinchMid=null;
  arena.addEventListener("touchstart",function(e){
    if(gameState!=='dungeon') return;
    if(e.touches.length===1){ pt1={x:e.touches[0].clientX,y:e.touches[0].clientY}; _dragActive=true; }
    if(e.touches.length===2){
      _dragActive=false;
      lastPinchMid={x:(e.touches[0].clientX+e.touches[1].clientX)/2,y:(e.touches[0].clientY+e.touches[1].clientY)/2};
    }
  },{passive:true});
  arena.addEventListener("touchmove",function(e){
    if(gameState!=='dungeon') return;
    e.preventDefault();
    if(e.touches.length===1&&_dragActive&&pt1){
      const dx=e.touches[0].clientX-pt1.x, dy=e.touches[0].clientY-pt1.y;
      camX+=dx; camY+=dy; _dragMode=true;
      pt1={x:e.touches[0].clientX,y:e.touches[0].clientY};
    }
    if(e.touches.length===2){
      const mid={x:(e.touches[0].clientX+e.touches[1].clientX)/2,y:(e.touches[0].clientY+e.touches[1].clientY)/2};
      if(lastPinchMid){
        camX+=mid.x-lastPinchMid.x;
        camY+=mid.y-lastPinchMid.y;
        _dragMode=true;
      }
      lastPinchMid=mid;
    }
  },{passive:false});
  arena.addEventListener("touchend",function(e){ if(e.touches.length===0){_dragActive=false; lastPinchMid=null; setTimeout(function(){_dragMode=false;},120);}},{passive:true});
})();

function playerManualSwing(p){
  if(!p||p.dead||p.atkTimer>0||!(gameState==="playing"||gameState==="dungeon"))return;
  const t=p.closest();
  p.atkTimer=p.atkCd; p.atkAnim=1; p.attackSide=(p.attackSide||1)*-1;
  if(!t||dist2(p,t)>p.atkRange+0.6){
    p.attackHand=p.attackHand==="right"?"left":"right";
    const fx=w2c(p.wx+p.facing*.45,p.wz,.75);
    parts(fx.cx,fx.cy,p.role==="Маг"?((typeof mageElement!=="undefined"&&MAGE_EL_DESCS[mageElement])?MAGE_EL_DESCS[mageElement].color:"#c47aff"):"#b8d4ff",p.role==="Маг"?8:5,2);
    return;
  }
  if(p.role==="Маг"){
    const elCol=(typeof mageElement!=='undefined'&&MAGE_EL_DESCS[mageElement])?MAGE_EL_DESCS[mageElement].color:"#c47aff";
    proj(p,t,p.atk[0],elCol);
  } else p.doSwing(t);
}
function inputUnit(dt,p,upK,dnK,ltK,rtK){
  if(!p||p.dead)return;
  if(p.dodgeTimer>0){
    p.dodgeTimer=Math.max(0,p.dodgeTimer-dt); p.dodgeCd=Math.max(0,p.dodgeCd-dt);
    const spd=8*(dt/1000);
    const ndx=p.wx+p.dodgeVx*spd, ndz=p.wz+p.dodgeVz*spd;
    if(gameState==="dungeon"){ if(dungWalkable(ndx,ndz)){p.wx=ndx;p.wz=ndz;} }
    else { p.wx=clamp(ndx,.25,AW-.25); p.wz=clamp(ndz,.25,AD-.25); }
    p.state="move"; return;
  }
  p.dodgeCd=Math.max(0,p.dodgeCd-dt);
  if(p.comboTimer>0){ p.comboTimer-=dt; if(p.comboTimer<=0) p.comboCount=0; }
  const s=p.spd*(p.freezeMult||1)*(dt/1000); let moved=false;
  const oldWx=p.wx, oldWz=p.wz;
  if(keys[upK])   {p.wz-=s;moved=true;}
  if(keys[dnK])   {p.wz+=s;moved=true;}
  if(keys[ltK])   {p.wx-=s;p.facing=-1;moved=true;}
  if(keys[rtK])   {p.wx+=s;p.facing=1;moved=true;}
  if(moved){
    p.state="move"; p.walkP+=dt*.008;
    if(gameState==="dungeon"){
      if(!dungWalkable(p.wx,p.wz)) { p.wx=oldWx; p.wz=oldWz; }
    } else {
      p.wx=clamp(p.wx,.25,AW-.25); p.wz=clamp(p.wz,.25,AD-.25);
    }
  }
  else if(p.state==="move") p.state="idle";
}
function inputPlayer(dt){
  inputUnit(dt,player,"KeyW","KeyS","KeyA","KeyD");
  if(keys["ArrowUp"]||keys["ArrowDown"]||keys["ArrowLeft"]||keys["ArrowRight"]){
    if(player) inputUnit(dt,player,"ArrowUp","ArrowDown","ArrowLeft","ArrowRight");
  }
  // Джойстик мобильного
  if(player&&!player.dead&&_joy&&_joy.active&&(Math.abs(_joy.dx)>0.08||Math.abs(_joy.dz)>0.08)){
    const s=player.spd*(player.freezeMult||1)*(dt/1000);
    const oldWx=player.wx, oldWz=player.wz;
    player.wx+=_joy.dx*s; player.wz+=_joy.dz*s;
    if(_joy.dx<-0.08) player.facing=-1;
    else if(_joy.dx>0.08) player.facing=1;
    player.state="move"; player.walkP+=dt*.008;
    if(gameState==="dungeon"){
      if(!dungWalkable(player.wx,player.wz)){player.wx=oldWx;player.wz=oldWz;}
    } else {
      player.wx=clamp(player.wx,.25,AW-.25); player.wz=clamp(player.wz,.25,AD-.25);
    }
  }
  if(coopMode&&player2)  inputUnit(dt,player2,"KeyI","KeyK","KeyJ","KeyL");
}


// ══ ПКМ ПРИЦЕЛЬНЫЙ СНАРЯД ════════════════════════
let mouseX=0,mouseY=0;
arena.addEventListener("mousemove",function(e){const r=arena.getBoundingClientRect();mouseX=e.clientX-r.left;mouseY=e.clientY-r.top;});
function projToMouse(owner){
  if(!owner||owner.dead||!battleActive)return;
  // найти монстра ближайшего к курсору
  let best=null,bd=Infinity;
  monsters.filter(function(m){return !m.dead;}).forEach(function(m){
    const mp=w2c(m.wx,m.wz,.8);
    const d=Math.hypot(mp.cx-mouseX,mp.cy-mouseY);
    if(d<bd){bd=d;best=m;}
  });
  if(!best||bd>120)return;
  const dmg=rndI(owner.atk[0],owner.atk[1]);
  proj(owner,best,dmg,owner.color||"#f4be5f",10);
  owner.atkTimer=owner.atkCd;
  const sc=w2c(owner.wx,owner.wz,.8);
  parts(sc.cx,sc.cy,owner.color||"#f4be5f",5,3);
}
arena.addEventListener("contextmenu",function(e){e.preventDefault();if(gameState==="playing"&&player&&!player.dead&&player.atkTimer===0)projToMouse(player);});

// ══ ЛОГ ════════════════════════════════════════════
const logEl=document.getElementById("log");
function addLog(text,kind){
  kind=kind||"info";
  const d=document.createElement("div"); d.className="log-item "+kind; d.textContent=text;
  logEl.prepend(d);
  while(logEl.children.length>30) logEl.lastElementChild.remove();
}

// ══ HUD ════════════════════════════════════════════
function updateHUD(){
  if(!player)return;
  ensureExtendedHUD();
  ensureAdvancedUI();
  document.getElementById("hpBar").style.width=clamp(player.hp/player.maxHp*100,0,100)+"%";
  document.getElementById("hpVal").textContent=player.hp+"/"+player.maxHp;
  const mpLabel=document.getElementById("resourceLabel");
  if(mpLabel) mpLabel.textContent=getResourceLabel(player);
  const mp=player.maxMp>0?clamp(player.mp/player.maxMp*100,0,100):0;
  document.getElementById("mpBar").style.width=mp+"%";
  document.getElementById("mpVal").textContent=player.maxMp>0?player.mp+"/"+player.maxMp:"—";
  document.getElementById("mpRow").style.display=player.maxMp>0?"flex":"none";
  // XP bar
  const xpBar=document.getElementById("xpBar");
  if(xpBar) xpBar.style.width=clamp(player.xp/player.xpNext*100,0,100)+"%";
  const xpVal=document.getElementById("xpVal");
  if(xpVal) xpVal.textContent=player.xp+"/"+player.xpNext;
  const hudLv=document.getElementById("hudLevel");
  if(hudLv) hudLv.textContent="Lv."+player.level;
  document.getElementById("waveNum").textContent=wave;
  document.getElementById("mobCount").textContent=monsters.filter(function(m){return !m.dead;}).length;
  document.getElementById("ab1Cd").style.transform="scaleY("+(player.ab1Cd/player.ab1Max)+")";
  document.getElementById("ab2Cd").style.transform="scaleY("+(player.ab2Cd/player.ab2Max)+")";
  const ab3CdEl=document.getElementById("ab3Cd");
  const ab4CdEl=document.getElementById("ab4Cd");
  const abWCdEl=document.getElementById("abWeaponCd");
  const a1=document.getElementById('ab1');
  const a2=document.getElementById('ab2');
  const a3=document.getElementById('ab3');
  const a4=document.getElementById('ab4');
  const aw=document.getElementById('abWeapon');
  const hk=player.isP2?p2ChosenKey:chosenKey;
  const h=HEROES[hk]||{};
  const w=WEAPON_ABILITIES[player.weaponId||''];
  if(a1) a1.title=(h.ab1Name||'Q')+' | Cost '+(h.ab1Cost||0)+' '+getResourceLabel(player)+' | CD '+Math.round((player.ab1Max||0)/100)/10+'s';
  if(a2) a2.title=(h.ab2Name||'E')+' | Cost '+(h.ab2Cost||0)+' '+getResourceLabel(player)+' | CD '+Math.round((player.ab2Max||0)/100)/10+'s';
  if(a3) a3.title=(h.ab3Name||'R')+' | Cost '+(h.ab3Cost||0)+' '+getResourceLabel(player)+' | CD '+Math.round((player.ab3Max||0)/100)/10+'s';
  if(a4) a4.title=(h.ab4Name||'F')+' | Cost '+(h.ab4Cost||0)+' '+getResourceLabel(player)+' | CD '+Math.round((player.ab4Max||0)/100)/10+'s';
  if(aw&&w) aw.title=w.name+' | Cost '+(w.cost||0)+' '+getResourceLabel(player)+' | CD '+Math.round((w.cd||0)/100)/10+'s';
  if(ab3CdEl) ab3CdEl.style.transform="scaleY("+(player.ab3Cd/Math.max(1,player.ab3Max||1))+")";
  if(ab4CdEl) ab4CdEl.style.transform="scaleY("+(player.ab4Cd/Math.max(1,player.ab4Max||1))+")";
  if(abWCdEl) abWCdEl.style.transform="scaleY("+(player.weaponCd/Math.max(1,player.weaponMax||1))+")";
  var ci=document.getElementById("coinHud");
  if(ci) ci.textContent="🪙 "+coins+" | "+gameplayMode+" | AccLv."+metaProgress.accountLv+" BP."+metaProgress.bpTier;
  updateInventoryUI();
  checkAchievements();
}

// ══ ОБЪЯВЛЕНИЕ ════════════════════════════════════
let ANN={text:"",alpha:0,timer:0};
function announce(t){ANN={text:t,alpha:1,timer:2200};}
function tickAnn(dt){ if(ANN.timer>0){ANN.timer-=dt;ANN.alpha=Math.min(1,ANN.timer/600);} }
function drawAnn(){
  if(ANN.alpha<=0)return;
  ctx.save(); ctx.globalAlpha=ANN.alpha; ctx.textAlign="center";
  ctx.font="bold 46px Cinzel,serif"; ctx.fillStyle="#f4be5f";
  ctx.shadowColor="#f4be5f"; ctx.shadowBlur=28;
  ctx.fillText(ANN.text,arena.width/2,arena.height*.17); ctx.restore();
}

// ══ КОНЕЦ ════════════════════════════════════════
let _recordSaved=false;
function drawEnd(){
  if(!_recordSaved&&player){
    _recordSaved=true;
    _sessionCoins+=coins;
    saveRecord(wave,_sessionKills,_sessionCoins,player.name,player.level);
    registerRunResult();
  }
  ctx.save(); ctx.fillStyle="rgba(0,0,0,.82)"; ctx.fillRect(0,0,arena.width,arena.height);
  ctx.textAlign="center"; const win=gameState==="victory";
  ctx.font="bold 56px Cinzel,serif"; ctx.fillStyle=win?"#4ec97a":"#f06058"; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=32;
  ctx.fillText(win?"ПОБЕДА!":"ПОРАЖЕНИЕ",arena.width/2,arena.height*0.32);
  ctx.shadowBlur=0;
  const stats=[
    {l:"Волна",v:wave},
    {l:"Убийств",v:_sessionKills},
    {l:"Монет",v:_sessionCoins+(coins||0)},
    {l:"Уровень",v:player?player.level:1},
  ];
  const bx=arena.width/2, by=arena.height*.44;
  ctx.fillStyle="rgba(10,20,40,.75)"; rrect(ctx,bx-160,by-14,320,stats.length*36+20,12);
  ctx.font="bold 15px Manrope,sans-serif";
  stats.forEach(function(s,i){
    ctx.fillStyle="#8899cc"; ctx.textAlign="right"; ctx.fillText(s.l+":",bx-10,by+i*36+8);
    ctx.fillStyle="#f4be5f"; ctx.textAlign="left"; ctx.fillText(s.v,bx+10,by+i*36+8);
  });
  ctx.font="bold 16px Manrope,sans-serif"; ctx.fillStyle="#88aacc"; ctx.textAlign="center"; ctx.shadowBlur=8;
  ctx.fillText('Нажмите "Меню" для выхода',bx,by+stats.length*36+34);
  ctx.restore();
}

// ══ НЕБО ══════════════════════════════════════════
let stars=[];
function genStars(){ stars=Array.from({length:120},function(){return {x:rnd(0,1),y:rnd(0,.6),r:rnd(.3,1.6),a:rnd(.2,.95),flicker:rnd(0,6.28)};}); }
function drawSky(){
  const W=arena.width,H=arena.height;
  const t=_torchT*.001;
  // градиент неба
  const g=ctx.createLinearGradient(0,0,0,H*.7);
  g.addColorStop(0,currentArena.skyTop); g.addColorStop(.7,currentArena.skyBot); g.addColorStop(1,"rgba(0,0,0,.7)");
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // туманные облака/аура (3 радиальных пятна)
  [[.25,.3,.6],[.65,.2,.45],[.5,.45,.35]].forEach(function(n,i){
    const gn=ctx.createRadialGradient(n[0]*W,n[1]*H,0,n[0]*W,n[1]*H,W*n[2]);
    gn.addColorStop(0,currentArena.torchGlow+(0.06+0.03*Math.sin(t+i))+')');
    gn.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gn; ctx.fillRect(0,0,W,H);
  });
  // мерцающие звёзды
  stars.forEach(function(s){
    const a=s.a*(0.6+0.4*Math.sin(t*1.5+s.flicker));
    ctx.globalAlpha=a; ctx.fillStyle=currentArena.starColor||"#fff";
    ctx.shadowColor=currentArena.starColor; ctx.shadowBlur=s.r>1.1?6:0;
    ctx.beginPath(); ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha=1; ctx.shadowBlur=0;
  // туман горизонта
  const fog=ctx.createLinearGradient(0,H*.45,0,H*.72);
  fog.addColorStop(0,"transparent"); fog.addColorStop(1,currentArena.fogColor||"rgba(10,28,52,.65)");
  ctx.fillStyle=fog; ctx.fillRect(0,H*.45,W,H*.27);
}

// ══ СИСТЕМА ОЧКОВ НАВЫКОВ / УРОВНЕЙ ГЕРОЕВ ══════════════
const HERO_SAVE_KEY='kia_hero_progress';
let heroProgress={
  knight:{level:1,xp:0,sp:0,unlocked:[],coins:0,weapon:'sw_iron',purchasedWeapons:[],equipment:{weapon:null,armor:null,ring:null,amulet:null},gearStash:[],presets:[],craft:{shards:0,runes:[]}},
  assassin:{level:1,xp:0,sp:0,unlocked:[],coins:0,weapon:'dg_basic',purchasedWeapons:[],equipment:{weapon:null,armor:null,ring:null,amulet:null},gearStash:[],presets:[],craft:{shards:0,runes:[]}},
  mage:{level:1,xp:0,sp:0,unlocked:[],element:'fire',coins:0,weapon:'st_wood',purchasedWeapons:[],equipment:{weapon:null,armor:null,ring:null,amulet:null},gearStash:[],presets:[],craft:{shards:0,runes:[]}},
};
function loadHeroProgress(){
  try{
    const d=JSON.parse(localStorage.getItem(HERO_SAVE_KEY)||'{}');
    ['knight','assassin','mage'].forEach(function(k){
      if(d[k]){
        heroProgress[k].level=d[k].level||1;
        heroProgress[k].xp=d[k].xp||0;
        heroProgress[k].sp=d[k].sp||0;
        heroProgress[k].unlocked=d[k].unlocked||[];
        heroProgress[k].coins=d[k].coins||0;
        heroProgress[k].weapon=d[k].weapon||defaultWeaponFor(k);
        heroProgress[k].purchasedWeapons=d[k].purchasedWeapons||[];
        heroProgress[k].equipment=d[k].equipment||{weapon:null,armor:null,ring:null,amulet:null};
        heroProgress[k].gearStash=d[k].gearStash||[];
        heroProgress[k].presets=d[k].presets||[];
        heroProgress[k].craft=d[k].craft||{shards:0,runes:[]};
        if(k==='mage') heroProgress[k].element=d[k].element||'fire';
      }
    });
  }catch(e){}
}
function saveHeroProgress(){
  localStorage.setItem(HERO_SAVE_KEY,JSON.stringify(heroProgress));
}
function xpForLevel(lv){ return 100 + (lv-1)*80; }
function addHeroXp(key,amount){
  if(!key||!heroProgress[key]) return;
  const h=heroProgress[key];
  h.xp+=amount;
  let leveled=false;
  while(h.xp>=xpForLevel(h.level)){
    h.xp-=xpForLevel(h.level);
    h.level++; h.sp++;
    leveled=true;
  }
  saveHeroProgress();
  updateMenuHeroLevels();
  if(leveled) announce("🌟 "+HEROES[key].name+" — Уровень "+h.level+"! (+1 навык)","good");
}
function getSkillTreeKey(key){
  if(key!=='mage') return key;
  return 'mage_'+(heroProgress.mage.element||'fire');
}
function applyUnlockedSkills(p,key){
  if(!p||!heroProgress[key]) return;
  const unlocked=heroProgress[key].unlocked;
  const treeKey=getSkillTreeKey(key);
  const tree=SKILL_TREES[treeKey];
  if(!tree) return;
  unlocked.forEach(function(id){
    const sk=tree.skills.find(function(s){return s.id===id;});
    if(sk) sk.apply(p);
  });
}
function updateMenuHeroLevels(){
  ['knight','assassin','mage'].forEach(function(k){
    const h=heroProgress[k];
    const xpPct=Math.min(100,(h.xp/xpForLevel(h.level))*100);
    const fill=document.getElementById('xpbar-'+k);
    if(fill) fill.style.width=xpPct+'%';
    const sp=document.getElementById('sklv-'+k);
    if(sp) sp.textContent=h.sp>0?'('+h.sp+' очк.)':'— Ур.'+h.level;
  });
}

// ══ ENDGAME SYSTEMS ══════════════════════════════════════════
const META_KEY='kia_meta_progress';
let gameplayMode='classic';
let modeTimeLeft=0;
let raidStage=0;
let onlineLite={enabled:false,nick:'Player',room:'',channel:null,peers:0};
let encounterZones=[];
let encounterTimer=0;
let bossPhaseState={};

let metaProgress={
  accountLv:1, accountXp:0,
  bpTier:1, bpXp:0,
  seasonGoals:{kills:0,waves:0,bosses:0},
  dailyBoards:[],
  seasonBoards:[],
};

const RARITY_TABLE={
  common:{name:'Обычный',mult:1,color:'#aab3c2'},
  rare:{name:'Редкий',mult:1.18,color:'#5fb2ff'},
  epic:{name:'Эпический',mult:1.42,color:'#c47aff'},
  legendary:{name:'Легендарный',mult:1.75,color:'#f4be5f'},
};
const GEAR_SETS=['Буря','Страж','Пустота','Алхимик'];
const AFFIX_POOL=[
  {k:'atkPct',name:'+ATK %',v:[6,16]},
  {k:'hpPct',name:'+HP %',v:[8,20]},
  {k:'cdrPct',name:'-CD %',v:[5,14]},
  {k:'spdPct',name:'+SPD %',v:[4,12]},
  {k:'resPct',name:'-DMG %',v:[4,10]},
];
const RUNES=[
  {id:'r_fire',name:'Руна Огня',k:'atkPct',v:6,color:'#ff7b34'},
  {id:'r_ward',name:'Руна Щита',k:'resPct',v:5,color:'#88bbff'},
  {id:'r_haste',name:'Руна Ветра',k:'spdPct',v:6,color:'#b5f2ff'},
  {id:'r_time',name:'Руна Времени',k:'cdrPct',v:6,color:'#d9a2ff'},
];

function seasonId(){
  const d=new Date();
  const q=Math.floor(d.getMonth()/3)+1;
  return d.getFullYear()+'-Q'+q;
}
function dayId(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function loadMetaProgress(){
  try{
    const d=JSON.parse(localStorage.getItem(META_KEY)||'{}');
    metaProgress.accountLv=d.accountLv||1;
    metaProgress.accountXp=d.accountXp||0;
    metaProgress.bpTier=d.bpTier||1;
    metaProgress.bpXp=d.bpXp||0;
    metaProgress.seasonGoals=d.seasonGoals||{kills:0,waves:0,bosses:0};
    metaProgress.dailyBoards=d.dailyBoards||[];
    metaProgress.seasonBoards=d.seasonBoards||[];
  }catch(e){}
}
function saveMetaProgress(){
  try{ localStorage.setItem(META_KEY,JSON.stringify(metaProgress)); }catch(e){}
}
function gainMetaXp(v){
  v=Math.max(0,v||0);
  metaProgress.accountXp+=v;
  while(metaProgress.accountXp>=metaProgress.accountLv*120){
    metaProgress.accountXp-=metaProgress.accountLv*120;
    metaProgress.accountLv++;
    announce('Аккаунт Lv.'+metaProgress.accountLv);
  }
  metaProgress.bpXp+=v;
  while(metaProgress.bpXp>=100){
    metaProgress.bpXp-=100;
    metaProgress.bpTier++;
  }
  saveMetaProgress();
}
function pushBoard(arr,key,row){
  const out=(arr||[]).filter(function(r){ return r[key]===row[key]; });
  out.push(row);
  out.sort(function(a,b){ return b.score-a.score; });
  return out.slice(0,25);
}
function registerRunResult(){
  const score=Math.floor((_sessionKills||0)*7 + (wave||1)*30 + (coins||0)*0.7);
  const row={
    nick:onlineLite.nick||'Player',
    hero:player?player.name:'—',
    mode:gameplayMode,
    score:score,
    kills:_sessionKills||0,
    wave:wave||1,
    day:dayId(),
    season:seasonId(),
  };
  metaProgress.dailyBoards=pushBoard(metaProgress.dailyBoards,'day',row);
  metaProgress.seasonBoards=pushBoard(metaProgress.seasonBoards,'season',row);
  saveMetaProgress();
  if(onlineLite.channel){
    onlineLite.channel.postMessage({type:'lb_push',row:row});
  }
}
function openLeaderboards(){
  const el=document.getElementById('recordsOverlay')||document.createElement('div');
  if(!el.id){ el.id='recordsOverlay'; document.body.appendChild(el); }
  el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;z-index:250;';
  const d=dayId(), s=seasonId();
  const dRows=metaProgress.dailyBoards.filter(function(r){return r.day===d;});
  const sRows=metaProgress.seasonBoards.filter(function(r){return r.season===s;});
  const mk=function(rows){
    if(!rows.length) return '<tr><td colspan="5" style="color:#556;padding:10px">Пусто</td></tr>';
    return rows.slice(0,10).map(function(r,i){
      return '<tr><td style="padding:3px 8px">'+(i+1)+'</td><td>'+r.nick+'</td><td>'+r.mode+'</td><td>'+r.hero+'</td><td>'+r.score+'</td></tr>';
    }).join('');
  };
  el.innerHTML=''
    +'<div style="width:min(900px,94vw);background:linear-gradient(135deg,#0b1526,#121f39);border:1px solid #334b77;border-radius:14px;padding:14px;color:#cfe">'
    +'<h2 style="font-family:Cinzel,serif;color:#f4be5f;margin-bottom:10px">Лидерборды (день/сезон)</h2>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap">'
    +'<div style="flex:1;min-width:280px"><div style="color:#88aacc;margin-bottom:6px">День '+d+'</div><table style="width:100%;font-size:12px"><thead><tr><th>#</th><th>Ник</th><th>Режим</th><th>Герой</th><th>Счёт</th></tr></thead><tbody>'+mk(dRows)+'</tbody></table></div>'
    +'<div style="flex:1;min-width:280px"><div style="color:#88aacc;margin-bottom:6px">Сезон '+s+'</div><table style="width:100%;font-size:12px"><thead><tr><th>#</th><th>Ник</th><th>Режим</th><th>Герой</th><th>Счёт</th></tr></thead><tbody>'+mk(sRows)+'</tbody></table></div>'
    +'</div>'
    +'<div style="margin-top:12px;color:#88aacc;font-size:12px">Онлайн-лидерборд: lite-режим через общий канал вкладок. Для настоящего интернета нужен сервер.</div>'
    +'<button id="lbClose" style="margin-top:10px;padding:8px 18px;border:1px solid #f4be5f;background:#1a2a45;color:#f4be5f;border-radius:8px">Закрыть</button>'
    +'</div>';
  document.getElementById('lbClose').onclick=function(){ el.style.display='none'; };
}

function rollRarity(){
  const r=Math.random();
  if(r<0.58) return 'common';
  if(r<0.84) return 'rare';
  if(r<0.96) return 'epic';
  return 'legendary';
}
function rndAffix(){
  const a=AFFIX_POOL[rndI(0,AFFIX_POOL.length-1)];
  return {k:a.k,name:a.name,val:rndI(a.v[0],a.v[1])};
}
function slotBaseName(slot){
  if(slot==='weapon') return 'Оружие';
  if(slot==='armor') return 'Броня';
  if(slot==='ring') return 'Кольцо';
  return 'Амулет';
}
function rollGearDrop(u){
  const slot=['weapon','armor','ring','amulet'][rndI(0,3)];
  const rar=rollRarity();
  const affCount=rar==='legendary'?2:rar==='epic'?2:1;
  const aff=[];
  for(let i=0;i<affCount;i++) aff.push(rndAffix());
  const g={
    id:'g_'+Date.now()+'_'+rndI(100,999),
    slot:slot,
    rarity:rar,
    set:GEAR_SETS[rndI(0,GEAR_SETS.length-1)],
    name:RARITY_TABLE[rar].name+' '+slotBaseName(slot),
    affixes:aff,
    sockets:rar==='common'?0:(rar==='rare'?1:2),
    runes:[],
    ilvl:(u&&u.isBoss)?(10+wave*2):(5+wave),
    upg:0,
  };
  if(rar==='legendary') g.unique='legendary_'+rndI(1,5);
  return g;
}
function gearScore(g){
  if(!g) return 0;
  let s=(g.ilvl||1)*(RARITY_TABLE[g.rarity]?RARITY_TABLE[g.rarity].mult:1);
  (g.affixes||[]).forEach(function(a){ s+=a.val*0.4; });
  s+=(g.upg||0)*1.8;
  s+=(g.runes||[]).length*2;
  return s;
}
function tryAutoEquip(heroKey,g){
  const h=heroProgress[heroKey]; if(!h) return;
  h.equipment=h.equipment||{weapon:null,armor:null,ring:null,amulet:null};
  const cur=h.equipment[g.slot];
  if(!cur||gearScore(g)>gearScore(cur)) h.equipment[g.slot]=g;
}
function applyGearAndSets(p,key){
  const h=heroProgress[key]; if(!h) return;
  const eq=h.equipment||{};
  const pieces=[eq.weapon,eq.armor,eq.ring,eq.amulet].filter(Boolean);
  const bySet={};
  pieces.forEach(function(g){ bySet[g.set]=(bySet[g.set]||0)+1; });
  pieces.forEach(function(g){
    (g.affixes||[]).forEach(function(a){
      if(a.k==='atkPct'){ p.atk=[Math.floor(p.atk[0]*(1+a.val/100)),Math.floor(p.atk[1]*(1+a.val/100))]; }
      if(a.k==='hpPct'){ p.maxHp=Math.floor(p.maxHp*(1+a.val/100)); p.hp=Math.min(p.hp,p.maxHp); }
      if(a.k==='cdrPct'){ const m=Math.max(0.55,1-a.val/100); p.atkCd=Math.floor(p.atkCd*m); p.ab1Max=Math.floor(p.ab1Max*m); p.ab2Max=Math.floor(p.ab2Max*m); p.ab3Max=Math.floor(p.ab3Max*m); p.ab4Max=Math.floor(p.ab4Max*m); }
      if(a.k==='spdPct'){ p.spd*=1+a.val/100; }
      if(a.k==='resPct'){ p._dmgReduce=(p._dmgReduce||0)+a.val/100; }
    });
    (g.runes||[]).forEach(function(r){
      if(r.k==='atkPct'){ p.atk=[Math.floor(p.atk[0]*(1+r.v/100)),Math.floor(p.atk[1]*(1+r.v/100))]; }
      if(r.k==='resPct'){ p._dmgReduce=(p._dmgReduce||0)+r.v/100; }
      if(r.k==='spdPct'){ p.spd*=1+r.v/100; }
      if(r.k==='cdrPct'){ const m=Math.max(0.6,1-r.v/100); p.ab1Max=Math.floor(p.ab1Max*m); p.ab2Max=Math.floor(p.ab2Max*m); }
    });
  });
  Object.keys(bySet).forEach(function(s){
    if(bySet[s]>=2){ p.atk=[Math.floor(p.atk[0]*1.08),Math.floor(p.atk[1]*1.08)]; }
    if(bySet[s]>=4){ p.maxHp=Math.floor(p.maxHp*1.16); p._dmgReduce=(p._dmgReduce||0)+0.12; }
  });
}
function addGearDrop(u){
  if(!chosenKey||!heroProgress[chosenKey]) return;
  if(Math.random()>0.33) return;
  const g=rollGearDrop(u);
  const h=heroProgress[chosenKey];
  h.gearStash=h.gearStash||[];
  h.gearStash.push(g);
  h.craft=h.craft||{shards:0,runes:[]};
  h.craft.shards=(h.craft.shards||0)+rndI(2,6);
  if(Math.random()<0.2) h.craft.runes.push(RUNES[rndI(0,RUNES.length-1)]);
  tryAutoEquip(chosenKey,g);
  saveHeroProgress();
  addLog('Лут: '+g.name+' ['+RARITY_TABLE[g.rarity].name+']','good');
}

function ensureAdvancedUI(){
  const right=document.querySelector('.hud-right');
  if(right&&!document.getElementById('equipBtn')){
    const e=document.createElement('button'); e.id='equipBtn'; e.className='btn-hud'; e.textContent='Экипировка';
    e.addEventListener('click',openEquipmentPanel);
    right.insertBefore(e,right.firstChild);
  }
  if(right&&!document.getElementById('modeBtn')){
    const m=document.createElement('button'); m.id='modeBtn'; m.className='btn-hud'; m.textContent='Режим: '+gameplayMode;
    m.addEventListener('click',function(){ cycleMode(); });
    right.insertBefore(m,right.firstChild);
  }
}
function cycleMode(){
  const arr=['classic','timed','endless','raid'];
  gameplayMode=arr[(arr.indexOf(gameplayMode)+1)%arr.length];
  const b=document.getElementById('modeBtn'); if(b) b.textContent='Режим: '+gameplayMode;
}
function openEquipmentPanel(){
  if(!chosenKey||!heroProgress[chosenKey]) return;
  const h=heroProgress[chosenKey];
  const el=document.getElementById('equipOverlay')||document.createElement('div');
  if(!el.id){ el.id='equipOverlay'; document.body.appendChild(el); }
  el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;z-index:280;';
  const eq=h.equipment||{};
  const row=function(g){
    if(!g) return '<div style="color:#667">—</div>';
    const aff=(g.affixes||[]).map(function(a){return a.name+' '+a.val+'%';}).join(', ');
    return '<div style="color:'+((RARITY_TABLE[g.rarity]||{}).color||'#cde')+'">'+g.name+' <small style="color:#889">'+aff+'</small></div>';
  };
  const stash=(h.gearStash||[]).slice(-16).reverse().map(function(g){
    return '<button onclick="equipGear(\''+g.id+'\')" style="width:100%;text-align:left;background:#101a2e;border:1px solid #334466;color:#cde;border-radius:8px;padding:6px;margin:4px 0">'+g.name+' ['+g.slot+']</button>';
  }).join('')||'<div style="color:#667">Пусто</div>';
  const runes=(h.craft&&h.craft.runes||[]).slice(-8).map(function(r,i){
    return '<button onclick="socketRune('+i+')" style="background:#1c253d;border:1px solid #445;color:'+r.color+';border-radius:6px;padding:4px 8px;margin:3px">'+r.name+'</button>';
  }).join('')||'<div style="color:#667">Нет рун</div>';
  el.innerHTML=''
    +'<div style="width:min(980px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(135deg,#0d1828,#13233f);border:1px solid #33507d;border-radius:14px;padding:14px;color:#cde">'
    +'<h3 style="font-family:Cinzel,serif;color:#f4be5f">Экипировка / Крафт / Пресеты</h3>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div><div style="color:#88aacc">Экипировано</div><div>Weapon: '+row(eq.weapon)+'</div><div>Armor: '+row(eq.armor)+'</div><div>Ring: '+row(eq.ring)+'</div><div>Amulet: '+row(eq.amulet)+'</div>'
    +'<div style="margin-top:8px;color:#88aacc">Крафт</div><div>Осколки: '+((h.craft&&h.craft.shards)||0)+'</div>'
    +'<button onclick="upgradeEquipped()" style="margin-top:6px;background:#1b2e4a;border:1px solid #5577aa;color:#cde;border-radius:8px;padding:6px 10px">Улучшить экипированное (25 оск.)</button>'
    +'<div style="margin-top:6px;color:#88aacc">Руны в сокеты (в weapon)</div><div>'+runes+'</div>'
    +'</div>'
    +'<div><div style="color:#88aacc">Хранилище лута</div>'+stash+'</div>'
    +'</div>'
    +'<div style="margin-top:10px">'
    +'<button onclick="savePreset(0)" style="margin-right:6px">Сохранить пресет 1</button><button onclick="loadPreset(0)">Загрузить пресет 1</button>'
    +'<button onclick="savePreset(1)" style="margin-left:12px;margin-right:6px">Сохранить пресет 2</button><button onclick="loadPreset(1)">Загрузить пресет 2</button>'
    +'</div>'
    +'<button id="equipClose" style="margin-top:10px;padding:8px 16px;background:#1b2d48;border:1px solid #f4be5f;color:#f4be5f;border-radius:8px">Закрыть</button>'
    +'</div>';
  document.getElementById('equipClose').onclick=function(){ el.style.display='none'; };
}
window.equipGear=function(id){
  if(!chosenKey||!heroProgress[chosenKey]) return;
  const h=heroProgress[chosenKey];
  const g=(h.gearStash||[]).find(function(x){return x.id===id;});
  if(!g) return;
  h.equipment[g.slot]=g;
  saveHeroProgress();
  openEquipmentPanel();
};
window.upgradeEquipped=function(){
  if(!chosenKey||!heroProgress[chosenKey]) return;
  const h=heroProgress[chosenKey]; h.craft=h.craft||{shards:0,runes:[]};
  if((h.craft.shards||0)<25){ addLog('Нужно 25 осколков','bad'); return; }
  const eq=h.equipment||{};
  ['weapon','armor','ring','amulet'].forEach(function(s){ if(eq[s]) eq[s].upg=(eq[s].upg||0)+1; });
  h.craft.shards-=25;
  saveHeroProgress();
  openEquipmentPanel();
};
window.socketRune=function(idx){
  if(!chosenKey||!heroProgress[chosenKey]) return;
  const h=heroProgress[chosenKey];
  if(!h.equipment||!h.equipment.weapon){ addLog('Сначала экипируй weapon','bad'); return; }
  const w=h.equipment.weapon;
  w.runes=w.runes||[];
  if((w.runes||[]).length>=(w.sockets||0)){ addLog('Нет свободных сокетов','bad'); return; }
  const r=(h.craft&&h.craft.runes||[])[idx]; if(!r) return;
  w.runes.push(r);
  h.craft.runes.splice(idx,1);
  saveHeroProgress();
  openEquipmentPanel();
};
window.savePreset=function(i){
  if(!chosenKey||!heroProgress[chosenKey]) return;
  const h=heroProgress[chosenKey];
  h.presets=h.presets||[];
  h.presets[i]=JSON.parse(JSON.stringify(h.equipment||{}));
  saveHeroProgress();
  addLog('Пресет '+(i+1)+' сохранён','good');
};
window.loadPreset=function(i){
  if(!chosenKey||!heroProgress[chosenKey]) return;
  const h=heroProgress[chosenKey];
  if(!h.presets||!h.presets[i]){ addLog('Пустой пресет','bad'); return; }
  h.equipment=JSON.parse(JSON.stringify(h.presets[i]));
  saveHeroProgress();
  addLog('Пресет '+(i+1)+' загружен','good');
  openEquipmentPanel();
};

function tickEncounterEvents(dt){
  if(gameState!=='playing'&&gameState!=='dungeon') return;
  encounterTimer-=dt;
  if(encounterTimer<=0&&battleActive){
    encounterTimer=9000;
    encounterZones.push({x:rnd(1,AW-1),z:rnd(1,AD-1),r:rnd(0.8,1.4),t:3200,dmg:rndI(35,60)});
    addLog('Механика: опасная зона!','bad');
  }
  for(let i=encounterZones.length-1;i>=0;i--){
    const z=encounterZones[i]; z.t-=dt;
    if(z.t<=0){ encounterZones.splice(i,1); continue; }
    [player,player2].filter(function(h){return h&&!h.dead;}).forEach(function(h){
      const d=Math.hypot(h.wx-z.x,h.wz-z.z);
      if(d<z.r&&z.t%600<dt){ h.hit(z.dmg); }
    });
  }
  monsters.filter(function(m){return !m.dead&&m.isBoss;}).forEach(function(b){
    const hpPct=b.hp/Math.max(1,b.maxHp);
    const bid=b.name+'_'+b.maxHp;
    const ph=bossPhaseState[bid]||0;
    if(hpPct<0.75&&ph<1){ bossPhaseState[bid]=1; b.atk=[Math.floor(b.atk[0]*1.12),Math.floor(b.atk[1]*1.12)]; addLog('Фаза босса I','bad'); }
    if(hpPct<0.5&&ph<2){ bossPhaseState[bid]=2; b.spd*=1.15; addLog('Фаза босса II','bad'); }
    if(hpPct<0.25&&ph<3){ bossPhaseState[bid]=3; encounterZones.push({x:b.wx,z:b.wz,r:1.8,t:4000,dmg:65}); addLog('Фаза босса III: взрывная зона','bad'); }
  });
}
function drawEncounterZones(){
  encounterZones.forEach(function(z){
    const p=w2c(z.x,z.z,0);
    ctx.save();
    ctx.globalAlpha=.22+.2*Math.sin(performance.now()*.01);
    ctx.fillStyle='#ff5533';
    ctx.beginPath(); ctx.ellipse(p.cx,p.cy,62*z.r,22*z.r,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=.7; ctx.strokeStyle='#ff9966'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(p.cx,p.cy,62*z.r,22*z.r,0,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  });
}

function initOnlineLite(){
  try{
    onlineLite.channel=new BroadcastChannel('kia_online_lite');
    onlineLite.channel.onmessage=function(ev){
      const m=ev.data||{};
      if(m.type==='hello'){ onlineLite.peers=m.count||onlineLite.peers; }
      if(m.type==='lb_push'&&m.row){
        metaProgress.dailyBoards=pushBoard(metaProgress.dailyBoards,'day',m.row);
        metaProgress.seasonBoards=pushBoard(metaProgress.seasonBoards,'season',m.row);
        saveMetaProgress();
      }
    };
  }catch(e){}
}

// ══ МОДАЛ ДЕРЕВА НАВЫКОВ ════════════════════════════════
function showSkillTree(heroKey){
  const h=heroProgress[heroKey];
  const treeKey=getSkillTreeKey(heroKey);
  const tree=SKILL_TREES[treeKey];
  if(!tree) return;
  const modal=document.getElementById('skillModal');
  document.getElementById('skillHeroLv').textContent='Ур. '+h.level;
  document.getElementById('skillSPBadge').textContent='⭐ '+h.sp+' очков';
  document.getElementById('skillXpFill').style.width=Math.min(100,(h.xp/xpForLevel(h.level))*100)+'%';
  // Build tree by tiers
  const tiers={};
  tree.skills.forEach(function(sk){
    if(!tiers[sk.tier]) tiers[sk.tier]=[null,null,null,null];
    tiers[sk.tier][sk.col-1]=sk;
  });
  let html='';
  const maxTier=Math.max.apply(null,tree.skills.map(function(s){return s.tier;}));
  for(let t=1;t<=maxTier;t++){
    html+='<div class="skill-tier-label">Уровень '+t+'</div><div class="skill-tier">';
    (tiers[t]||[]).forEach(function(sk){
      if(!sk){html+='<div style="width:126px;min-height:10px;opacity:0;pointer-events:none;border:none;"></div>';return;}
      const isUnlocked=h.unlocked.includes(sk.id);
      const reqMet=sk.req.every(function(r){return h.unlocked.includes(r);});
      const canAfford=h.sp>=sk.cost;
      const cls=isUnlocked?'unlocked':(!reqMet?'locked':(canAfford?'available':'skill-node'));
      const costBadge=isUnlocked?'':'<span class="skill-node-cost">'+sk.cost+'⭐</span>';
      const okBadge=isUnlocked?'<span class="skill-ok">✓ Изучено</span>':'';
      html+='<div class="skill-node '+cls+'" data-hero="'+heroKey+'" data-sid="'+sk.id+'" onclick="_skillClick(this)">';
      html+=costBadge;
      html+='<span class="skill-node-icon">'+sk.icon+'</span>';
      html+='<span class="skill-node-name">'+sk.name+'</span>';
      html+='<span class="skill-node-desc">'+sk.desc+'</span>';
      html+=okBadge;
      html+='</div>';
    });
    html+='</div>';
    if(t<maxTier) html+='<div class="skill-arrow">↓</div>';
  }
  document.getElementById('skillTreeContent').innerHTML=html;
  modal.classList.add('active');
  _skillModalHero=heroKey;
}
let _skillModalHero=null;
function buySkill(heroKey,skillId){
  const h=heroProgress[heroKey];
  if(h.unlocked.includes(skillId)){return;}
  const treeKey=getSkillTreeKey(heroKey);
  const tree=SKILL_TREES[treeKey];
  const sk=tree.skills.find(function(s){return s.id===skillId;});
  if(!sk) return;
  if(!sk.req.every(function(r){return h.unlocked.includes(r);})){
    announce("Сначала изучи предыдущий навык!"); return;
  }
  if(h.sp<sk.cost){ announce("Недостаточно очков навыков!"); return; }
  h.sp-=sk.cost;
  h.unlocked.push(skillId);
  saveHeroProgress();
  // Apply to player if active hero
  if(player&&chosenKey===heroKey) sk.apply(player);
  showSkillTree(heroKey); // Refresh
  updateMenuHeroLevels();
  announce("🌟 Навык '"+sk.name+"' изучен!");
}
function _skillClick(el){
  buySkill(el.dataset.hero, el.dataset.sid);
}
const skillCloseBtn = document.getElementById('skillCloseBtn');
const skillModal = document.getElementById('skillModal');
if(skillCloseBtn&&skillModal){
  skillCloseBtn.addEventListener('click',function(){
    skillModal.classList.remove('active');
  });
  skillModal.addEventListener('click',function(e){
    if(e.target===this) this.classList.remove('active');
  });
}

// ══ ВЫБОР ЭЛЕМЕНТА МАГА ═════════════════════════════════
const EL_COLORS={fire:'#ff6633',water:'#44aaff',earth:'#88bb44',air:'#c8e8ff'};
document.querySelectorAll('.el-btn').forEach(function(btn){
  btn.addEventListener('click',function(e){
    e.stopPropagation();
    const el=this.dataset.el;
    heroProgress.mage.element=el;
    mageElement=el;
    saveHeroProgress();
    document.querySelectorAll('.el-btn').forEach(function(b){b.classList.remove('active');});
    this.classList.add('active');
    // Update mage card visual
    const card=document.querySelector('[data-hero="mage"]');
    if(card) card.style.borderColor=EL_COLORS[el];
  });
});

// ══ DRAG КАМЕРЫ МЫШЬЮ/ТАЧЕМ ════════════════════════════
let _dragState={active:false,startX:0,startY:0,startCamX:0,startCamY:0};
function isDragMode(){ return gameState==='playing'||gameState==='dungeon'; }
arena.addEventListener('mousedown',function(e){
  if(e.button===2||e.button===1||
    (e.button===0&&e.shiftKey)){ // правая/средняя или Shift+ЛКМ
    _dragState.active=true;
    _dragState.startX=e.clientX; _dragState.startY=e.clientY;
    _dragState.startCamX=camX; _dragState.startCamY=camY;
    e.preventDefault();
  }
});
arena.addEventListener('mousemove',function(e){
  if(_dragState.active){
    camX=_dragState.startCamX+(e.clientX-_dragState.startX);
    camY=_dragState.startCamY+(e.clientY-_dragState.startY);
  }
});
arena.addEventListener('mouseup',function(e){
  if(e.button===2||e.button===1||e.button===0) _dragState.active=false;
});
arena.addEventListener('mouseleave',function(){ _dragState.active=false; });
// Touch drag
let _touchDrag={active:false,id:-1,startX:0,startY:0,startCamX:0,startCamY:0};
arena.addEventListener('touchstart',function(e){
  if(e.touches.length===2){
    _touchDrag.active=true; _touchDrag.id=e.touches[0].identifier;
    _touchDrag.startX=e.touches[0].clientX; _touchDrag.startY=e.touches[0].clientY;
    _touchDrag.startCamX=camX; _touchDrag.startCamY=camY;
  }
},{passive:true});
arena.addEventListener('touchmove',function(e){
  if(_touchDrag.active&&e.touches.length===2){
    const t=e.touches[0];
    camX=_touchDrag.startCamX+(t.clientX-_touchDrag.startX);
    camY=_touchDrag.startCamY+(t.clientY-_touchDrag.startY);
  }
},{passive:true});
arena.addEventListener('touchend',function(){ _touchDrag.active=false; },{passive:true});

// ══ МОБИЛЬНЫЙ ДЖОЙСТИК ═════════════════════════════════
const joyArea=document.getElementById('joyArea');
const joyKnob=document.getElementById('joyKnob');
let _joy={active:false,id:-1,baseX:0,baseY:0,dx:0,dz:0};
const JOY_MAX=36;
function _joyUpdate(cx,cy){
  if(!joyArea||!joyKnob) return;
  const rect=joyArea.getBoundingClientRect();
  const bx=rect.left+rect.width/2, by=rect.top+rect.height/2;
  let dx=cx-bx, dy=cy-by;
  const d=Math.hypot(dx,dy);
  if(d>JOY_MAX){dx=dx/d*JOY_MAX;dy=dy/d*JOY_MAX;}
  joyKnob.style.transform='translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))';
  _joy.dx=dx/JOY_MAX; _joy.dz=dy/JOY_MAX;
}
if(joyArea&&joyKnob){
  joyArea.addEventListener('touchstart',function(e){
    e.preventDefault();
    _joy.active=true; _joy.id=e.changedTouches[0].identifier;
    _joyUpdate(e.changedTouches[0].clientX,e.changedTouches[0].clientY);
  },{passive:false});
  joyArea.addEventListener('touchmove',function(e){
    e.preventDefault();
    for(let i=0;i<e.changedTouches.length;i++){
      if(e.changedTouches[i].identifier===_joy.id)
        _joyUpdate(e.changedTouches[i].clientX,e.changedTouches[i].clientY);
    }
  },{passive:false});
  joyArea.addEventListener('touchend',function(e){
    e.preventDefault();
    _joy.active=false; _joy.dx=0; _joy.dz=0;
    joyKnob.style.transform='translate(-50%,-50%)';
  },{passive:false});
}

// ── Кнопки мобильного управления
const mbAtk=document.getElementById('mb-atk');
const mbQ=document.getElementById('mb-q');
const mbE=document.getElementById('mb-e');
const mbDodge=document.getElementById('mb-dodge');
if(mbAtk){
  mbAtk.addEventListener('touchstart',function(e){
    e.preventDefault();
    if(player&&!player.dead) playerManualSwing(player);
  },{passive:false});
}
if(mbQ){
  mbQ.addEventListener('touchstart',function(e){
    e.preventDefault();
    if(player&&!player.dead) castHeroAbility(player,1);
  },{passive:false});
}
if(mbE){
  mbE.addEventListener('touchstart',function(e){
    e.preventDefault();
    if(player&&!player.dead) castHeroAbility(player,2);
  },{passive:false});
}
if(mbDodge){
  mbDodge.addEventListener('touchstart',function(e){
    e.preventDefault();
    if(player&&!player.dead) player.startDodge();
  },{passive:false});
}

function _fireHeroAb1(p){
  const hk=p&&p.isP2?p2ChosenKey:chosenKey;
  if(hk==='mage'){
    const el=MAGE_EL_DESCS[mageElement||'fire']; el.ab1(p);
  } else {
    HEROES[hk].ab1(p);
  }
}
function _fireHeroAb2(p){
  const hk=p&&p.isP2?p2ChosenKey:chosenKey;
  if(hk==='mage'){
    const el=MAGE_EL_DESCS[mageElement||'fire']; el.ab2(p);
  } else {
    HEROES[hk].ab2(p);
  }
}
function _fireHeroAb3(p){
  if(!p||p.dead) return;
  if(p.role==="Мечник"){
    monsters.filter(function(m){return !m.dead&&dist2(p,m)<2.1;}).forEach(function(m){dealDmg(p,m,rndI(75,110));m.stunTimer=700;});
    const c=w2c(p.wx,p.wz,.5); parts(c.cx,c.cy,"#b9d2ff",18,4); screenShake(10,220);
    addLog(p.name+" — Щитовой удар!","info");
    return;
  }
  if(p.role==="Убийца"){
    const t=p.closest(); if(!t) return;
    const dx=t.wx-p.wx,dz=t.wz-p.wz,l=Math.hypot(dx,dz)||1;
    p.wx=clamp(t.wx-dx/l*0.8,.2,AW-.2); p.wz=clamp(t.wz-dz/l*0.8,.2,AD-.2);
    dealDmg(p,t,rndI(95,130));
    const c=w2c(p.wx,p.wz,.7); parts(c.cx,c.cy,"#e8cf8b",16,4);
    addLog(p.name+" — Шаг тени!","info");
    return;
  }
  monsters.filter(function(m){return !m.dead&&dist2(p,m)<2.4;}).forEach(function(m){dealDmg(p,m,rndI(85,120));});
  const c=w2c(p.wx,p.wz,.6); parts(c.cx,c.cy,"#cc99ff",20,5); addLog(p.name+" — Мистическая вспышка!","info");
}
function _fireHeroAb4(p){
  if(!p||p.dead) return;
  if(p.role==="Мечник"){
    p._dmgReduce=(p._dmgReduce||0)+0.2;
    setTimeout(function(){ p._dmgReduce=Math.max(0,(p._dmgReduce||0)-0.2); },5000);
    addLog(p.name+" — Боевой клич: защита усилена!","good");
    return;
  }
  if(p.role==="Убийца"){
    monsters.filter(function(m){return !m.dead&&dist2(p,m)<2.6;}).forEach(function(m){dealDmg(p,m,rndI(90,120));});
    p.spd+=0.35; setTimeout(function(){p.spd=Math.max(2,p.spd-0.35);},5000);
    addLog(p.name+" — Клинковая буря!","info");
    return;
  }
  p._dmgReduce=(p._dmgReduce||0)+0.18;
  setTimeout(function(){ p._dmgReduce=Math.max(0,(p._dmgReduce||0)-0.18); },5500);
  monsters.filter(function(m){return !m.dead&&dist2(p,m)<2.8;}).forEach(function(m){dealDmg(p,m,rndI(80,110));});
  addLog(p.name+" — Арканный купол!","info");
}

// ── Показывать мобильный HUD когда игра идёт
function showMobileControls(show){
  const mc=document.getElementById('mobileControls');
  if(!mc) return;
  if(show) mc.classList.add('active');
  else mc.classList.remove('active');
}
function ensureExtendedHUD(){
  const abWrap=document.querySelector('.abilities');
  if(abWrap&&!document.getElementById('ab3')){
    const mk=function(id,key,label,cdId){
      const d=document.createElement('div');
      d.className='ability'; d.id=id;
      d.innerHTML='<kbd>'+key+'</kbd><span id="'+label+'">—</span><div class="cd-overlay" id="'+cdId+'"></div>';
      return d;
    };
    abWrap.appendChild(mk('ab3','R','ab3Name','ab3Cd'));
    abWrap.appendChild(mk('ab4','F','ab4Name','ab4Cd'));
    abWrap.appendChild(mk('abWeapon','G','abWeaponName','abWeaponCd'));
  }
  const right=document.querySelector('.hud-right');
  if(right&&!document.getElementById('invBtn')){
    const b=document.createElement('button');
    b.id='invBtn'; b.className='btn-hud'; b.textContent='Инвентарь (Tab)';
    b.addEventListener('click',toggleInventoryOverlay);
    right.insertBefore(b,right.firstChild);
  }
  if(!document.getElementById('invOverlay')){
    const ov=document.createElement('div');
    ov.id='invOverlay';
    ov.style.cssText='position:fixed;right:14px;bottom:96px;z-index:120;background:rgba(5,12,24,.92);border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:10px;min-width:220px;display:none;';
    ov.innerHTML=''
      +'<div style="font-family:Cinzel,serif;color:#f4be5f;font-size:14px;margin-bottom:8px">Инвентарь</div>'
      +'<button id="invHpBtn" style="display:block;width:100%;margin:4px 0;padding:7px;border-radius:8px;background:#1a3a26;border:1px solid #4ec97a;color:#cfe">1) HP зелье x<span id="invHpVal">0</span></button>'
      +'<button id="invManaBtn" style="display:block;width:100%;margin:4px 0;padding:7px;border-radius:8px;background:#1a2f52;border:1px solid #66aaff;color:#cfe">2) MP зелье x<span id="invManaVal">0</span></button>'
      +'<button id="invEnergyBtn" style="display:block;width:100%;margin:4px 0;padding:7px;border-radius:8px;background:#4b390f;border:1px solid #f4be5f;color:#f9e8bf">3) EN зелье x<span id="invEnergyVal">0</span></button>'
      +'<button id="invElixirBtn" style="display:block;width:100%;margin:4px 0;padding:7px;border-radius:8px;background:#3c1f52;border:1px solid #d9a2ff;color:#f2dcff">4) Эликсир x<span id="invElixirVal">0</span></button>'
      +'<div style="font-family:Cinzel,serif;color:#f4be5f;font-size:13px;margin:10px 0 6px">Оружие</div>'
      +'<div id="invWeaponList"></div>';
    document.body.appendChild(ov);
    document.getElementById('invHpBtn').onclick=function(){useInventoryItem('hpPotion',player);};
    document.getElementById('invManaBtn').onclick=function(){useInventoryItem('manaPotion',player);};
    document.getElementById('invEnergyBtn').onclick=function(){useInventoryItem('energyPotion',player);};
    document.getElementById('invElixirBtn').onclick=function(){useInventoryItem('elixir',player);};
  }
  updateInventoryUI();
}
function updateInventoryUI(){
  const hp=document.getElementById('invHpVal'); if(hp) hp.textContent=String(invCount('hpPotion'));
  const mana=document.getElementById('invManaVal'); if(mana) mana.textContent=String(invCount('manaPotion'));
  const en=document.getElementById('invEnergyVal'); if(en) en.textContent=String(invCount('energyPotion'));
  const ex=document.getElementById('invElixirVal'); if(ex) ex.textContent=String(invCount('elixir'));
  updateWeaponSlotsUI();
}
function updateWeaponSlotsUI(){
  const list=document.getElementById('invWeaponList');
  if(!list||!chosenKey||!heroProgress[chosenKey]) return;
  const h=heroProgress[chosenKey];
  const owned=[defaultWeaponFor(chosenKey),...(h.purchasedWeapons||[])];
  const WBONUS={sw_iron:15,sw_steel:35,sw_shadow:60,sw_legend:100,ax_war:50,sp_pike:40,
    dg_basic:10,dg_poison:28,dg_twin:45,dg_void:80,bow_short:35,sc_fan:30,
    st_wood:10,st_fire:35,st_ice:30,st_storm:55,st_arch:90,tome_anc:40};
  const WNAME={sw_iron:'Железный меч',sw_steel:'Стальной клинок',sw_shadow:'Теневой клинок',sw_legend:'Меч Легенды',ax_war:'Боевой топор',sp_pike:'Пика',
    dg_basic:'Кинжал',dg_poison:'Яд.кинжал',dg_twin:'Парные клинки',dg_void:'Клинок пустоты',bow_short:'Лук',sc_fan:'Сюрикены',
    st_wood:'Жезл',st_fire:'Огн.посох',st_ice:'Лед.посох',st_storm:'Посох бури',st_arch:'Архон.посох',tome_anc:'Фолиант'};
  const cur=player?player.weaponId:(h.weapon||defaultWeaponFor(chosenKey));
  list.innerHTML=owned.map(function(wid){
    const active=wid===cur;
    return '<button onclick="switchWeaponMidBattle(\''+wid+'\')" style="display:block;width:100%;margin:3px 0;padding:6px 8px;border-radius:8px;background:'+(active?'#1e3a5f':'#111a2a')+';border:1px solid '+(active?'#66aaff':'#334466')+';color:'+(active?'#adf':'#99b');
    +';text-align:left;font-size:12px;cursor:pointer;">'+(active?'✔ ':'')+( WNAME[wid]||wid)+' (+'+( WBONUS[wid]||0)+' атк)</button>';
  }).join('');
}
function switchWeaponMidBattle(wid){
  if(!player||!chosenKey||!heroProgress[chosenKey]) return;
  const h=heroProgress[chosenKey];
  const WBONUS={sw_iron:15,sw_steel:35,sw_shadow:60,sw_legend:100,ax_war:50,sp_pike:40,
    dg_basic:10,dg_poison:28,dg_twin:45,dg_void:80,bow_short:35,sc_fan:30,
    st_wood:10,st_fire:35,st_ice:30,st_storm:55,st_arch:90,tome_anc:40};
  const base=HEROES[chosenKey];
  if(!base) return;
  // Recalculate atk from base
  const oldBonus=WBONUS[player.weaponId]||0;
  const newBonus=WBONUS[wid]||0;
  player.atk=[player.atk[0]-oldBonus+newBonus,player.atk[1]-oldBonus+newBonus];
  player.weaponId=wid;
  h.weapon=wid;
  saveHeroProgress();
  dmgt(arena.width/2,arena.height*0.3,'Оружие: '+(wid),'#f4be5f');
  addLog('Сменил оружие: '+wid,'info');
  updateWeaponSlotsUI();
  updateHUD();
}
function toggleInventoryOverlay(){
  const ov=document.getElementById('invOverlay');
  if(!ov) return;
  ov.style.display=ov.style.display==='none'||!ov.style.display?'block':'none';
  if(ov.style.display==='block') updateWeaponSlotsUI();
}
function isMobileDevice(){
  const ua=navigator.userAgent||"";
  return /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(ua)||navigator.maxTouchPoints>1;
}

// ══ ИНИЦИАЛИЗАЦИЯ ГЕРОЕВ ════════════════════════════════
loadHeroProgress();
mageElement=heroProgress.mage.element||'fire';
// Mark default el btn active
document.querySelectorAll('.el-btn').forEach(function(b){
  b.classList.toggle('active',b.dataset.el===mageElement);
});
updateMenuHeroLevels();


// ══ ГЛАВНЫЙ ЦИКЛ ════════════════════════════════════
function loop(ts){
  try{
    const dt=lastT?Math.min(ts-lastT,50):16; lastT=ts;
    if(gameState==="dungeon"){
      if(!dungDescending) inputPlayer(dt);
      if(dungDescending) dungDescentT=Math.min(dungDescentT+dt,900);
      if(dungAscending){ dungAscendT+=dt; if(dungAscendT>=700) dungAscending=false; }
      updateDungCam();
      if(player&&!player.dead){
        player.atkTimer=Math.max(0,player.atkTimer-dt);
        player.ab1Cd=Math.max(0,player.ab1Cd-dt); player.ab2Cd=Math.max(0,player.ab2Cd-dt);
        player.ab3Cd=Math.max(0,player.ab3Cd-dt); player.ab4Cd=Math.max(0,player.ab4Cd-dt);
        player.weaponCd=Math.max(0,player.weaponCd-dt);
        if(player.atkAnim>0) player.atkAnim=Math.max(0,player.atkAnim-dt/280);
        if(player.dualStrikeT>0) player.dualStrikeT=Math.max(0,player.dualStrikeT-dt);
      }
      if(!player||player.dead){ setTimeout(function(){gameState="defeat";},300); }
      monsters.forEach(function(m){
        m.aiUpdate(dt);
        if(m.poisonTicks>0){m.poisonTimer-=dt;if(m.poisonTimer<=0){m.poisonTimer=800;m.poisonTicks--;const src={name:"Яд",isHero:true};dealDmg(src,m,m.poisonDmg);const cv=w2c(m.wx,m.wz,.5);parts(cv.cx,cv.cy,"#80ff80",4,2);}}
      });
      // Passive aura effects (dungeon)
      if(player&&!player.dead&&battleActive){
        if(!player._auraTick) player._auraTick=0; player._auraTick-=dt;
        if(player._auraTick<=0){ player._auraTick=800;
          monsters.forEach(function(m){
            if(m.dead) return;
            const d=Math.hypot(m.wx-player.wx,m.wz-player.wz);
            if(d>2.2) return;
            if(player._fireAura){ m.burnTimer=1800; m.burnDmg=Math.floor(8+player.level*2); m.burnTick=0; const mc=w2c(m.wx,m.wz,.5); parts(mc.cx,mc.cy,"#ff6600",3,2); }
            if(player._stormAura){ dealDmg(player,m,Math.floor(12+player.level*3)); const mc=w2c(m.wx,m.wz,.5); parts(mc.cx,mc.cy,"#88eeff",4,2); }
          });
        }
      }
      tickProj(dt); tickParts(dt); tickDmgt(dt); tickAnn(dt); tickDrops(dt); tickChests(dt); tickShake(dt); _torchT+=dt;
      tickEncounterEvents(dt);
      // логика комнат и выхода
      dungRooms.forEach(function(r,ri){
        if(r.visited) return;
        if(player.wx>=r.x-.5&&player.wx<r.x+r.w+.5&&player.wz>=r.y-.5&&player.wz<r.y+r.h+.5){
          r.visited=true;
          const alive=r.mIds.map(function(id){return monsters[id];}).filter(function(m){return m&&!m.dead;});
          if(alive.length>0){
            battleActive=true;
            if(dungFloor===MAX_DUNGEON_FLOOR&&ri===dungRooms.length-1){
              screenShake(20,800); announce("ФИНАЛЬНЫЙ БОСС: ГРОМОВОЙ ВОЛК!");
            } else { announce("Враги!"); }
          }
        }
      });
      if(battleActive){
        const alive=monsters.filter(function(m){return !m.dead;});
        if(alive.length===0){
          battleActive=false;
          dungExitOpen=true;
          if(dungFloor===MAX_DUNGEON_FLOOR){
            announce("ПОБЕДА! Громовой Волк повержен!");
            setTimeout(function(){gameState="victory";},2200);
          } else {
            announce("Найди лестницу и спустись вниз!");
            addLog("Враги пали! Ищи лестницу вниз ▼","good");
          }
        }
      }
      checkDungExit();
      updateHUD();
      ctx.save(); applyShake(); ctx.clearRect(0,0,arena.width,arena.height);
      drawSky(); drawDungeonMap();
      drawEncounterZones();
      const allU=[...monsters,(dungDescending||dungAscending?null:player)].filter(Boolean);
      allU.filter(function(u){return !u.dead;}).sort(function(a,b){return a.wz-b.wz;}).forEach(function(u){u.draw();});
      allU.filter(function(u){return u.dead;}).forEach(function(u){u.draw();});
      drawProj(); drawParts(); drawDmgt(); drawAnn();
      // ── Анимация спуска по лестнице ──
      if(dungDescending && player){
        const t=Math.min(dungDescentT/900,1);
        const sc=Math.max(0.01,1-t);
        const sinkY=t*48;
        const {cx,cy}=w2c(player.wx,player.wz);
        // тёмный oval — яма поглощает игрока (cx/cy уже с камерой из w2c)
        ctx.save();
        ctx.globalAlpha=Math.min(0.92,t*1.5);
        ctx.fillStyle='rgba(0,0,0,0.95)';
        ctx.beginPath();
        ctx.ellipse(cx,cy+10,player.r*(0.45+t),player.r*(0.12+t*0.3),0,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
        // игрок уменьшается и уходит вниз
        ctx.save();
        ctx.globalAlpha=Math.max(0,1-t*1.6);
        ctx.translate(cx, cy+sinkY);
        ctx.scale(sc,sc);
        ctx.translate(-cx,-(cy+sinkY));
        player._descentDraw=true;
        player.draw();
        player._descentDraw=false;
        ctx.restore();
      }
      // ── Анимация появления на новом этаже (спрыгнул сверху) ──
      if(dungAscending && player){
        const ta=Math.min(dungAscendT/700,1);
        const sc2=0.1+ta*0.9;
        const riseY=(1-ta)*-36;
        const {cx:acx,cy:acy}=w2c(player.wx,player.wz);
        ctx.save();
        ctx.globalAlpha=Math.min(1,ta*2.0);
        ctx.translate(acx,acy+riseY);
        ctx.scale(sc2,sc2);
        ctx.translate(-acx,-(acy+riseY));
        player.draw();
        ctx.restore();
      }
      ctx.restore();
      drawDungHUD();
      updateHUD();
      if(gameState==="defeat"||gameState==="victory") drawEnd();
      requestAnimationFrame(loop); return;
    }
    if(gameState==="playing"&&!upgradeScreen){
      inputPlayer(dt);
      updateFollowCam();
      if(!battleActive&&player&&!player.dead&&monsters.length>0){
        const alive=monsters.filter(function(m){return !m.dead;});
        var triggered=false;
        if(player){ const n=alive.reduce(function(b,m){const d=dist2(player,m);return(!b||d<b.d)?{m,d}:b;},null); if(n&&n.d<=3.5) triggered=true; }
        if(coopMode&&player2&&!player2.dead){ const n=alive.reduce(function(b,m){const d=dist2(player2,m);return(!b||d<b.d)?{m,d}:b;},null); if(n&&n.d<=3.5) triggered=true; }
        if(triggered){ battleActive=true; announce("БОЙ НАЧАЛСЯ!"); addLog("Бой начался!","bad"); }
      }
      if(player&&!player.dead){ player.atkTimer=Math.max(0,player.atkTimer-dt); player.ab1Cd=Math.max(0,player.ab1Cd-dt); player.ab2Cd=Math.max(0,player.ab2Cd-dt); player.ab3Cd=Math.max(0,player.ab3Cd-dt); player.ab4Cd=Math.max(0,player.ab4Cd-dt); player.weaponCd=Math.max(0,player.weaponCd-dt); if(player.atkAnim>0) player.atkAnim=Math.max(0,player.atkAnim-dt/280); if(player.dualStrikeT>0) player.dualStrikeT=Math.max(0,player.dualStrikeT-dt); }
      if(player2&&!player2.dead){ player2.atkTimer=Math.max(0,player2.atkTimer-dt); player2.ab1Cd=Math.max(0,player2.ab1Cd-dt); player2.ab2Cd=Math.max(0,player2.ab2Cd-dt); player2.ab3Cd=Math.max(0,player2.ab3Cd-dt); player2.ab4Cd=Math.max(0,player2.ab4Cd-dt); player2.weaponCd=Math.max(0,player2.weaponCd-dt); if(player2.atkAnim>0) player2.atkAnim=Math.max(0,player2.atkAnim-dt/280); if(player2.dualStrikeT>0) player2.dualStrikeT=Math.max(0,player2.dualStrikeT-dt); }
      monsters.forEach(function(m){
        m.aiUpdate(dt);
        if(m.poisonTicks>0){ m.poisonTimer-=dt; if(m.poisonTimer<=0){ m.poisonTimer=800; m.poisonTicks--; const src={name:"Яд",isHero:true}; dealDmg(src,m,m.poisonDmg); const c=w2c(m.wx,m.wz,.5); parts(c.cx,c.cy,"#80ff80",4,2); } }
      });
      // Passive aura effects
      [player,player2].forEach(function(p){
        if(!p||p.dead||!battleActive) return;
        if(!p._auraTick) p._auraTick=0; p._auraTick-=dt;
        if(p._auraTick>0) return; p._auraTick=800;
        const auraR=2.2;
        monsters.forEach(function(m){
          if(m.dead) return;
          const d=Math.hypot(m.wx-p.wx,m.wz-p.wz);
          if(d>auraR) return;
          if(p._fireAura){ m.burnTimer=1800; m.burnDmg=Math.floor(8+p.level*2); m.burnTick=0; const mc=w2c(m.wx,m.wz,.5); parts(mc.cx,mc.cy,"#ff6600",3,2); }
          if(p._stormAura){ dealDmg(p,m,Math.floor(12+p.level*3)); const mc=w2c(m.wx,m.wz,.5); parts(mc.cx,mc.cy,"#88eeff",4,2); }
        });
      });
      tickProj(dt); tickParts(dt); tickDmgt(dt); tickAnn(dt); tickDrops(dt); tickChests(dt); tickShake(dt); _torchT+=dt;
      tickEncounterEvents(dt);
      if(gameplayMode==='timed'){
        modeTimeLeft=Math.max(0,modeTimeLeft-dt);
        if(modeTimeLeft<=0&&gameState==='playing'){
          gameState='victory';
          announce('Время вышло! Подсчёт результатов');
        }
      }
      if(monsters.length>0&&monsters.every(function(m){return m.dead;})){
        wavePause+=dt;
        if(wavePause>1800){
          wavePause=0;
          wave++;
          metaProgress.seasonGoals.waves=(metaProgress.seasonGoals.waves||0)+1;
          gainMetaXp(16);
          saveMetaProgress();
          if(gameplayMode==='raid'){
            raidStage++;
            if(raidStage>=5){ gameState='victory'; announce('Рейд завершён!'); }
            else { monsters=[makeMonster(5+raidStage*5)]; battleActive=true; announce('Рейд босс '+(raidStage+1)); }
          } else if(gameplayMode==='endless'||gameplayMode==='timed'){
            battleActive=false;
            currentArena=Object.values(ARENAS)[Math.floor(Math.random()*3)];
            monsters=makeWave(wave+2);
            if(wave%3===0){ CHESTS.length=0; spawnChest(AW/2+rnd(-2,2),AD/2+rnd(-1,1)); }
            announce('Волна '+wave);
          } else {
            CHESTS.length=0;
            spawnChest(AW/2+rnd(-2,2),AD/2+rnd(-1,1));
            showUpgradeScreen();
          }
        }
      }
      updateHUD();
    } else if(!upgradeScreen){ tickParts(dt); tickDmgt(dt); }

    ctx.save(); applyShake(); ctx.clearRect(0,0,arena.width,arena.height);
    drawSky(); drawWalls(); drawFloor(); drawDrops(); drawChests();
    drawEncounterZones();
    const allU=[...monsters,(player||null),(player2||null)].filter(Boolean);
    allU.filter(function(u){return !u.dead;}).sort(function(a,b){return a.wz-b.wz;}).forEach(function(u){u.draw();});
    allU.filter(function(u){return u.dead;}).forEach(function(u){u.draw();});
    drawProj(); drawParts(); drawDmgt(); drawAnn();
    ctx.restore();
    drawArenaMiniMap();
    if(gameState==="playing"&&!battleActive&&!upgradeScreen) drawApproachHint();
    if(gameState==="defeat"||gameState==="victory") drawEnd();
    if(coopMode&&player2&&!player2.dead){
      ctx.save(); ctx.font="12px Manrope,sans"; ctx.fillStyle="rgba(200,220,255,.55)"; ctx.textAlign="right";
      ctx.fillText("P2: IJKL движение | L атака | P перекат | U/O способности",arena.width-10,arena.height-10);
      ctx.restore();
    }
  } catch(err){
    console.error("Loop error:",err);
    ctx.clearRect(0,0,arena.width,arena.height);
    ctx.fillStyle="#000"; ctx.fillRect(0,0,arena.width,arena.height);
    ctx.fillStyle="#f06058"; ctx.font="bold 22px Manrope,sans-serif"; ctx.textAlign="center";
    ctx.fillText("Ошибка: "+err.message,arena.width/2,arena.height/2);
  }
  requestAnimationFrame(loop);
}

// ══ ПОДСКАЗКА ПОДХОДА ══════════════════════════════
function drawApproachHint(){
  if(!monsters.length)return;
  const alive=monsters.filter(function(m){return !m.dead;}); if(!alive.length)return;
  const cx=alive.reduce(function(s,m){return s+m.wx;},0)/alive.length;
  const cz=alive.reduce(function(s,m){return s+m.wz;},0)/alive.length;
  const sc=w2c(cx,cz,0); const t=performance.now();
  const pulse=0.55+0.45*Math.sin(t*.004);
  ctx.save(); ctx.globalAlpha=.22*pulse; ctx.fillStyle="#f4be5f";
  ctx.beginPath(); ctx.ellipse(sc.cx,sc.cy,68*pulse,22*pulse,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=.55*pulse; ctx.strokeStyle="#f4be5f"; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.ellipse(sc.cx,sc.cy,68*pulse,22*pulse,0,0,Math.PI*2); ctx.stroke(); ctx.restore();
  if(!player)return;
  const ps=w2c(player.wx,player.wz,1);
  const dx=sc.cx-ps.cx, dy=sc.cy-ps.cy, d=Math.hypot(dx,dy);
  if(d<60)return;
  const nx=dx/d, ny=dy/d, ax=ps.cx+nx*60, ay=ps.cy+ny*60;
  ctx.save(); ctx.globalAlpha=.75+.25*Math.sin(t*.006);
  ctx.strokeStyle="#f4be5f"; ctx.lineWidth=3; ctx.lineCap="round"; ctx.shadowColor="#f4be5f"; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ax+nx*40,ay+ny*40); ctx.stroke();
  const ang=Math.atan2(ny,nx);
  ctx.beginPath(); ctx.moveTo(ax+nx*40,ay+ny*40); ctx.lineTo(ax+nx*40-14*Math.cos(ang-.45),ay+ny*40-14*Math.sin(ang-.45)); ctx.moveTo(ax+nx*40,ay+ny*40); ctx.lineTo(ax+nx*40-14*Math.cos(ang+.45),ay+ny*40-14*Math.sin(ang+.45)); ctx.stroke();
  ctx.font="bold 17px Manrope,sans-serif"; ctx.textAlign="center"; ctx.fillStyle="#f4be5f"; ctx.shadowBlur=16;
  ctx.fillText("Иди к месту боя!",arena.width/2,arena.height*.12); ctx.restore();
}

function drawArenaMiniMap(){
  if(gameState!=="playing") return;
  const W=arena.width,H=arena.height;
  const MW=132,MH=96,MX=W-MW-14,MY=58;
  ctx.save();
  ctx.globalAlpha=.9;
  ctx.fillStyle="rgba(0,0,0,.58)";
  rrPath(ctx,MX-4,MY-4,MW+8,MH+8,10);
  ctx.fill();
  const bg=ctx.createLinearGradient(MX,MY,MX,MY+MH);
  bg.addColorStop(0,"rgba(38,56,84,.84)");
  bg.addColorStop(1,"rgba(18,28,44,.84)");
  ctx.fillStyle=bg;
  rrPath(ctx,MX,MY,MW,MH,8);
  ctx.fill();

  ctx.strokeStyle="rgba(255,255,255,.14)";
  ctx.lineWidth=1;
  for(let i=1;i<4;i++){
    const gx=MX+i*(MW/4), gy=MY+i*(MH/4);
    ctx.beginPath(); ctx.moveTo(gx,MY); ctx.lineTo(gx,MY+MH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(MX,gy); ctx.lineTo(MX+MW,gy); ctx.stroke();
  }

  const sx=MW/AW, sz=MH/AD;
  monsters.filter(function(m){return !m.dead;}).forEach(function(m){
    ctx.fillStyle=m.isBoss?"#ff7b5a":"#ff564b";
    ctx.beginPath(); ctx.arc(MX+m.wx*sx,MY+m.wz*sz,m.isBoss?4:2.6,0,Math.PI*2); ctx.fill();
  });
  if(player&&!player.dead){
    ctx.fillStyle="#ffe866";
    ctx.beginPath(); ctx.arc(MX+player.wx*sx,MY+player.wz*sz,3.5,0,Math.PI*2); ctx.fill();
  }
  if(player2&&!player2.dead){
    ctx.fillStyle="#6fc4ff";
    ctx.beginPath(); ctx.arc(MX+player2.wx*sx,MY+player2.wz*sz,3.2,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=.8;
  ctx.fillStyle="#d4e6ff";
  ctx.font="10px Manrope,sans-serif";
  ctx.textAlign="right";
  ctx.fillText("Карта",MX+MW-6,MY+12);
  ctx.restore();
}

// ══ МЕНЮ ПРЕВЬЮ ═══════════════════════════════════

// ══ АНИМИРОВАННЫЙ ФОН МЕНЮ ═══════════════════════
let menuParticles=[];
let menuAnimId=null;
function initMenuParticles(mc){
  menuParticles=Array.from({length:60},function(){
    return {x:Math.random()*mc.width,y:Math.random()*mc.height,r:Math.random()*1.8+0.4,
      vx:(Math.random()-.5)*.25,vy:-Math.random()*.3-.1,a:Math.random()*.7+.15,
      col:["#aaccff","#c47aff","#f4be5f","#88ddff"][Math.floor(Math.random()*4)]};
  });
}
function animateMenuBg(){
  const mc=document.getElementById("menuBg");
  if(!mc||!mc.offsetParent){menuAnimId=requestAnimationFrame(animateMenuBg);return;}
  const c=mc.getContext("2d"); const W=mc.width,H=mc.height;
  c.clearRect(0,0,W,H);
  const g=c.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#03070e"); g.addColorStop(1,"#0b1c36");
  c.fillStyle=g; c.fillRect(0,0,W,H);
  // руны пульсируют
  const t=Date.now()*.001;
  [["#4466ff",.12,W*.15,H*.8],["#9944cc",.1,W*.5,H*.9],["#ff5522",.1,W*.82,H*.85]].forEach(function(a){
    c.globalAlpha=a[1]*(0.7+0.3*Math.sin(t+a[2]*.01));
    const rg=c.createRadialGradient(a[2],a[3],0,a[2],a[3],280);
    rg.addColorStop(0,a[0]); rg.addColorStop(1,"transparent");
    c.fillStyle=rg; c.fillRect(0,0,W,H);
  });
  c.globalAlpha=1;
  // мерцающие звёзды
  for(let i=0;i<120;i++){
    const sx=(i*137+50)%W, sy=(i*97+20)%(H*.75);
    const pulse=0.2+0.5*Math.abs(Math.sin(t*(.5+i*.07)));
    c.globalAlpha=pulse; c.fillStyle="#fff";
    c.beginPath(); c.arc(sx,sy,Math.random()*.8+.3,0,Math.PI*2); c.fill();
  }
  c.globalAlpha=1;
  // парящие частицы
  menuParticles.forEach(function(p){
    p.x+=p.vx; p.y+=p.vy;
    if(p.y<-10) p.y=H+5;
    if(p.x<-10) p.x=W+5; if(p.x>W+10) p.x=-5;
    c.globalAlpha=p.a*(0.6+0.4*Math.sin(t*2+p.x*.01));
    c.fillStyle=p.col; c.shadowColor=p.col; c.shadowBlur=6;
    c.beginPath(); c.arc(p.x,p.y,p.r,0,Math.PI*2); c.fill();
  });
  c.globalAlpha=1; c.shadowBlur=0;
  menuAnimId=requestAnimationFrame(animateMenuBg);
}

function drawMenuBg(){
  const mc=document.getElementById("menuBg");
  if(!mc)return;
  mc.width=window.innerWidth; mc.height=window.innerHeight;
  const c=mc.getContext("2d");
  const g=c.createLinearGradient(0,0,0,mc.height);
  g.addColorStop(0,"#03070e"); g.addColorStop(1,"#0b1c36");
  c.fillStyle=g; c.fillRect(0,0,mc.width,mc.height);
  for(let i=0;i<140;i++){ c.globalAlpha=rnd(.15,.75); c.fillStyle="#fff"; c.beginPath(); c.arc(rnd(0,mc.width),rnd(0,mc.height*.75),rnd(.3,1.6),0,Math.PI*2); c.fill(); }
  c.globalAlpha=1;
  [["#4466ff",.22,mc.width*.15,mc.height*.8],["#9944cc",.18,mc.width*.5,mc.height*.9],["#ff5522",.18,mc.width*.82,mc.height*.85]].forEach(function(a){ c.globalAlpha=a[1]; const rg=c.createRadialGradient(a[2],a[3],0,a[2],a[3],240); rg.addColorStop(0,a[0]); rg.addColorStop(1,"transparent"); c.fillStyle=rg; c.fillRect(0,0,mc.width,mc.height); });
  c.globalAlpha=1;
}
function drawPreview(canvas,key){
  const c=canvas.getContext("2d"), W=canvas.width, H=canvas.height;
  c.clearRect(0,0,W,H);
  const g=c.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"rgba(8,18,36,.8)");
  g.addColorStop(1,"rgba(2,8,18,.96)");
  c.fillStyle=g;
  c.fillRect(0,0,W,H);
  drawArtPortrait(c,10,10,W-20,H-20,getHeroArtKey(key),1);
}
function initMenuPreviews(){
  const mc=document.getElementById("menuBg");
  if(mc){mc.width=window.innerWidth;mc.height=window.innerHeight;initMenuParticles(mc);if(!menuAnimId)animateMenuBg();}
  // drawMenuBg(); // заменено анимацией
  document.querySelectorAll(".hero-preview").forEach(function(cv){ drawPreview(cv,cv.closest(".hero-card").dataset.hero); });
}

// ══ ВЫБОР ГЕРОЯ — клик выбирает, кнопка профиля открывает hero.html ════════════════
document.querySelectorAll(".hero-card").forEach(function(card){
  // Кнопка "Профиль" внутри карточки
  const profBtn = card.querySelector('.btn-profile');
  if(profBtn){
    profBtn.addEventListener('click', function(e){
      e.stopPropagation();
      location.href = 'hero.html?hero='+card.dataset.hero;
    });
  }

  card.addEventListener("click",function(e){
    // Не реагируем на нажатие внутренних кнопок
    if(e.target.closest('.btn-skills')||e.target.closest('.el-btn')||e.target.closest('.btn-profile')) return;
    const hk = card.dataset.hero;
    // Выделяем карточку
    document.querySelectorAll(".hero-card").forEach(function(c){c.classList.remove("selected");});
    card.classList.add("selected");
    chosenKey = hk;
    if(hk==='mage') mageElement = heroProgress.mage.element || 'fire';
    document.getElementById("startBtn").disabled = false;
    document.getElementById("dungeonBtn").disabled = false;
    document.getElementById("startBtn").textContent = "⚔ В бой — " + (HEROES[hk]?HEROES[hk].name:hk);
  });
});


// ══ СТАРТ ИГРЫ ═════════════════════════════════════
function startGame(){
  if(!chosenKey)return;
  ensureExtendedHUD();
  ensureAdvancedUI();
  encounterZones.length=0;
  bossPhaseState={};
  encounterTimer=4500;
  raidStage=0;
  const tmpl=HEROES[chosenKey];
  var _activeSkin=getActiveSkin(chosenKey);
  // Apply mage element stats
  if(chosenKey==='mage'&&typeof MAGE_EL_DESCS!=='undefined'){
    const el=MAGE_EL_DESCS[mageElement||'fire'];
    tmpl.ab1Max=el.ab1Max; tmpl.ab2Max=el.ab2Max; tmpl.color=el.color;
    tmpl.ab1Name=el.ab1Name; tmpl.ab2Name=el.ab2Name;
  }
  player=new Unit({name:tmpl.name,role:tmpl.role,portrait:tmpl.portrait,spriteKey:tmpl.spriteKey||chosenKey,hp:tmpl.hp,mp:tmpl.mp||0,resourceType:tmpl.resourceType||"mana",spd:tmpl.spd,atk:tmpl.atk.slice(),atkRange:tmpl.atkRange,atkCd:tmpl.atkCd,color:_activeSkin.color||tmpl.color,r:tmpl.r,isHero:true,ab1Max:tmpl.ab1Max,ab2Max:tmpl.ab2Max,ab3Max:tmpl.ab3Max,ab4Max:tmpl.ab4Max,wx:2,wz:AD/2,atkTimer:0});
  player.ab1Cd=0; player.ab2Cd=0;
  player.ab3Cd=0; player.ab4Cd=0; player.weaponCd=0;
  player.mp=player.maxMp;
  applyProfileLoadout(player,chosenKey);
  applyUnlockedSkills(player,chosenKey);
  if(coopMode&&p2ChosenKey){
    const t2=HEROES[p2ChosenKey];
    player2=new Unit({name:t2.name,role:t2.role,portrait:t2.portrait,spriteKey:t2.spriteKey||p2ChosenKey,hp:t2.hp,mp:t2.mp||0,resourceType:t2.resourceType||"mana",spd:t2.spd,atk:t2.atk.slice(),atkRange:t2.atkRange,atkCd:t2.atkCd,color:t2.color,r:t2.r,isP2:true,ab1Max:t2.ab1Max,ab2Max:t2.ab2Max,ab3Max:t2.ab3Max,ab4Max:t2.ab4Max,wx:2,wz:AD/2+1.5,atkTimer:0});
    player2.ab1Cd=0; player2.ab2Cd=0;
    player2.ab3Cd=0; player2.ab4Cd=0; player2.weaponCd=0;
    player2.mp=player2.maxMp;
    applyProfileLoadout(player2,p2ChosenKey);
    applyUnlockedSkills(player2,p2ChosenKey);
  } else { player2=null; }
  battleActive=false; coins=0; wave=1; gameState="playing"; wavePause=0; lastT=null;
  if(gameplayMode==='timed') modeTimeLeft=180000;
  else modeTimeLeft=0;
  resetInventory();
  _sessionKills=0; _sessionCoins=0; _recordSaved=false; _comboAchiev=false; _unlockedAchieves.clear(); _pendingAchiev.length=0;
  currentArena=ARENAS.castle;
  PARTS.length=0; PROJ.length=0; DMGT.length=0; DROPS.length=0; TRAPS.length=0; CHESTS.length=0;
  logEl.innerHTML=""; monsters=makeWave(1);
  if(gameplayMode==='raid'){ monsters=[makeMonster(5)]; battleActive=true; announce('Рейд: босс 1/5'); }
  announce("Волна 1"); addLog("Иди к врагам — подойди для начала боя!","info");
  if(coopMode) addLog("P2: IJKL движение • L атака • P перекат","info");
  document.getElementById("hudName").textContent=tmpl.name;
  setPortraitArt(document.getElementById("hudPortrait"),tmpl.spriteKey||chosenKey,tmpl.portrait);
  updateCameraHUD();
  document.getElementById("ab1Name").textContent=tmpl.ab1Name;
  document.getElementById("ab2Name").textContent=tmpl.ab2Name;
  var a3=document.getElementById("ab3Name"); if(a3) a3.textContent=tmpl.ab3Name||"Способн.3";
  var a4=document.getElementById("ab4Name"); if(a4) a4.textContent=tmpl.ab4Name||"Способн.4";
  var aw=document.getElementById("abWeaponName"); if(aw){
    const w=WEAPON_ABILITIES[player.weaponId||""];
    aw.textContent=w?w.name:"Оружие";
    player.weaponMax=w?w.cd:10000;
  }
  // добавить монеты/уровень в HUD
  var wi=document.getElementById("waveInfo");
  if(wi&&!document.getElementById("coinHud")){
    var ci=document.createElement("div"); ci.id="coinHud";
    ci.style.cssText="color:#f4be5f;font-size:12px;font-family:Manrope,sans;margin-top:4px;";
    wi.appendChild(ci);
  }
  document.getElementById("menuScreen").classList.remove("active");
  document.getElementById("gameScreen").classList.add("active");
  if(typeof showMobileControls!=='undefined') showMobileControls(isMobileDevice());
  requestAnimationFrame(function(){ resizeCam(); genStars(); });
}

document.getElementById("startBtn").addEventListener("click",function(){ coopMode=false; p2ChosenKey=null; startGame(); });
document.getElementById("dungeonBtn").addEventListener("click",function(){ coopMode=false; p2ChosenKey=null; startDungeon(); });
const camModeBtn=document.getElementById("camModeBtn");
const camZoomInBtn=document.getElementById("camZoomIn");
const camZoomOutBtn=document.getElementById("camZoomOut");
if(camModeBtn) camModeBtn.addEventListener("click",function(){ cycleCameraMode(); });
if(camZoomInBtn) camZoomInBtn.addEventListener("click",function(){ changeCameraZoom(0.08); });
if(camZoomOutBtn) camZoomOutBtn.addEventListener("click",function(){ changeCameraZoom(-0.08); });
document.getElementById("menuBtn").addEventListener("click",function(){
  if(chosenKey&&heroProgress[chosenKey]){ heroProgress[chosenKey].coins=coins; saveHeroProgress(); }
  gameState="menu";
  document.getElementById("gameScreen").classList.remove("active");
  document.getElementById("menuScreen").classList.add("active");
  if(typeof showMobileControls!=='undefined') showMobileControls(false);
  document.querySelectorAll(".hero-card").forEach(function(c){c.classList.remove("selected");});
  document.getElementById("startBtn").disabled=true;
  document.getElementById("dungeonBtn").disabled=true;
  chosenKey=null; coopMode=false; player2=null;
  var ov=document.getElementById("upgradeOverlay"); if(ov) ov.style.display="none";
  var inv=document.getElementById("invOverlay"); if(inv) inv.style.display="none";
  upgradeScreen=false;
});

// ══ КООП КНОПКА В МЕНЮ ═══════════════════════════
function setupCoopUI(){
  if(document.getElementById("coopBtn")) return;
  const sb=document.getElementById("startBtn");
  const btn=document.createElement("button"); btn.id="coopBtn";
  btn.textContent="🤝 Кооп (2 игрока)";
  btn.style.cssText="display:block;margin:10px auto 0;padding:10px 24px;background:linear-gradient(135deg,#332200,#664400);border:1px solid #f4be5f;color:#f4be5f;border-radius:8px;font-family:Cinzel,serif;font-size:1rem;cursor:pointer;";
  sb.parentNode.insertBefore(btn,sb.nextSibling);
  // Кнопка рекордов
  if(!document.getElementById("recordsBtn")){
    var rb=document.createElement("button"); rb.id="recordsBtn";
    rb.textContent="🏆 Рекорды";
    rb.style.cssText="display:block;margin:8px auto 0;padding:8px 22px;background:linear-gradient(135deg,#1a1000,#443300);border:1px solid #f4be5f;color:#f4be5f;border-radius:8px;font-family:Cinzel,serif;font-size:.9rem;cursor:pointer;";
    sb.parentNode.insertBefore(rb,btn.nextSibling);
    rb.addEventListener("click",function(){openLeaderboards();});
  }
  if(!document.getElementById('modeMenuBtn')){
    var mb=document.createElement('button'); mb.id='modeMenuBtn';
    mb.textContent='🎮 Режим: classic';
    mb.style.cssText='display:block;margin:8px auto 0;padding:8px 22px;background:linear-gradient(135deg,#10233f,#1f3860);border:1px solid #6aa4ff;color:#b8d9ff;border-radius:8px;font-family:Cinzel,serif;font-size:.9rem;cursor:pointer;';
    sb.parentNode.insertBefore(mb,btn.nextSibling);
    mb.addEventListener('click',function(){
      cycleMode();
      mb.textContent='🎮 Режим: '+gameplayMode;
    });
  }
  if(!document.getElementById('onlineBtn')){
    var ob=document.createElement('button'); ob.id='onlineBtn';
    ob.textContent='🌐 Online Lite';
    ob.style.cssText='display:block;margin:8px auto 0;padding:8px 22px;background:linear-gradient(135deg,#1b2438,#2f3f66);border:1px solid #7fb5ff;color:#cde;border-radius:8px;font-family:Cinzel,serif;font-size:.9rem;cursor:pointer;';
    sb.parentNode.insertBefore(ob,btn.nextSibling);
    ob.addEventListener('click',function(){
      onlineLite.enabled=!onlineLite.enabled;
      if(onlineLite.enabled){
        onlineLite.nick=prompt('Ник для лидерборда:',onlineLite.nick||'Player')||onlineLite.nick;
        addLog('Online Lite включён','info');
      } else addLog('Online Lite выключен','info');
      ob.textContent='🌐 Online Lite: '+(onlineLite.enabled?'ON':'OFF');
    });
  }
  btn.addEventListener("click",function(){
    if(!chosenKey){ alert("Сначала выбери героя для P1!"); return; }
    const allKeys=Object.keys(HEROES);
    p2ChosenKey=allKeys.filter(function(k){return k!==chosenKey;})[0];
    coopMode=true; startGame();
  });
}


// ══ СТАРТ ПОДЗЕМЕЛЬЯ ══════════════════════════════════
function startDungeon(){
  if(!chosenKey)return;
  ensureExtendedHUD();
  const tmpl=HEROES[chosenKey];
  const _activeSkin=getActiveSkin(chosenKey);
  // Apply mage element if chosen
  if(chosenKey==='mage'){
    const el=MAGE_EL_DESCS[mageElement||'fire'];
    tmpl.ab1Max=el.ab1Max; tmpl.ab2Max=el.ab2Max;
    tmpl.color=el.color;
    tmpl.ab1Name=el.ab1Name; tmpl.ab2Name=el.ab2Name;
  }
  player=new Unit({name:tmpl.name,role:tmpl.role,portrait:tmpl.portrait,spriteKey:tmpl.spriteKey||chosenKey,
    hp:tmpl.hp,mp:tmpl.mp||0,resourceType:tmpl.resourceType||"mana",spd:tmpl.spd,atk:tmpl.atk.slice(),
    atkRange:tmpl.atkRange,atkCd:tmpl.atkCd,color:_activeSkin.color||tmpl.color,
    r:tmpl.r,isHero:true,ab1Max:tmpl.ab1Max,ab2Max:tmpl.ab2Max,ab3Max:tmpl.ab3Max,ab4Max:tmpl.ab4Max,atkTimer:0});
  player.ab1Cd=0; player.ab2Cd=0; player.ab3Cd=0; player.ab4Cd=0; player.weaponCd=0; player2=null;
  player.mp=player.maxMp;
  applyProfileLoadout(player,chosenKey);
  applyUnlockedSkills(player,chosenKey);
  resetInventory();
  coins=(heroProgress[chosenKey]&&heroProgress[chosenKey].coins)||0; wave=1; gameState="dungeon"; wavePause=0; lastT=null;
  dungFloor=1; dungTransition=false;
  _sessionKills=0; _sessionCoins=0; _recordSaved=false; _comboAchiev=false;
  dungZoom=0.72; _dragMode=false; _dragActive=false;
    _dungHUDTimer=0;
  _unlockedAchieves.clear(); _pendingAchiev.length=0;
  currentArena=ARENAS.dungeon;
  genDungeon(1);
  document.getElementById("hudName").textContent=tmpl.name;
  setPortraitArt(document.getElementById("hudPortrait"),tmpl.spriteKey||chosenKey,tmpl.portrait);
  updateCameraHUD();
  document.getElementById("ab1Name").textContent=tmpl.ab1Name||"Q";
  document.getElementById("ab2Name").textContent=tmpl.ab2Name||"E";
  var da3=document.getElementById("ab3Name"); if(da3) da3.textContent=tmpl.ab3Name||"R";
  var da4=document.getElementById("ab4Name"); if(da4) da4.textContent=tmpl.ab4Name||"F";
  var daw=document.getElementById("abWeaponName"); if(daw){
    const w=WEAPON_ABILITIES[player.weaponId||""];
    daw.textContent=w?w.name:"Оружие";
    player.weaponMax=w?w.cd:10000;
  }
  var wi=document.getElementById("waveInfo");
  if(wi&&!document.getElementById("coinHud")){
    var ci=document.createElement("div"); ci.id="coinHud";
    ci.style.cssText="color:#f4be5f;font-size:12px;font-family:Manrope,sans;margin-top:4px;";
    wi.appendChild(ci);
  }
  document.getElementById("menuScreen").classList.remove("active");
  document.getElementById("gameScreen").classList.add("active");
  if(typeof showMobileControls!=='undefined') showMobileControls(isMobileDevice());
  announce("Подземелье. Этаж 1 / "+MAX_DUNGEON_FLOOR);
  addLog("Исследуй комнаты, побеждай монстров и спускайся глубже!","info");
  requestAnimationFrame(function(){ resizeCam(); genStars(); setTimeout(resizeDungCam,60); });
}
window.startDungeon=startDungeon;

// ══ ИНИЦИАЛИЗАЦИЯ ══════════════════════════════════
window.addEventListener("load",function(){
  initMenuPreviews(); setupCoopUI();
  loadMetaProgress();
  initOnlineLite();
  updateCameraHUD();
  // Кнопка правил
  const helpBtn=document.getElementById("helpBtn");
  const helpModal=document.getElementById("helpModal");
  const helpClose=document.getElementById("helpClose");
  const helpOk=document.getElementById("helpOk");
  function openHelp(){ helpModal.style.display="flex"; }
  function closeHelp(){ helpModal.style.display="none"; }
  if(helpBtn) helpBtn.addEventListener("click", openHelp);
  if(helpClose) helpClose.addEventListener("click", closeHelp);
  if(helpOk) helpOk.addEventListener("click", closeHelp);
  if(helpModal) helpModal.addEventListener("click",function(e){ if(e.target===helpModal) closeHelp(); });

  // ══ Авто-запуск подземелья из hero.html ══════════════
  const dungFlag = localStorage.getItem('kia_start_dungeon');
  if(dungFlag){
    localStorage.removeItem('kia_start_dungeon');
    const hk = dungFlag;
    if(HEROES[hk]){
      chosenKey = hk;
      coopMode = false; p2ChosenKey = null;
      // Загружаем мага элемент если нужно
      if(hk==='mage'){
        mageElement = heroProgress.mage.element || 'fire';
      }
      setTimeout(function(){ startDungeon(); }, 80);
    }
  }
});
window.addEventListener("resize",function(){ initMenuPreviews(); if(gameState==="playing"||gameState==="dungeon") resizeCam(); });
window.addEventListener("beforeunload",function(){
  if(chosenKey&&heroProgress[chosenKey]&&(gameState==="playing"||gameState==="dungeon")){
    heroProgress[chosenKey].coins=coins; saveHeroProgress();
  }
});
requestAnimationFrame(loop);
