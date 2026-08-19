/* ═══════════════════════════════════════════════════════════════════
   Overlap — the world clock on the landing page.

   A column is one hour, the same instant on every row's clock. Colour
   says what that hour is for a person living there, not whether anyone
   is free: white is the working day (8am–5pm), black is night
   (10pm–5am), grey is the edges in between.

   The chosen cities live in the URL hash, so the view is the link.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
"use strict";
var CITIES = [
["San Francisco","United States","America/Los_Angeles"],["Los Angeles","United States","America/Los_Angeles"],
["Seattle","United States","America/Los_Angeles"],["Vancouver","Canada","America/Vancouver"],
["Denver","United States","America/Denver"],["Phoenix","United States","America/Phoenix"],
["Mexico City","Mexico","America/Mexico_City"],["Chicago","United States","America/Chicago"],
["Austin","United States","America/Chicago"],["Toronto","Canada","America/Toronto"],
["New York","United States","America/New_York"],["Miami","United States","America/New_York"],
["Boston","United States","America/New_York"],["Bogotá","Colombia","America/Bogota"],
["Lima","Peru","America/Lima"],["Santiago","Chile","America/Santiago"],
["Buenos Aires","Argentina","America/Argentina/Buenos_Aires"],["São Paulo","Brazil","America/Sao_Paulo"],
["Reykjavík","Iceland","Atlantic/Reykjavik"],["Lisbon","Portugal","Europe/Lisbon"],
["London","United Kingdom","Europe/London"],["Dublin","Ireland","Europe/Dublin"],
["Paris","France","Europe/Paris"],["Madrid","Spain","Europe/Madrid"],
["Barcelona","Spain","Europe/Madrid"],["Amsterdam","Netherlands","Europe/Amsterdam"],
["Brussels","Belgium","Europe/Brussels"],["Berlin","Germany","Europe/Berlin"],
["Munich","Germany","Europe/Berlin"],["Zurich","Switzerland","Europe/Zurich"],
["Milan","Italy","Europe/Rome"],["Rome","Italy","Europe/Rome"],
["Copenhagen","Denmark","Europe/Copenhagen"],["Stockholm","Sweden","Europe/Stockholm"],
["Oslo","Norway","Europe/Oslo"],["Helsinki","Finland","Europe/Helsinki"],
["Warsaw","Poland","Europe/Warsaw"],["Prague","Czechia","Europe/Prague"],
["Vienna","Austria","Europe/Vienna"],["Budapest","Hungary","Europe/Budapest"],
["Athens","Greece","Europe/Athens"],["Bucharest","Romania","Europe/Bucharest"],
["Istanbul","Türkiye","Europe/Istanbul"],["Kyiv","Ukraine","Europe/Kyiv"],
["Moscow","Russia","Europe/Moscow"],["Lagos","Nigeria","Africa/Lagos"],
["Accra","Ghana","Africa/Accra"],["Casablanca","Morocco","Africa/Casablanca"],
["Cairo","Egypt","Africa/Cairo"],["Nairobi","Kenya","Africa/Nairobi"],
["Cape Town","South Africa","Africa/Johannesburg"],["Johannesburg","South Africa","Africa/Johannesburg"],
["Tel Aviv","Israel","Asia/Tel_Aviv"],["Dubai","UAE","Asia/Dubai"],
["Riyadh","Saudi Arabia","Asia/Riyadh"],["Karachi","Pakistan","Asia/Karachi"],
["Bengaluru","India","Asia/Kolkata"],["Mumbai","India","Asia/Kolkata"],
["Delhi","India","Asia/Kolkata"],["Colombo","Sri Lanka","Asia/Colombo"],
["Dhaka","Bangladesh","Asia/Dhaka"],["Bangkok","Thailand","Asia/Bangkok"],
["Jakarta","Indonesia","Asia/Jakarta"],["Ho Chi Minh City","Vietnam","Asia/Ho_Chi_Minh"],
["Singapore","Singapore","Asia/Singapore"],["Kuala Lumpur","Malaysia","Asia/Kuala_Lumpur"],
["Hong Kong","Hong Kong","Asia/Hong_Kong"],["Shanghai","China","Asia/Shanghai"],
["Beijing","China","Asia/Shanghai"],["Shenzhen","China","Asia/Shanghai"],
["Taipei","Taiwan","Asia/Taipei"],["Manila","Philippines","Asia/Manila"],
["Seoul","South Korea","Asia/Seoul"],["Tokyo","Japan","Asia/Tokyo"],
["Osaka","Japan","Asia/Tokyo"],["Perth","Australia","Australia/Perth"],
["Adelaide","Australia","Australia/Adelaide"],["Brisbane","Australia","Australia/Brisbane"],
["Melbourne","Australia","Australia/Melbourne"],["Sydney","Australia","Australia/Sydney"],
["Auckland","New Zealand","Pacific/Auckland"],["Honolulu","United States","Pacific/Honolulu"],
["UTC","Coordinated","UTC"]
];
var _dtf = {};
function dtf(tz){
  if(!_dtf[tz]) _dtf[tz] = new Intl.DateTimeFormat("en-GB",{timeZone:tz,hourCycle:"h23",
    year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
  return _dtf[tz];
}
/* wall-clock parts of an instant, in a zone */
function zp(ts,tz){
  var o={}, p=dtf(tz).formatToParts(new Date(ts)), i;
  for(i=0;i<p.length;i++) o[p[i].type]=p[i].value;
  return {y:+o.year,m:+o.month,d:+o.day,H:+o.hour,M:+o.minute,S:+o.second};
}
/* zone offset from UTC, in minutes, at an instant */
function off(ts,tz){
  var p=zp(ts,tz);
  return (Date.UTC(p.y,p.m-1,p.d,p.H,p.M,p.S)-Math.floor(ts/1000)*1000)/60000;
}
/* a wall clock in a zone → the instant it names (two passes cover DST) */
function wall(y,m,d,H,M,tz){
  var g=Date.UTC(y,m-1,d,H,M), ts=g-off(g,tz)*60000;
  return g-off(ts,tz)*60000;
}
function dow(ts,tz){ var p=zp(ts,tz); return new Date(Date.UTC(p.y,p.m-1,p.d)).getUTCDay(); }
function dayKey(ts,tz){ var p=zp(ts,tz); return p.y*10000+p.m*100+p.d; }

var HOUR12 = (function(){
  try{ return !!new Intl.DateTimeFormat(undefined,{hour:"numeric"}).resolvedOptions().hour12; }
  catch(e){ return false; }
})();
function pad(n){ return n<10?"0"+n:""+n; }
function fmtT(ts,tz){
  var p=zp(ts,tz);
  if(!HOUR12) return pad(p.H)+":"+pad(p.M);
  var h=p.H%12; if(h===0) h=12;
  return h+":"+pad(p.M)+" "+(p.H<12?"AM":"PM");
}
function fmtH(ts,tz){
  var p=zp(ts,tz);
  if(!HOUR12) return pad(p.H)+":00";
  var h=p.H%12; if(h===0) h=12;
  return h+(p.H<12?"am":"pm");
}
function tzLabel(tz,ts){
  var o=off(ts,tz), s=o<0?"−":"+", a=Math.abs(o);
  var h=Math.floor(a/60), m=a%60;
  return "GMT"+(o===0?"":s+h+(m?":"+pad(m):""));
}
function tzCity(tz){
  for(var i=0;i<CITIES.length;i++) if(CITIES[i][2]===tz) return CITIES[i][0];
  return tz.split("/").pop().replace(/_/g," ");
}


var WD=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ═══════════════ state ═══════════════ */
var LOCAL_TZ=(function(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"; }catch(e){ return "UTC"; } })();
var DEFAULTS=["America/Los_Angeles","America/New_York","Europe/London","Asia/Singapore"];
var zones=[];

function $(s){ return document.querySelector(s); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function valid(tz){ try{ new Intl.DateTimeFormat("en",{timeZone:tz}); return true; }catch(e){ return false; } }

function readHash(){
  var m=location.hash.match(/^#z=(.+)$/);
  var list=m?decodeURIComponent(m[1]).split(",").filter(valid):[];
  if(!list.length){
    list=[LOCAL_TZ].concat(DEFAULTS.filter(function(z){ return z!==LOCAL_TZ; })).slice(0,5);
  }
  zones=list.slice(0,8);
}
function writeHash(replace){
  var h="#z="+encodeURIComponent(zones.join(","));
  if(replace) history.replaceState(null,"",location.pathname+h);
  else history.pushState(null,"",location.pathname+h);
}

/* ═══════════════ the day, in three tones ═══════════════
   8am–5pm is the working day, 10pm–5am is night, and the hours either
   side are the edges — reachable, but you are asking a favour. */
function tone(h){
  if(h>=8 && h<17) return "day";
  if(h>=22 || h<5) return "night";
  return "edge";
}

/* ═══════════════ render ═══════════════ */
var COLS=24;
function render(){
  var now=Date.now(), base=zp(now,zones[0]||LOCAL_TZ), tz0=zones[0]||LOCAL_TZ;
  var stamps=[], i;
  for(i=0;i<COLS;i++) stamps.push(wall(base.y,base.m,base.d,i,0,tz0));
  var nowCol=zp(now,tz0).H;

  var labs="", grid="";
  zones.forEach(function(tz){
    var here=zp(now,tz);
    labs+='<div class="zlab"><div class="zi"><b>'+esc(tzCity(tz))+"</b><span>"+
      fmtT(now,tz)+" · "+tzLabel(tz,now)+"</span></div>"+
      (zones.length>1?'<button class="x" data-drop="'+esc(tz)+'" aria-label="Remove">×</button>':"")+"</div>";
    for(i=0;i<COLS;i++){
      var ts=stamps[i], p=zp(ts,tz),
          nd=(i===0)||dayKey(ts,tz)!==dayKey(stamps[i-1],tz);
      grid+='<div class="zc '+tone(p.H)+(nd?" date":"")+(i===nowCol?" now":"")+'">'+
        cell(p,nd)+"</div>";
    }
  });
  $("#zlabs").innerHTML=labs;
  $("#zlabs").style.gridTemplateRows="repeat("+zones.length+",56px)";
  var g=$("#zgrid");
  g.style.gridTemplateColumns="repeat("+COLS+",46px)";
  g.style.gridTemplateRows="repeat("+zones.length+",56px)";
  g.innerHTML=grid;
  $("#zbase").textContent=tzCity(tz0)+" time";
  var sc=$("#zscroll");
  sc.scrollLeft=Math.max(0,nowCol*46-sc.clientWidth/2+23);
}
function cell(p,nd){
  if(nd) return '<span class="n">'+p.d+'</span><span class="m">'+MO[p.m-1]+"</span>";
  if(HOUR12){
    var h=p.H%12; if(h===0) h=12;
    return '<span class="n">'+h+(p.M?":"+pad(p.M):"")+'</span><span class="m">'+(p.H<12?"am":"pm")+"</span>";
  }
  return '<span class="n">'+pad(p.H)+(p.M?":"+pad(p.M):"")+"</span>";
}

/* ═══════════════ adding a city ═══════════════ */
function renderHits(q){
  q=(q||"").toLowerCase().trim();
  var now=Date.now();
  var list=CITIES.filter(function(c){
    if(zones.indexOf(c[2])>=0) return false;
    return !q || c[0].toLowerCase().indexOf(q)>=0 || c[1].toLowerCase().indexOf(q)>=0 ||
           c[2].toLowerCase().indexOf(q)>=0;
  }).slice(0,40);
  $("#zhits").innerHTML=list.length?list.map(function(c){
    return '<div class="hit" data-add="'+esc(c[2])+'"><div class="g"><b>'+esc(c[0])+
      "</b><span>"+esc(c[1])+" · "+tzLabel(c[2],now)+'</span></div><div class="t">'+
      fmtT(now,c[2])+"</div></div>";
  }).join(""):'<div class="hit"><div class="g"><span>Nothing matches that.</span></div></div>';
}
function openAdder(on){
  $("#adder").style.display=on?"":"none";
  if(on){ $("#zsearch").value=""; renderHits(""); $("#zsearch").focus(); }
}

var toastT;
function toast(msg){
  var t=$("#toast"); t.textContent=msg; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove("on"); },1900);
}
function copyText(s,msg){
  function fallback(){
    var a=document.createElement("textarea");
    a.value=s; a.style.position="fixed"; a.style.opacity="0";
    document.body.appendChild(a); a.select();
    try{ document.execCommand("copy"); toast(msg); }catch(e){ toast("Copy failed"); }
    document.body.removeChild(a);
  }
  if(navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(s).then(function(){ toast(msg); },fallback);
  else fallback();
}

/* ═══════════════ events ═══════════════ */
document.addEventListener("click",function(ev){
  var el=ev.target.closest?ev.target.closest("[data-drop],[data-add]"):null;
  if(!el) return;
  var drop=el.getAttribute("data-drop"), add=el.getAttribute("data-add");
  if(drop){ zones=zones.filter(function(z){ return z!==drop; }); }
  if(add){
    if(zones.length>=8) return toast("Eight is the limit");
    zones.push(add); openAdder(false);
  }
  writeHash(); render();
});
$("#addBtn").addEventListener("click",function(){ openAdder($("#adder").style.display==="none"); });
$("#addClose").addEventListener("click",function(){ openAdder(false); });
$("#zsearch").addEventListener("input",function(){ renderHits(this.value); });
$("#shareBtn").addEventListener("click",function(){
  writeHash(true);
  copyText(location.href,"Link copied — that view travels with it");
});
window.addEventListener("hashchange",function(){ readHash(); render(); });

/* a plan or invite link aimed at the old single-page address still lands right */
if(/^#(p|t)=/.test(location.hash)){
  location.replace("team/"+location.hash);
} else {
  readHash(); writeHash(true); render();
}
setInterval(function(){ if(!document.hidden) render(); },30000);
})();
