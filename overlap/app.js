/* ═══════════════════════════════════════════════════════════════════
   Overlap — one app, three addresses.
   team/, plan/ and next/ are real pages so a link lands where it says,
   but moving between them is a pushState, not a reload.
   ═══════════════════════════════════════════════════════════════════ */
document.getElementById("root").innerHTML = "<div class=\"app\">\n\n  <header class=\"nav\" id=\"nav\">\n    <div class=\"nav-bar\">\n      <span class=\"nav-title\">Overlap</span>\n      <span class=\"nav-sub\">The hour that works for the whole team.</span>\n      <button class=\"nav-act\" id=\"resetBtn\">Reset</button>\n    </div>\n    <div class=\"seg-wrap\">\n      <div class=\"seg\" id=\"seg\">\n        <div class=\"thumb\" id=\"segThumb\"></div>\n        <a href=\"../team/\" data-step=\"0\">Team</a>\n        <a href=\"../plan/\" data-step=\"1\">Plan</a>\n        <a href=\"../next/\" data-step=\"2\">Next</a>\n      </div>\n    </div>\n  </header>\n\n  <main>\n    <div class=\"hero\">\n      <h1 class=\"large-title\" id=\"bigTitle\">Your team</h1>\n      <p class=\"large-sub\" id=\"bigSub\">Everyone's hours, in their own timezone.</p>\n    </div>\n\n    <!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 STEP 1 \u2014 TEAM \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n    <section class=\"step on\" id=\"step0\">\n      <div class=\"sec\">\n        <div class=\"card\" id=\"acctCard\"></div>\n      </div>\n\n      <div class=\"sec\">\n        <div class=\"sechead\"><span id=\"teamHead\">People</span><b id=\"peopleCount\"></b></div>\n        <div class=\"card\" id=\"peopleList\"></div>\n        <div class=\"secfoot\">Working hours are what the overlap is built from.</div>\n      </div>\n\n      <div class=\"sec\" id=\"overlapSec\">\n        <div class=\"sechead\"><span>Overlap</span><button class=\"linkbtn\" id=\"editToggle\">Edit hours</button></div>\n        <div class=\"daytabs\" id=\"dayTabs\"></div>\n        <div class=\"wtb\">\n          <div class=\"wtblabs\" id=\"wtbLabs\"></div>\n          <div class=\"wtbscroll\" id=\"wtbScroll\"><div class=\"wtbgrid\" id=\"wtb\"></div></div>\n        </div>\n        <div class=\"legend\">\n          <i class=\"lg free\"></i><span>possible</span>\n          <i class=\"lg part\"></i><span>not everyone</span>\n          <i class=\"lg busy\"></i><span>no</span>\n          <span class=\"sp\"></span><span id=\"gridTz\"></span>\n        </div>\n        <div class=\"secfoot\" id=\"editFoot\"></div>\n      </div>\n    </section>\n\n    <!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 STEP 2 \u2014 PLAN \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n    <section class=\"step\" id=\"step1\">\n      <div class=\"sec\">\n        <div class=\"sechead\"><span>The meeting</span></div>\n        <div class=\"card\">\n          <div class=\"row\">\n            <div class=\"grow\"><div class=\"t\">Name</div></div>\n            <input id=\"titleInput\" style=\"text-align:right;flex:1;font-size:17px;letter-spacing:-.02em\" placeholder=\"Intro call\" maxlength=\"80\">\n          </div>\n          <div class=\"row\">\n            <div class=\"grow\"><div class=\"t\">Length</div></div>\n            <div class=\"chips\" id=\"durChips\" style=\"padding:0;justify-content:flex-end\"></div>\n          </div>\n          <div class=\"row\">\n            <div class=\"grow\"><div class=\"t\">Days</div><div class=\"s\" id=\"windowSub\"></div></div>\n            <div class=\"stepper\">\n              <button id=\"winPrev\" aria-label=\"Earlier week\">\u2039</button><span></span><button id=\"winNext\" aria-label=\"Later week\">\u203a</button>\n            </div>\n          </div>\n        </div>\n      </div>\n      <div class=\"sec\">\n        <div class=\"sechead\"><span>Best times</span><b id=\"bestNote\"></b></div>\n        <div class=\"card\" id=\"bestList\"></div>\n        <div class=\"secfoot\" id=\"bestFoot\"></div>\n      </div>\n      <div class=\"sec\" id=\"actionsSec\">\n        <div class=\"btnrow\">\n          <button class=\"btn sec\" id=\"copyBtn\">Copy times</button>\n          <button class=\"btn sec\" id=\"icsBtn\">Apple Calendar</button>\n        </div>\n        <button class=\"btn ghost\" id=\"shareBtn\" style=\"margin-top:6px\">Copy a link to this plan</button>\n      </div>\n    </section>\n\n    <!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 STEP 3 \u2014 FEEDBACK \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n    <section class=\"step\" id=\"step2\">\n      <div class=\"sec\" id=\"fbForm\">\n        <div class=\"sechead\"><span>What would you like to see?</span></div>\n        <div class=\"chips\" id=\"wantChips\"></div>\n        <div class=\"card\" style=\"margin-top:12px\">\n          <textarea id=\"fbText\" rows=\"4\" maxlength=\"800\" placeholder=\"Anything at all \u2014 what got in your way, what\u2019s missing, what you\u2019d pay for.\"></textarea>\n        </div>\n        <div class=\"card\" style=\"margin-top:12px\" id=\"fbEmailCard\">\n          <div class=\"row\">\n            <div class=\"grow\"><div class=\"t\">Email</div><div class=\"s\">If you want a reply.</div></div>\n            <input id=\"fbEmail\" type=\"email\" placeholder=\"Optional\" maxlength=\"80\" autocapitalize=\"off\" autocorrect=\"off\"\n                   style=\"text-align:right;flex:1;font-size:17px;letter-spacing:-.02em\">\n          </div>\n        </div>\n        <div class=\"secfoot\" id=\"fbFoot\"></div>\n      </div>\n      <div class=\"sec\" id=\"fbThanks\" style=\"display:none\">\n        <div class=\"card\"><div class=\"empty\"><b>Thank you \u2014 noted.</b>Every line of this gets read. It decides what gets built next.</div></div>\n        <button class=\"btn sec\" id=\"fbAgain\" style=\"margin-top:14px\">Say something else</button>\n      </div>\n    </section>\n\n  </main>\n\n  <div class=\"dock\">\n    <div class=\"dock-hint\" id=\"dockHint\"></div>\n    <button class=\"btn\" id=\"primary\">Continue</button>\n  </div>\n\n  <p class=\"foot\" id=\"foot\"></p>\n</div>\n\n<div class=\"scrim\" id=\"scrim\"></div>\n\n<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 SHEET \u2014 add / edit a person \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n<div class=\"sheet\" id=\"sheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"sheetCancel\">Cancel</button>\n    <span class=\"t\" id=\"sheetTitle\">Add person</span>\n    <button class=\"p\" id=\"sheetDone\">Done</button>\n  </div>\n  <div class=\"sheet-body\">\n    <div style=\"padding:0 16px 14px\">\n      <div class=\"card\">\n        <div class=\"field\"><label>Name</label><input id=\"fName\" placeholder=\"Optional\" maxlength=\"40\"></div>\n        <div class=\"field\"><label>Email</label><input id=\"fEmail\" type=\"email\" placeholder=\"Optional \u2014 invites them\" maxlength=\"80\" autocapitalize=\"off\" autocorrect=\"off\"></div>\n      </div>\n    </div>\n    <div class=\"sechead\" style=\"padding:0 20px 7px\"><span>Working hours</span></div>\n    <div style=\"padding:0 16px 14px\">\n      <div class=\"card\">\n        <div class=\"field\"><label>From</label><div class=\"grow\"></div><div class=\"stepper\"><button data-h=\"s-\">\u2212</button><span></span><button data-h=\"s+\">+</button></div><div class=\"v\" id=\"fStart\" style=\"width:58px;text-align:right;font-variant-numeric:tabular-nums\"></div></div>\n        <div class=\"field\"><label>To</label><div class=\"grow\"></div><div class=\"stepper\"><button data-h=\"e-\">\u2212</button><span></span><button data-h=\"e+\">+</button></div><div class=\"v\" id=\"fEnd\" style=\"width:58px;text-align:right;font-variant-numeric:tabular-nums\"></div></div>\n        <div class=\"field\"><label style=\"width:auto;flex:1\">Weekends too</label><div class=\"switch\" id=\"fWeekend\"><i></i></div></div>\n      </div>\n    </div>\n    <div class=\"sechead\" style=\"padding:0 20px 7px\"><span>Timezone</span></div>\n    <div class=\"search\">\n      <svg width=\"15\" height=\"15\" viewBox=\"0 0 16 16\" fill=\"none\"><circle cx=\"7\" cy=\"7\" r=\"5\" stroke=\"currentColor\" stroke-width=\"1.8\"/><path d=\"M11 11l3.5 3.5\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/></svg>\n      <input id=\"citySearch\" placeholder=\"City or timezone\" autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\">\n    </div>\n    <div style=\"padding:0 16px\"><div class=\"card\" id=\"cityList\"></div></div>\n  </div>\n</div>\n\n<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 SHEET \u2014 sign in \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n<div class=\"sheet\" id=\"authSheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"authCancel\">Cancel</button>\n    <span class=\"t\" id=\"authTitle\">Sign in</span>\n    <button class=\"p\" id=\"authGo\">Next</button>\n  </div>\n  <div class=\"sheet-body\">\n    <p class=\"sheet-lede\" id=\"authLede\">One email, one code. No password to forget.</p>\n    <div style=\"padding:0 16px 14px\">\n      <div class=\"card\">\n        <div class=\"field\"><label>Email</label><input id=\"authEmail\" type=\"email\" placeholder=\"you@company.com\"\n          autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\"></div>\n        <div class=\"field\" id=\"authCodeField\" style=\"display:none\"><label>Code</label>\n          <input id=\"authCode\" inputmode=\"numeric\" maxlength=\"6\" placeholder=\"6 digits\"></div>\n      </div>\n    </div>\n    <p class=\"sheet-lede\" id=\"authNote\"></p>\n  </div>\n</div>\n\n<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 SHEET \u2014 invite \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n<div class=\"sheet\" id=\"teamSheet\"><div class=\"grab\"></div><div class=\"sheet-nav\"><button id=\"teamClose\">Done</button><span class=\"t\">Teams</span><span style=\"width:44px\"></span></div><div class=\"sheet-body\"><p class=\"sheet-lede\">Keep a team per client, per project, per anything. They all stay put, and you can switch at any time.</p><div style=\"padding:0 16px 16px\"><div class=\"card\" id=\"teamList\"></div></div><div style=\"padding:0 16px\" class=\"btnrow\" id=\"teamActs\"></div></div></div><div class=\"sheet\" id=\"inviteSheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"inviteClose\">Done</button>\n    <span class=\"t\">Invite</span>\n    <button class=\"p\" id=\"inviteCopy\">Copy</button>\n  </div>\n  <div class=\"sheet-body\">\n    <p class=\"sheet-lede\">Send this link. They pick their city and hours, and the overlap redraws itself.</p>\n    <div style=\"padding:0 16px 16px\"><div class=\"card\"><div class=\"linkbox\" id=\"inviteLink\"></div></div></div>\n    <div style=\"padding:0 16px\"><button class=\"btn\" id=\"inviteCopyBig\">Copy invite link</button></div>\n  </div>\n</div>\n\n<div class=\"toast\" id=\"toast\"></div>";

(function(){
"use strict";

/* ═══════════════ cities ═══════════════ */
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
var DURS = [15,30,45,60];
var SLOT = 60;                       /* one column = one hour */
var DAYS = 7;                        /* columns */

/* ═══════════════ timezone math ═══════════════ */
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
function fmtHourShort(h){
  if(!HOUR12) return ""+h;
  var x=h%12; if(x===0) x=12;
  return x+(h<12?"a":"p");
}
function fmtHour(h){
  if(!HOUR12) return pad(h)+":00";
  var x=h%12; if(x===0) x=12;
  return x+(h<12?" am":" pm");
}
var WD=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(ts,tz){ var p=zp(ts,tz); return WD[dow(ts,tz)]+" "+p.d+" "+MO[p.m-1]; }
function fmtLongDate(ts,tz){
  var p=zp(ts,tz), wd=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dow(ts,tz)];
  return wd+" "+p.d+" "+MO[p.m-1];
}
/* +37 → "GMT+9:30" style label */
function tzLabel(tz,ts){
  var o=off(ts,tz), s=o<0?"−":"+", a=Math.abs(o);
  var h=Math.floor(a/60), m=a%60;
  return "GMT"+(o===0?"":s+h+(m?":"+pad(m):""));
}
function tzCity(tz){
  for(var i=0;i<CITIES.length;i++) if(CITIES[i][2]===tz) return CITIES[i][0];
  return tz.split("/").pop().replace(/_/g," ");
}

/* ═══════════════ state ═══════════════ */
var LOCAL_TZ=(function(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"; }catch(e){ return "UTC"; } })();
var KEY="overlap.v3", OLDKEY="meetontime.v2";
var uid=0;
function newPerson(name,tz,you){
  return {id:"p"+(++uid)+"_"+Math.floor(Math.random()*1e6),name:name,tz:tz,email:"",
          s:9,e:18,wknd:false,you:!!you,ov:{}};
}
function todayStart(tz){ var p=zp(Date.now(),tz); return wall(p.y,p.m,p.d,0,0,tz); }

var S={
  people:[], title:"", dur:30, offsetDays:0, dispId:null,
  pick:null, day:0, step:0, wants:[],
  teams:[], cur:""                 /* every saved team; the one on screen */
};

function newTeamId(){ return "t"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36); }
function freshState(){
  var me=newPerson("You",LOCAL_TZ,true);
  S.people=[me]; S.title=""; S.dur=30; S.offsetDays=0; S.dispId=me.id;
  S.pick=null; S.day=0; S.step=0; S.wants=[];
  S.cur=newTeamId(); S.teams=[{id:S.cur,name:"My team",p:[]}];
  stash();
}
/* ── several teams, kept side by side ───────────────────────────────
   S.people is whichever one is on screen; the rest sit packed in
   S.teams until you switch back to them. */
function peopleArr(){
  return S.people.map(function(p){
    var ov=[],k; for(k in p.ov) if(p.ov.hasOwnProperty(k)) ov.push([+k,p.ov[k]?1:0]);
    return [p.id,p.name,p.tz,p.email,p.s,p.e,p.wknd?1:0,p.you?1:0,ov];
  });
}
function readPeople(arr){
  S.people=(arr||[]).map(function(a){
    var p={id:a[0],name:a[1]||"",tz:a[2],email:a[3]||"",s:+a[4],e:+a[5],
           wknd:!!a[6],you:!!a[7],ov:{}};
    (a[8]||[]).forEach(function(pair){ p.ov[pair[0]]=!!pair[1]; });
    try{ new Intl.DateTimeFormat("en",{timeZone:p.tz}); }catch(e){ p.tz=LOCAL_TZ; }
    return p;
  });
  if(!S.people.length) S.people=[newPerson("You",LOCAL_TZ,true)];
  S.dispId=(S.people.filter(function(p){ return p.you; })[0]||S.people[0]).id;
}
function curTeam(){
  var i; for(i=0;i<S.teams.length;i++) if(S.teams[i].id===S.cur) return S.teams[i];
  return null;
}
function stash(){ var t=curTeam(); if(t) t.p=peopleArr(); }
function switchTeam(id){
  if(id===S.cur) return;
  if(inTeam()){                       /* the server holds these */
    S.cur=id; save();
    refreshMe().then(function(){ S.pick=null; S.day=0; afterChange(); });
    return;
  }
  stash(); S.cur=id;
  var t=curTeam(); if(!t) return;
  readPeople(t.p); S.pick=null; S.day=0;
  afterChange(); toast("Switched to "+t.name);
}
function addTeam(name){
  if(inTeam()){
    cx("teams.create",{token:token(),name:name||"",tz:LOCAL_TZ,startHour:9,endHour:18})
      .then(function(r){ S.cur=r.id; save(); return refreshMe(); })
      .then(function(){ S.pick=null; S.day=0; afterChange(); toast("New team"); })
      .catch(function(e){ toast(e.message); });
    return;
  }
  stash();
  var id=newTeamId();
  S.teams.push({id:id,name:name||("Team "+(S.teams.length+1)),p:[]});
  S.cur=id; S.people=[newPerson("You",LOCAL_TZ,true)];
  S.dispId=S.people[0].id; S.pick=null; S.day=0;
  afterChange(); toast("New team");
}
function renameTeam(id,name){
  name=(name||"").trim().slice(0,60); if(!name) return;
  if(inTeam()){
    cx("teams.rename",{token:token(),teamId:id,name:name})
      .then(refreshMe).then(afterChange).catch(function(e){ toast(e.message); });
    return;
  }
  var i; for(i=0;i<S.teams.length;i++) if(S.teams[i].id===id) S.teams[i].name=name;
  afterChange();
}
function dropTeam(id){
  if(inTeam()){
    cx("teams.leave",{token:token(),teamId:id}).then(function(){
      if(S.cur===id) S.cur="";
      return refreshMe();
    }).then(function(){ S.pick=null; afterChange(); toast("Left the team"); })
      .catch(function(e){ toast(e.message); });
    return;
  }
  if(S.teams.length<2) return toast("That's your only team");
  S.teams=S.teams.filter(function(t){ return t.id!==id; });
  if(S.cur===id){ S.cur=S.teams[0].id; readPeople(S.teams[0].p); S.pick=null; S.day=0; }
  afterChange(); toast("Team deleted");
}
function teamName(){
  if(inTeam()) return ((ME.team||{}).name)||"Your team";
  var t=curTeam(); return t?t.name:"My team";
}
function teamList(){
  if(inTeam()) return (ME.teams||[]).map(function(t){ return {id:t.id,name:t.name}; });
  return S.teams.map(function(t){ return {id:t.id,name:t.name}; });
}
function disp(){ return byId(S.dispId)||S.people[0]; }
function byId(id){ for(var i=0;i<S.people.length;i++) if(S.people[i].id===id) return S.people[i]; return null; }
function dispTz(){ var d=disp(); return d?d.tz:LOCAL_TZ; }

/* ═══════════════ availability ═══════════════ */
function isFree(p,ts){
  var k=""+ts;
  if(p.ov[k]!==undefined) return !!p.ov[k];
  var z=zp(ts,p.tz), mins=z.H*60+z.M, d=dow(ts,p.tz);
  if(!p.wknd && (d===0||d===6)) return false;
  return mins>=p.s*60 && mins+SLOT<=p.e*60;
}
/* free for the whole meeting, not just its first slot */
function freeFor(p,ts,dur){
  var n=Math.ceil(dur/SLOT), i;
  for(i=0;i<n;i++) if(!isFree(p,ts+i*SLOT*60000)) return false;
  return true;
}
function countFree(ts){
  var n=0,i; for(i=0;i<S.people.length;i++) if(isFree(S.people[i],ts)) n++;
  return n;
}
function countFor(ts,dur){
  var n=0,i; for(i=0;i<S.people.length;i++) if(freeFor(S.people[i],ts,dur)) n++;
  return n;
}

/* ═══════════════ the window of days ═══════════════ */
function windowStart(){
  var tz=dispTz(), t=todayStart(tz);
  if(!S.offsetDays) return t;
  var p=zp(t,tz);
  return wall(p.y,p.m,p.d+S.offsetDays,0,0,tz);
}
function dayStarts(){
  var tz=dispTz(), base=windowStart(), p=zp(base,tz), out=[], i;
  for(i=0;i<DAYS;i++) out.push(wall(p.y,p.m,p.d+i,0,0,tz));
  return out;
}
/* ═══════════════ the ranking ═══════════════ */
/* civility: how far a local time sits outside 9–18, in hours, per person */
function rudeness(ts){
  var pen=0,i,p,z,h,late;
  for(i=0;i<S.people.length;i++){
    p=S.people[i]; z=zp(ts,p.tz); h=z.H+z.M/60; late=h+S.dur/60;
    if(h<p.s) pen+=(p.s-h);
    else if(late>p.e) pen+=(late-p.e);
    /* asleep costs more the deeper into the night it reaches */
    if(h<7) pen+=6+(7-h)*3;
    else if(late>22) pen+=4+(late-22)*2;
  }
  return pen;
}
var _auto=null;
/* what the app is proposing right now — the user's pick if they made one,
   otherwise the current best hour, recomputed whenever the inputs move */
function sel(){
  if(S.pick!==null) return S.pick;
  if(_auto===null){ var b=bestSlots(); _auto=b.length?b[0].ts:null; }
  return _auto;
}
function bestSlots(){
  var tz=dispTz(), days=dayStarts(), now=Date.now(), out=[], i, j, p, ts;
  for(i=0;i<days.length;i++){
    p=zp(days[i],tz);
    for(j=0;j<48;j++){
      ts=wall(p.y,p.m,p.d,0,j*SLOT,tz);
      if(ts<now-60000) continue;
      var n=countFor(ts,S.dur);
      if(!n) continue;
      out.push({ts:ts,n:n,score:n*1000-rudeness(ts)});
    }
  }
  out.sort(function(a,b){ return b.score-a.score || a.ts-b.ts; });
  /* best hour of each day first, so the five options are five real choices —
     then backfill with the next best that isn't a neighbour of one already kept */
  var keep=[], gap=Math.max(S.dur,60)*60000, seenDay={}, tz2=dispTz(), k;
  var topN=out.length?out[0].n:0;
  for(i=0;i<out.length && keep.length<5;i++){
    if(out[i].n<topN) break;           /* never pad the list with worse coverage */
    k=dayKey(out[i].ts,tz2);
    if(seenDay[k]) continue;
    seenDay[k]=1; keep.push(out[i]);
  }
  for(i=0;i<out.length && keep.length<5;i++){
    var ok=true;
    for(j=0;j<keep.length;j++) if(Math.abs(keep[j].ts-out[i].ts)<gap){ ok=false; break; }
    if(ok) keep.push(out[i]);
  }
  keep.sort(function(a,b){ return b.n-a.n || b.score-a.score || a.ts-b.ts; });
  return keep;
}

/* ═══════════════ tiny DOM helpers ═══════════════ */
function $(s){ return document.querySelector(s); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function initials(p){
  var n=(p.name||(p.tz?tzCity(p.tz):"")||"?").trim().split(/\s+/);
  return ((n[0]||"?")[0]+(n.length>1?n[n.length-1][0]:"")).toUpperCase();
}
function pname(p){ return p.name || tzCity(p.tz); }
var toastT;
function toast(msg){
  var t=$("#toast"); t.textContent=msg; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove("on"); },1900);
}
function haptic(){ if(navigator.vibrate) try{ navigator.vibrate(8); }catch(e){} }

/* ═══════════════ persistence ═══════════════ */
function packed(freeze){
  stash();
  return {v:3,t:S.title,d:S.dur,o:S.offsetDays,x:S.dispId,y:S.day,k:freeze?sel():S.pick,
    cur:S.cur,teams:S.teams,p:peopleArr()};
}
function unpack(o){
  if(!o||!o.p||!o.p.length) return false;
  readPeople(o.p);
  S.title=o.t||""; S.dur=o.d||30; S.offsetDays=o.o||0; S.day=o.y||0;
  if(byId(o.x)) S.dispId=o.x;
  S.pick=o.k||null;
  /* a v2 save knew one team; give it a name and carry on */
  S.teams=(o.teams&&o.teams.length)?o.teams:[{id:newTeamId(),name:"My team",p:[]}];
  S.cur=(o.cur&&S.teams.some(function(t){ return t.id===o.cur; }))?o.cur:S.teams[0].id;
  stash();
  return true;
}
function save(){
  try{ localStorage.setItem(KEY,JSON.stringify(packed())); }catch(e){}
}
function b64(s){
  var b=new TextEncoder().encode(s), r="", i;
  for(i=0;i<b.length;i++) r+=String.fromCharCode(b[i]);
  return btoa(r).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function unb64(s){
  var t=s.replace(/-/g,"+").replace(/_/g,"/"), b=atob(t), a=new Uint8Array(b.length), i;
  for(i=0;i<b.length;i++) a[i]=b.charCodeAt(i);
  return new TextDecoder().decode(a);
}
function shareUrl(){
  return location.origin+location.pathname+"#p="+b64(JSON.stringify(packed(true)));
}
function load(){
  var h=location.hash;
  if(h.indexOf("#p=")===0){
    try{ if(unpack(JSON.parse(unb64(h.slice(3))))) return true; }catch(e){}
  }
  try{ var raw=localStorage.getItem(KEY); if(raw && unpack(JSON.parse(raw))) return true; }catch(e){}
  /* carry over anything saved under the old name, once */
  try{
    var old=localStorage.getItem(OLDKEY);
    if(old && unpack(JSON.parse(old))){ save(); localStorage.removeItem(OLDKEY); return true; }
  }catch(e){}
  return false;
}

/* ═══════════════ render — step 1, who ═══════════════ */
function renderPeople(){
  var now=Date.now(), html="";
  S.people.forEach(function(p){
    html+='<div class="row tap" data-edit="'+p.id+'">'+
      '<div class="avatar'+(p.you?" you":"")+'">'+esc(initials(p))+'</div>'+
      '<div class="grow"><div class="t">'+esc(pname(p))+(p.you?' <span style="color:rgba(60,60,67,.3);font-size:13px">you</span>':'')+'</div>'+
      '<div class="s">'+esc(tzCity(p.tz))+" · "+fmtT(now,p.tz)+" · "+fmtHourShort(p.s)+"–"+fmtHourShort(p.e)+(p.wknd?", 7 days":"")+"</div></div>"+
      (S.people.length>1?'<button class="del" data-del="'+p.id+'" aria-label="Remove">×</button>':'')+
      '<div class="chev"></div></div>';
  });
  html+='<div class="row tap" data-add="1"><div class="plus">+</div>'+
        '<div class="grow"><div class="t">Add someone</div></div><div class="chev"></div></div>';
  $("#peopleList").innerHTML=html;
  $("#peopleCount").textContent=S.people.length+(S.people.length===1?" person":" people");

  $("#durChips").innerHTML=DURS.map(function(d){
    return '<button class="chip'+(S.dur===d?" on":"")+'" data-dur="'+d+'">'+d+"′</button>";
  }).join("");

  var days=dayStarts(), tz=dispTz();
  var a=zp(days[0],tz), z=zp(days[DAYS-1],tz);
  $("#windowSub").textContent=WD[dow(days[0],tz)]+" "+a.d+(a.m!==z.m?" "+MO[a.m-1]:"")+
    " → "+WD[dow(days[DAYS-1],tz)]+" "+z.d+" "+MO[z.m-1];
  if($("#titleInput")!==document.activeElement) $("#titleInput").value=S.title;
}

/* ═══════════════ render — the overlap strip ═══════════════ */
/* A column is one instant. Each row reads that instant on that person's clock:
   white = they can, black = they can't. The last row is everyone at once. */
function dayIndex(ts){
  var tz=dispTz(), days=dayStarts(), k=dayKey(ts,tz), i;
  for(i=0;i<days.length;i++) if(dayKey(days[i],tz)===k) return i;
  return -1;
}
function renderDays(){
  var tz=dispTz(), days=dayStarts(), now=Date.now();
  $("#dayTabs").innerHTML=days.map(function(t,i){
    var z=zp(t,tz), d=dow(t,tz), today=dayKey(t,tz)===dayKey(now,tz);
    var over=(t+86400000)<=now;
    return '<button class="dtab'+(i===S.day?" on":"")+((d===0||d===6)?" we":"")+
      (over?" past":"")+'" data-day="'+i+'"><span class="wd">'+(today?"today":WD[d])+
      '</span><span class="dd">'+z.d+"</span></button>";
  }).join("");
}
function cellLabel(ts,tz,newday){
  var p=zp(ts,tz);
  if(newday) return '<span class="n">'+p.d+'</span><span class="m">'+MO[p.m-1]+"</span>";
  if(HOUR12){
    var h=p.H%12; if(h===0) h=12;
    return '<span class="n">'+h+(p.M?":"+pad(p.M):"")+'</span><span class="m">'+(p.H<12?"am":"pm")+"</span>";
  }
  return '<span class="n">'+pad(p.H)+(p.M?":"+pad(p.M):"")+"</span>";
}
function sumClass(n,total){ return n===0?" busy":(n===total?"":" part"); }
function renderWTB(){
  var tz=dispTz(), days=dayStarts();
  if(S.day>=DAYS||S.day<0) S.day=0;
  var day=days[S.day], z=zp(day,tz), total=S.people.length, now=Date.now();
  var g=$("#wtb"), labs=$("#wtbLabs"), i, html="", lhtml="", stamps=[];
  g.style.gridTemplateColumns="repeat(24,var(--cw))";
  g.style.gridTemplateRows="repeat("+(total+1)+",var(--wrow))";
  labs.style.gridTemplateRows="repeat("+(total+1)+",var(--wrow))";
  for(i=0;i<24;i++) stamps.push(wall(z.y,z.m,z.d,i,0,tz));

  S.people.forEach(function(p){
    var city=tzCity(p.tz), sub=(pname(p)===city?"":city+" · ")+tzLabel(p.tz,day);
    lhtml+='<div class="rlab"><b>'+esc(pname(p))+"</b><span>"+esc(sub)+"</span></div>";
    for(i=0;i<24;i++){
      var ts=stamps[i], nd=(i===0)||dayKey(ts,p.tz)!==dayKey(stamps[i-1],p.tz);
      html+='<div class="hc'+(isFree(p,ts)?"":" busy")+(nd?" date":"")+
            (ts+3600000<now?" past":"")+'" data-ts="'+ts+'" data-col="'+i+
            '" data-p="'+p.id+'">'+cellLabel(ts,p.tz,nd)+"</div>";
    }
  });
  lhtml+='<div class="rlab sum"><b>Everyone</b><span>'+total+(total===1?" person":" people")+"</span></div>";
  for(i=0;i<24;i++){
    var ts=stamps[i], n=countFree(ts);
    html+='<div class="hc sum'+sumClass(n,total)+(ts+3600000<now?" past":"")+
          '" data-ts="'+ts+'" data-col="'+i+'">'+
          (n>0&&n<total?'<span class="n">'+n+"/"+total+"</span>":"")+"</div>";
  }
  g.innerHTML=html; labs.innerHTML=lhtml;
  g.classList.toggle("edit",editing);
  markColumn(true);
  if(!g.querySelector(".colmark")){
    var bc=8, bn=-1, sc=$("#wtbScroll"), cw=g.firstChild?g.firstChild.offsetWidth:45;
    for(i=0;i<24;i++){ var c=countFor(stamps[i],S.dur); if(c>bn){ bn=c; bc=i; } }
    sc.scrollLeft=Math.max(0,bc*cw-sc.clientWidth/2+cw/2);
  }
  $("#gridTz").textContent=tzCity(tz)+" time";
  $("#editToggle").textContent=editing?"Done":"Edit hours";
  $("#editToggle").classList.toggle("on",editing);
  $("#editFoot").textContent=editing
    ? "Drag along someone's row to take hours away or give them back."
    : "";
}
function markColumn(scrollTo){
  var g=$("#wtb"), old=g.querySelector(".colmark"), t=sel();
  if(old) old.parentNode.removeChild(old);
  if(!t) return;
  var cell=g.querySelector('.hc[data-ts="'+t+'"]');
  if(!cell) return;                       /* the choice sits on another day */
  var col=+cell.getAttribute("data-col");
  var m=document.createElement("div");
  m.className="colmark";
  m.style.left="calc("+col+" * var(--cw))";
  m.style.width="var(--cw)";
  g.appendChild(m);
  if(scrollTo){
    var sc=$("#wtbScroll"), x=cell.offsetLeft-sc.clientWidth/2+cell.offsetWidth/2;
    sc.scrollLeft=Math.max(0,x);
  }
}
function refreshSum(col,ts){
  var c=$("#wtb").querySelector('.hc.sum[data-col="'+col+'"]'), n, total;
  if(!c) return;
  n=countFree(ts); total=S.people.length;
  c.className="hc sum"+sumClass(n,total)+(ts+3600000<Date.now()?" past":"");
  c.innerHTML=(n>0&&n<total)?'<span class="n">'+n+"/"+total+"</span>":"";
}

/* ═══════════════ render — best times ═══════════════ */
var lastBest=[];
function renderBest(){
  lastBest=bestSlots();
  var tz=dispTz(), total=S.people.length;
  if(!lastBest.length){
    $("#bestList").innerHTML='<div class="empty"><b>No overlap this week</b>'+
      "Nobody is free at the same time. Widen someone's hours, allow weekends, or step the week forward.</div>";
    $("#bestNote").textContent="";
    $("#bestFoot").textContent="";
  } else {
    var here=sel(), rows=lastBest.slice();
    if(S.pick!==null && !rows.some(function(x){ return x.ts===S.pick; }))
      rows.unshift({ts:S.pick,n:countFor(S.pick,S.dur),manual:true});
    $("#bestList").innerHTML=rows.map(function(x){
      var all=x.n===total;
      return '<button class="slot'+(here===x.ts?" on":"")+'" data-pick="'+x.ts+'">'+
        '<span class="radio"></span><span class="when">'+
        '<span class="w1">'+fmtDate(x.ts,tz)+'<span class="w1s"> · '+
          (x.manual?(cameFromLink?"proposed":"your pick"):(all?"everyone free":x.n+" of "+total+" free"))+"</span></span>"+
        '<span class="w2">'+S.people.map(function(p){
            return '<span class="lt'+(freeFor(p,x.ts,S.dur)?"":" out")+'"><b>'+
                   fmtT(x.ts,p.tz)+"</b> "+esc(tzCity(p.tz))+"</span>";
          }).join('<i class="sep">·</i>')+"</span></span></button>";
    }).join("");
    $("#bestNote").textContent=lastBest[0].n<total?"no hour suits everyone":S.dur+" min";
    $("#bestFoot").textContent="Google opens with the event already filled in — time, title"+
      (S.people.some(function(p){ return p.email; })?", guests":"")+". You just press Save.";
  }
}

/* ═══════════════ backend ═══════════════
   Convex over its HTTP API — plain fetch, no SDK, no build step. Set
   window.OVERLAP_CONVEX_URL (see overlap/README.md) and the app goes live:
   real accounts, real teams, invite links that survive a new device.
   Until then everything below runs against this browser alone.
   ═════════════════════════════════════════ */
var CONVEX = (window.OVERLAP_CONVEX_URL||"").replace(/\/+$/,"");
var LIVE = /^https?:\/\//.test(CONVEX);
var TOKKEY="overlap.token", QKEY="overlap.queue";
var ME=null;                       /* {user,team,members} once signed in */

/* one endpoint, one shape: {op,args} in, {ok,value} out. See convex/http.ts.
   Ten seconds is the whole patience budget: a hung request must fail loudly
   rather than leave a button looking like it did nothing. */
function cx(op,args){
  var ctl = window.AbortController ? new AbortController() : null;
  var timer = setTimeout(function(){ if(ctl) ctl.abort(); },10000);
  return fetch(CONVEX+"/overlap",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({op:op,args:args||{}}),
    signal: ctl?ctl.signal:undefined
  }).then(function(r){ return r.json(); }).then(function(j){
    clearTimeout(timer);
    if(j&&j.ok) return j.value;
    throw new Error((j&&j.error)||"Something went wrong");
  },function(e){
    clearTimeout(timer);
    throw new Error(e&&e.name==="AbortError" ? "The server did not answer" : "Can’t reach the server");
  });
}
function token(){ try{ return localStorage.getItem(TOKKEY)||""; }catch(e){ return ""; } }
function setToken(t){
  try{ t?localStorage.setItem(TOKKEY,t):localStorage.removeItem(TOKKEY); }catch(e){}
}
/* people <- team members, so the server is the one truth once signed in */
function adoptMembers(list){
  S.people=list.map(function(m){
    var p=newPerson(m.name,m.tz,!!m.isYou);
    p.mid=m._id; p.email=m.email||""; p.s=m.startHour; p.e=m.endHour; p.wknd=!!m.weekends;
    (m.overrides||[]).forEach(function(o){ p.ov[o.ts]=o.free; });
    return p;
  });
  if(!byId(S.dispId)) S.dispId=(S.people[0]||{}).id;
}
function refreshMe(){
  if(!LIVE||!token()) return Promise.resolve(null);
  return cx("me",{token:token(),teamId:/^[a-z0-9]{25,}$/i.test(S.cur||"")?S.cur:undefined})
    .then(function(r){
    ME=r;
    if(r&&r.team) S.cur=r.team.id;
    if(r&&r.members&&r.members.length) adoptMembers(r.members);
    return r;
  }).catch(function(){ ME=null; setToken(""); return null; });
}
/* one mutation, then take the server's word for it */
function mutate(path,args){
  var a=args||{}; a.token=token();
  return cx(path,a).then(function(){ return refreshMe(); })
    .then(function(){ afterChange(); });
}
function inTeam(){ return !!(LIVE && ME && ME.team && token()); }
function teamId(){ return inTeam()?ME.team.id:S.cur; }
function memberArgs(p){
  var ov=[], k;
  for(k in p.ov) if(p.ov.hasOwnProperty(k)) ov.push({ts:+k,free:!!p.ov[k]});
  return {name:p.name,tz:p.tz,email:p.email||"",startHour:p.s,endHour:p.e,
          weekends:!!p.wknd,overrides:ov};
}
function syncPerson(p){
  if(!inTeam()||!p.mid) return;
  var a=memberArgs(p); a.memberId=p.mid;
  mutate("teams.updateMember",a);
}
/* Signing in with no team yet: make one, and take the people you already
   lined up with you rather than making you type them again. */
function ensureTeam(){
  if(!LIVE||!token()) return Promise.resolve();
  if(ME&&ME.team) return Promise.resolve();
  var you=S.people.filter(function(p){ return p.you; })[0]||S.people[0],
      others=S.people.filter(function(p){ return p!==you; });
  return cx("teams.create",{token:token(),name:"",
      tz:you?you.tz:LOCAL_TZ,startHour:you?you.s:9,endHour:you?you.e:18})
    .then(function(){
      return others.reduce(function(chain,q){
        return chain.then(function(){
          var a=memberArgs(q); a.token=token(); a.teamId=teamId();
          return cx("teams.addMember",a);
        });
      },Promise.resolve());
    })
    .then(refreshMe);
}
function queueFeedback(rec){
  try{
    var q=JSON.parse(localStorage.getItem(QKEY)||"[]");
    q.push(rec); localStorage.setItem(QKEY,JSON.stringify(q));
  }catch(e){}
}
function flushFeedback(){
  if(!LIVE) return;
  var q=[]; try{ q=JSON.parse(localStorage.getItem(QKEY)||"[]"); }catch(e){}
  if(!q.length) return;
  Promise.all(q.map(function(r){ return cx("feedback.send",r).catch(function(){}); }))
    .then(function(){ try{ localStorage.removeItem(QKEY); }catch(e){} });
}

/* ═══════════════ account & team ═══════════════ */
function renderAcct(){
  var c=$("#acctCard"), you=ME&&ME.user;
  if(!LIVE){
    c.innerHTML='<div class="acct"><div class="avatar you">'+esc(initials(S.people[0]||{name:"?"}))+"</div>"+
      '<div class="grow"><div class="t">This browser<span class="pill">local</span></div>'+
      '<div class="s">The team lives here. Share it with a link.</div></div>'+
      '<button class="act" data-invite="1">Invite</button></div>';
  } else if(!you){
    c.innerHTML='<div class="acct"><div class="plus">→</div>'+
      '<div class="grow"><div class="t">Sign in</div>'+
      '<div class="s">Keep your team and your hours on every device.</div></div>'+
      '<button class="act" data-signin="1">Sign in</button></div>';
  } else {
    c.innerHTML='<div class="acct"><div class="avatar">'+esc(initials(you))+"</div>"+
      '<div class="grow"><div class="t">'+esc(you.name||you.email)+'<span class="pill live">live</span></div>'+
      '<div class="s">'+esc(you.email)+"</div></div>"+
      '<button class="act" data-signout="1">Sign out</button></div>';
  }
  c.innerHTML+=teamRow(!!(LIVE&&you));
  $("#teamHead").textContent=(LIVE&&ME&&ME.team)?"In this team":"People";
  $("#foot").innerHTML=(LIVE
    ? "Accounts and teams run on Convex. Your hours, nothing more."
    : "No account, no server, nothing stored anywhere but this browser.")+
    '<br>Built by <a href="/">Jeremy Lasne</a>.';
}
/* the team on screen, and the way through to the others */
function teamRow(sep){
  var n=teamList().length;
  return '<div class="acct"'+(sep?' style="box-shadow:inset 0 1px 0 var(--sep)"':"")+">"+
    '<div class="avatar you">'+esc(teamName().slice(0,2).toUpperCase())+"</div>"+
    '<button class="grow tteam" data-teams="1"><div class="t">'+esc(teamName())+
      '<span class="caret"></span></div>'+
    '<div class="s">'+S.people.length+(S.people.length===1?" person":" people")+
      (n>1?" · "+n+" teams":"")+"</div></button>"+
    '<button class="act" data-invite="1">Invite</button></div>';
}
function openTeams(){
  renderTeams();
  $("#scrim").classList.add("on"); $("#teamSheet").classList.add("on");
  document.body.style.overflow="hidden";
}
function closeTeams(){
  $("#teamSheet").classList.remove("on"); $("#scrim").classList.remove("on");
  document.body.style.overflow="";
}
function renderTeams(){
  var list=teamList(), cur=inTeam()?ME.team.id:S.cur;
  $("#teamList").innerHTML=list.map(function(t){
    return '<div class="row tap" data-pickteam="'+esc(t.id)+'">'+
      '<div class="avatar'+(t.id===cur?"":" you")+'">'+esc(t.name.slice(0,2).toUpperCase())+"</div>"+
      '<div class="grow"><div class="t">'+esc(t.name)+"</div></div>"+
      (t.id===cur?'<span class="mark">✓</span>':"")+"</div>";
  }).join("")+
    '<div class="row tap" data-newteam="1"><div class="plus">+</div>'+
    '<div class="grow"><div class="t">New team</div></div></div>';
  $("#teamActs").innerHTML=
    '<button class="btn sec" data-renameteam="1">Rename</button>'+
    ((list.length>1||inTeam())
      ? '<button class="btn sec" data-dropteam="1">'+(inTeam()?"Leave":"Delete")+"</button>" : "");
}
function inviteUrl(){
  if(LIVE&&ME&&ME.team) return location.origin+location.pathname+"#t="+ME.team.invite;
  return shareUrl();
}
function openInvite(){
  $("#inviteLink").textContent=inviteUrl();
  $("#scrim").classList.add("on"); $("#inviteSheet").classList.add("on");
  document.body.style.overflow="hidden";
}

/* ═══════════════ sign in ═══════════════ */
var authStage=0, authMail="";
function openAuth(){
  authStage=0; authMail="";
  $("#authEmail").value=""; $("#authCode").value="";
  $("#authCodeField").style.display="none";
  $("#authTitle").textContent="Sign in";
  $("#authGo").textContent="Next";
  $("#authNote").textContent="";
  $("#scrim").classList.add("on"); $("#authSheet").classList.add("on");
  document.body.style.overflow="hidden";
  setTimeout(function(){ $("#authEmail").focus(); },350);
}
function closeAuth(){
  $("#authSheet").classList.remove("on"); $("#scrim").classList.remove("on");
  document.body.style.overflow="";
}
function authNext(){
  var btn=$("#authGo");
  if(authStage===0){
    authMail=$("#authEmail").value.trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(authMail)) return toast("That email looks off");
    btn.disabled=true; btn.textContent="…";
    cx("auth.requestCode",{email:authMail}).then(function(r){
      authStage=1; btn.disabled=false; btn.textContent="Sign in";
      $("#authCodeField").style.display="flex";
      $("#authTitle").textContent="Check your mail";
      $("#authNote").textContent=r&&r.devCode
        ? "Dev mode — your code is "+r.devCode
        : "A six-digit code is on its way to "+authMail+".";
      $("#authCode").focus();
    }).catch(function(e){
      btn.disabled=false; btn.textContent="Next"; toast(e.message);
    });
    return;
  }
  var code=$("#authCode").value.trim();
  if(code.length<6) return toast("Six digits");
  btn.disabled=true; btn.textContent="…";
  cx("auth.verify",{email:authMail,code:code}).then(function(r){
    setToken(r.token); closeAuth();
    return refreshMe();
  }).then(function(){
    return pendingInvite ? acceptInvite() : ensureTeam();
  }).then(function(){
    btn.disabled=false; btn.textContent="Sign in";
    flushFeedback(); afterChange(); haptic();
    toast(ME&&ME.team?"Signed in":"Signed in — team ready");
  }).catch(function(e){
    btn.disabled=false; btn.textContent="Sign in"; toast(e.message);
  });
}

/* ═══════════════ feedback ═══════════════ */
var WANTS=["Calendar sync","Client booking","AI agent","Recurring meetings",
           "Meeting links","Reminders","Slack","Round robin",
           "Holidays & PTO","Bigger teams","Mobile app","API & webhooks"];
function renderFeedback(){
  $("#wantChips").innerHTML=WANTS.map(function(w){
    return '<button class="chip'+(S.wants.indexOf(w)>=0?" on":"")+'" data-want="'+esc(w)+'">'+esc(w)+"</button>";
  }).join("");
  $("#fbEmailCard").style.display=(LIVE&&ME&&ME.user)?"none":"";
  $("#fbFoot").textContent=LIVE
    ? "Goes straight to the person building it."
    : "Saved here and sent the moment the backend is connected.";
}
function sendFeedback(){
  var text=$("#fbText").value.trim();
  if(!text && !S.wants.length) return toast("Tell me one thing");
  var rec={text:text,wants:S.wants.slice(),
           email:(ME&&ME.user?ME.user.email:$("#fbEmail").value.trim()),
           token:token()||undefined};
  var done=function(){
    $("#fbForm").style.display="none"; $("#fbThanks").style.display="";
    $("#fbText").value=""; S.wants=[]; renderFeedback(); renderDock(); haptic();
  };
  if(LIVE) cx("feedback.send",rec).then(done).catch(function(){ queueFeedback(rec); done(); });
  else { queueFeedback(rec); done(); }
}

/* ═══════════════ steps ═══════════════ */
var COPY=[
  ["Your team","Everyone’s hours, in their own timezone. White is possible, black is not."],
  ["Plan it","Pick the hour, hand it to the calendar, done."],
  ["What’s missing?","You’ve seen it work. Tell me what would make you keep it."]
];
/* One strip, not two. It follows you from Team to Plan, where it sits at the
   top so the hour can be changed right next to the times it produces. */
var PATHS=["team","plan","next"];
function basePath(){
  return location.pathname.replace(/\/(team|plan|next)\/?$/,"").replace(/\/$/,"");
}
function stepFromPath(){
  var m=location.pathname.match(/\/(team|plan|next)\/?$/);
  return m?PATHS.indexOf(m[1]):0;
}
function placeOverlap(n){
  var ov=$("#overlapSec"), host=n===1?$("#step1"):$("#step0");
  if(n===1){ if(host.firstElementChild!==ov) host.insertBefore(ov,host.firstElementChild); }
  else if(ov.parentNode!==host) host.appendChild(ov);
}
function renderAll(){
  renderAcct(); renderPeople(); renderDays();
  if(S.step<2) renderWTB();
  if(S.step===1) renderBest();
  if(S.step===2) renderFeedback();
  renderDock();
}
function setStep(n,quiet){
  S.step=n;
  if(!quiet && location.pathname.replace(/\/$/,"")!==basePath()+"/"+PATHS[n])
    history.pushState({step:n},"",basePath()+"/"+PATHS[n]+"/"+location.hash);
  var i, secs=document.querySelectorAll(".step");
  for(i=0;i<secs.length;i++) secs[i].classList.toggle("on",i===n);
  $("#segThumb").style.width="calc((100% - 4px)/3)";
  $("#segThumb").style.transform="translateX("+(n*100)+"%)";
  $("#bigTitle").textContent=COPY[n][0];
  $("#bigSub").textContent=COPY[n][1];
  /* on Plan the strip is the first thing, so the title gets out of its way */
  document.querySelector("main").classList.toggle("nohero",n===1);
  placeOverlap(n);
  renderAll();
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderDock(){
  var b=$("#primary"), h=$("#dockHint"), tz=dispTz(), zones={}, n=0, k;
  b.disabled=false;
  if(S.step===0){
    S.people.forEach(function(p){ zones[p.tz]=1; });
    for(k in zones) if(zones.hasOwnProperty(k)) n++;
    b.textContent="Plan a meeting";
    h.textContent=S.people.length===1
      ? "Just you so far — add the other side"
      : S.people.length+" people across "+n+(n===1?" timezone":" timezones");
  } else if(S.step===1){
    var t=sel();
    b.textContent="Add to Google Calendar"; b.disabled=!t;
    h.textContent=t? fmtLongDate(t,tz)+", "+fmtT(t,tz)+" · "+S.dur+" min"
      : "No hour works yet — widen someone’s hours";
  } else {
    b.textContent="Send"; b.disabled=$("#fbThanks").style.display==="";
    h.textContent="One line is plenty.";
  }
}

/* ═══════════════ the sheet ═══════════════ */
var draft=null, draftIsNew=false;
function openSheet(p){
  draftIsNew=!p;
  draft=p?{id:p.id,name:p.name,tz:p.tz,email:p.email,s:p.s,e:p.e,wknd:p.wknd}:
          {id:null,name:"",tz:LOCAL_TZ,email:"",s:9,e:18,wknd:false};
  $("#sheetTitle").textContent=p?"Edit person":"Add person";
  $("#fName").value=draft.name; $("#fEmail").value=draft.email;
  $("#citySearch").value="";
  renderDraft(); renderCities("");
  $("#scrim").classList.add("on"); $("#sheet").classList.add("on");
  document.body.style.overflow="hidden";
}
function closeSheet(){
  $("#scrim").classList.remove("on"); $("#sheet").classList.remove("on");
  document.body.style.overflow=""; draft=null;
}
function renderDraft(){
  $("#fStart").textContent=fmtHour(draft.s);
  $("#fEnd").textContent=fmtHour(draft.e);
  $("#fWeekend").classList.toggle("on",draft.wknd);
  var all=$("#cityList").querySelectorAll("[data-tzsel]"), i;
  for(i=0;i<all.length;i++) all[i].querySelector(".mark").style.opacity=
    (all[i].getAttribute("data-tzsel")===draft.tz?"1":"0");
}
function renderCities(q){
  q=(q||"").toLowerCase().trim();
  var now=Date.now(), list=CITIES.filter(function(c){
    return !q || c[0].toLowerCase().indexOf(q)>=0 || c[1].toLowerCase().indexOf(q)>=0 ||
           c[2].toLowerCase().indexOf(q)>=0;
  });
  if(draft && !list.some(function(c){ return c[2]===draft.tz; }))
    list.unshift([tzCity(draft.tz),"Your timezone",draft.tz]);
  if(!list.length){ $("#cityList").innerHTML='<div class="empty">Nothing matches “'+esc(q)+'”.</div>'; return; }
  $("#cityList").innerHTML=list.slice(0,60).map(function(c){
    return '<div class="row tap" data-tzsel="'+esc(c[2])+'">'+
      '<div class="grow"><div class="t">'+esc(c[0])+'</div>'+
      '<div class="s">'+esc(c[1])+" · "+tzLabel(c[2],now)+"</div></div>"+
      '<div class="v" style="font-size:15px">'+fmtT(now,c[2])+"</div>"+
      '<span class="mark" style="width:16px;text-align:center;font-weight:700;opacity:0">✓</span></div>';
  }).join("");
  if(draft) renderDraft();
}
function commitDraft(){
  if(!draft) return;
  draft.name=$("#fName").value.trim();
  draft.email=$("#fEmail").value.trim();
  var p=draftIsNew?newPerson(draft.name,draft.tz,false):byId(draft.id);
  if(!p){ closeSheet(); return; }
  if(!draftIsNew) p.tz=draft.tz;
  p.name=draft.name; p.email=draft.email; p.s=draft.s; p.e=draft.e; p.wknd=draft.wknd;
  closeSheet();
  if(inTeam()){
    if(draftIsNew){ var na=memberArgs(p); na.teamId=teamId(); mutate("teams.addMember",na); }
    else syncPerson(p);
    return;
  }
  if(draftIsNew) S.people.push(p);
  afterChange();
}

/* ═══════════════ exports ═══════════════ */
function meetingTitle(){ return S.title.trim() || "Meeting"; }
function icsStamp(ts){
  var d=new Date(ts);
  return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+"T"+
         pad(d.getUTCHours())+pad(d.getUTCMinutes())+"00Z";
}
function localLines(){
  var t=sel(), tz=dispTz(), base=dayKey(t,tz);
  return S.people.map(function(p){
    var k=dayKey(t,p.tz), d=k>base?" (+1d)":(k<base?" (−1d)":"");
    return pname(p)+" — "+fmtT(t,p.tz)+d+"  ·  "+tzCity(p.tz);
  });
}
function inviteText(){
  var t=sel(), tz=dispTz();
  return meetingTitle()+"\n"+fmtLongDate(t,tz)+" · "+S.dur+" min\n\n"+localLines().join("\n");
}
function gcalUrl(){
  var t=sel(), end=t+S.dur*60000;
  var emails=S.people.filter(function(p){ return p.email; }).map(function(p){ return p.email; });
  var u="https://calendar.google.com/calendar/render?action=TEMPLATE"+
    "&text="+encodeURIComponent(meetingTitle())+
    "&dates="+icsStamp(t)+"/"+icsStamp(end)+
    "&details="+encodeURIComponent(localLines().join("\n")+"\n\nPlanned with Overlap");
  if(emails.length) u+="&add="+encodeURIComponent(emails.join(","));
  return u;
}
function icsText(){
  var t=sel(), end=t+S.dur*60000;
  function e(s){ return String(s).replace(/[\;,]/g,"\\$&").replace(/\n/g,"\\n"); }
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//overlap//EN","CALSCALE:GREGORIAN",
    "BEGIN:VEVENT","UID:"+t+"-overlap","DTSTAMP:"+icsStamp(Date.now()),
    "DTSTART:"+icsStamp(t),"DTEND:"+icsStamp(end),
    "SUMMARY:"+e(meetingTitle()),"DESCRIPTION:"+e(localLines().join("\n"))]
    .concat(S.people.filter(function(p){ return p.email; }).map(function(p){
      return "ATTENDEE;CN="+e(pname(p))+":mailto:"+p.email; }))
    .concat(["END:VEVENT","END:VCALENDAR"]).join("\r\n");
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

/* ═══════════════ change plumbing ═══════════════ */
function afterChange(){
  _auto=null;
  if(S.pick!==null){
    var days=dayStarts(), lo=days[0], hi=days[DAYS-1]+86400000;
    if(S.pick<lo||S.pick>=hi) S.pick=null;
  }
  if(S.pick!==null){ var di=dayIndex(S.pick); if(di>=0) S.day=di; }
  save(); renderAll();
}

/* ═══════════════ events ═══════════════ */
document.addEventListener("click",function(ev){
  var el, t=ev.target;
  function up(attr){ return t.closest?t.closest("["+attr+"]"):null; }

  if((el=up("data-step"))){ ev.preventDefault(); setStep(+el.getAttribute("data-step")); return; }
  if((el=up("data-add"))){ openSheet(null); return; }
  if((el=up("data-del"))){
    ev.stopPropagation();
    var id=el.getAttribute("data-del"), gone=byId(id);
    if(inTeam()&&gone&&gone.mid){ mutate("teams.removeMember",{memberId:gone.mid}); haptic(); return; }
    S.people=S.people.filter(function(p){ return p.id!==id; });
    if(!byId(S.dispId)) S.dispId=S.people[0].id;
    afterChange(); haptic(); return;
  }
  if((el=up("data-edit"))){ openSheet(byId(el.getAttribute("data-edit"))); return; }
  if((el=up("data-dur"))){ S.dur=+el.getAttribute("data-dur"); afterChange(); return; }
  if((el=up("data-pick"))){
    S.pick=+el.getAttribute("data-pick");
    var di=dayIndex(S.pick); if(di>=0) S.day=di;
    renderBest(); renderDock(); save(); haptic();
    renderDays(); renderWTB();
    return;
  }
  if((el=up("data-signin"))){ openAuth(); return; }
  if((el=up("data-invite"))){ openInvite(); return; }
  if((el=up("data-teams"))){ openTeams(); return; }
  if((el=up("data-pickteam"))){ switchTeam(el.getAttribute("data-pickteam")); closeTeams(); return; }
  if((el=up("data-newteam"))){
    var nn=prompt("Name this team","Team "+(teamList().length+1));
    if(nn!==null){ addTeam(nn.trim()); closeTeams(); }
    return;
  }
  if((el=up("data-renameteam"))){
    var rn=prompt("Rename team",teamName());
    if(rn!==null){ renameTeam(inTeam()?ME.team.id:S.cur,rn); renderTeams(); }
    return;
  }
  if((el=up("data-dropteam"))){
    if(confirm((inTeam()?"Leave ":"Delete ")+teamName()+"?")){
      dropTeam(inTeam()?ME.team.id:S.cur); closeTeams();
    }
    return;
  }
  if((el=up("data-signout"))){
    var t=token();
    setToken(""); ME=null; afterChange(); toast("Signed out");
    if(LIVE&&t) cx("auth.signOut",{token:t}).catch(function(){});
    return;
  }
  if((el=up("data-want"))){
    var w=el.getAttribute("data-want"), at=S.wants.indexOf(w);
    if(at>=0) S.wants.splice(at,1); else S.wants.push(w);
    renderFeedback(); haptic(); return;
  }
  if((el=up("data-day"))){
    S.day=+el.getAttribute("data-day"); renderDays(); renderWTB(); haptic(); return;
  }
  if((el=up("data-tzsel"))){
    draft.tz=el.getAttribute("data-tzsel"); renderDraft(); haptic(); return;
  }
  if((el=up("data-h"))){
    var k=el.getAttribute("data-h");
    if(k==="s-") draft.s=Math.max(0,draft.s-1);
    if(k==="s+") draft.s=Math.min(draft.e-1,draft.s+1);
    if(k==="e-") draft.e=Math.max(draft.s+1,draft.e-1);
    if(k==="e+") draft.e=Math.min(24,draft.e+1);
    renderDraft(); return;
  }
});

$("#fWeekend").addEventListener("click",function(){ draft.wknd=!draft.wknd; renderDraft(); });
$("#authCancel").addEventListener("click",closeAuth);
$("#authGo").addEventListener("click",authNext);
$("#authSheet").addEventListener("keydown",function(ev){ if(ev.key==="Enter") authNext(); });
$("#teamClose").addEventListener("click",closeTeams);
$("#inviteClose").addEventListener("click",function(){
  $("#inviteSheet").classList.remove("on"); $("#scrim").classList.remove("on");
  document.body.style.overflow="";
});
$("#inviteCopy").addEventListener("click",function(){ copyText(inviteUrl(),"Invite link copied"); });
$("#inviteCopyBig").addEventListener("click",function(){ copyText(inviteUrl(),"Invite link copied"); });
$("#fbAgain").addEventListener("click",function(){
  $("#fbThanks").style.display="none"; $("#fbForm").style.display=""; renderDock();
});
$("#sheetCancel").addEventListener("click",closeSheet);
$("#sheetDone").addEventListener("click",commitDraft);
$("#scrim").addEventListener("click",function(){
  closeSheet(); closeAuth(); closeTeams();
  $("#inviteSheet").classList.remove("on");
  document.body.style.overflow="";
});
$("#citySearch").addEventListener("input",function(){ renderCities(this.value); });
$("#titleInput").addEventListener("input",function(){ S.title=this.value; save(); });
$("#winPrev").addEventListener("click",function(){ S.offsetDays=Math.max(0,S.offsetDays-7); S.day=0; afterChange(); });
$("#winNext").addEventListener("click",function(){ S.offsetDays+=7; S.day=0; afterChange(); });
$("#resetBtn").addEventListener("click",function(){
  if(!confirm("Clear everyone and start over?")) return;
  try{ localStorage.removeItem(KEY); }catch(e){}
  history.replaceState(null,"",location.pathname);
  freshState(); afterChange(); setStep(0);
});
$("#primary").addEventListener("click",function(){
  if(S.step===0) return setStep(1);
  if(S.step===2) return sendFeedback();
  if(!sel()) return;
  window.open(gcalUrl(),"_blank","noopener");
  haptic(); toast("Google Calendar opened — press Save");
  setTimeout(function(){ setStep(2); },900);
});
$("#copyBtn").addEventListener("click",function(){
  if(!sel()) return toast("No time to copy yet");
  copyText(inviteText(),"Times copied");
});
$("#icsBtn").addEventListener("click",function(){
  if(!sel()) return toast("No time to save yet");
  var blob=new Blob([icsText()],{type:"text/calendar;charset=utf-8"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=meetingTitle().replace(/[^\w\- ]+/g,"").slice(0,40)+".ics";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); },2000);
});
$("#shareBtn").addEventListener("click",function(){ copyText(shareUrl(),"Link copied"); });

/* ── strip: tap a column to take that hour, drag a row to change someone's ── */
var painting=null, editing=false;
function hcAt(x,y){
  var el=document.elementFromPoint(x,y);
  return (el&&el.classList&&el.classList.contains("hc"))?el:null;
}
function applyPaint(el){
  if(!painting) return;
  var p=byId(painting.id); if(!p) return;
  if(el.getAttribute("data-p")!==p.id) return;
  var ts=+el.getAttribute("data-ts"), k=""+ts;
  if(isFree(p,ts)===painting.val) return;
  delete p.ov[k];
  if(isFree(p,ts)!==painting.val) p.ov[k]=painting.val;
  el.classList.toggle("busy",!painting.val);
  refreshSum(+el.getAttribute("data-col"),ts);
}
function takeSlot(ts){
  S.pick=ts; save(); markColumn(); renderDock(); renderBest(); haptic();
}
/* pointerdown paints (edit mode only) — picking waits for a real click, so a
   sideways swipe scrolls the strip instead of booking an hour */
$("#wtb").addEventListener("pointerdown",function(ev){
  if(!editing) return;
  var el=ev.target.closest?ev.target.closest(".hc"):null;
  if(!el) return;
  var pid=el.getAttribute("data-p");
  if(!pid) return;
  painting={id:pid,val:!isFree(byId(pid),+el.getAttribute("data-ts"))};
  ev.preventDefault();
  if(this.setPointerCapture) this.setPointerCapture(ev.pointerId);
  applyPaint(el); haptic();
});
$("#wtb").addEventListener("click",function(ev){
  if(editing) return;
  var el=ev.target.closest?ev.target.closest(".hc"):null;
  if(!el) return;
  if(el.classList.contains("past")) return toast("That hour has gone");
  takeSlot(+el.getAttribute("data-ts"));
});
$("#wtb").addEventListener("pointermove",function(ev){
  if(!painting) return;
  var el=hcAt(ev.clientX,ev.clientY);
  if(el) applyPaint(el);
});
window.addEventListener("pointerup",function(){
  if(!painting) return;
  var who=byId(painting.id);
  painting=null; _auto=null; save(); renderBest(); renderDock();
  if(who) syncPerson(who);
});
$("#editToggle").addEventListener("click",function(){
  editing=!editing; renderWTB(); haptic();
});

var rzT;
window.addEventListener("resize",function(){
  clearTimeout(rzT);
  rzT=setTimeout(function(){
    renderAll();
  },120);
});
window.addEventListener("popstate",function(){ setStep(stepFromPath(),true); });
window.addEventListener("scroll",function(){
  $("#nav").classList.toggle("scrolled",window.scrollY>4);
},{passive:true});

/* ═══════════════ boot ═══════════════ */
var cameFromLink=location.hash.indexOf("#p=")===0;
if(!load()) freshState();
if(cameFromLink){
  history.replaceState(null,"",location.pathname);
  save();
}
if(sel()!==null){ var _d=dayIndex(sel()); if(_d>=0) S.day=_d; }
(function(){
  var tabs=$("#seg").querySelectorAll("a[data-step]"), b=basePath(), i;
  for(i=0;i<tabs.length;i++) tabs[i].setAttribute("href",b+"/"+PATHS[i]+"/");
})();
setStep(typeof OVERLAP_STEP==="number"?OVERLAP_STEP:stepFromPath(),true);
if(cameFromLink && sel()) setStep(1);

/* an invite link: #t=<code>. Sign in first, then land inside the team. */
var pendingInvite=(location.hash.match(/^#t=([A-Za-z0-9_-]+)/)||[])[1]||"";
if(pendingInvite) history.replaceState(null,"",location.pathname);
function acceptInvite(){
  if(!pendingInvite||!LIVE||!token()) return Promise.resolve();
  var code=pendingInvite; pendingInvite="";
  return cx("teams.join",{token:token(),invite:code,tz:LOCAL_TZ})
    .then(refreshMe)
    .then(function(){ toast("You’re in the team"); })
    .catch(function(e){ toast(e.message); });
}
if(LIVE){
  refreshMe().then(function(){
    flushFeedback();
    if(pendingInvite && token()) acceptInvite().then(afterChange);
    else {
      if(pendingInvite){ openAuth(); $("#authLede").textContent="Sign in to join the team you were invited to."; }
      afterChange();
    }
  });
}
/* keep the clocks honest without a heartbeat the phone has to pay for */
document.addEventListener("visibilitychange",function(){
  if(!document.hidden && S.step===0){ renderPeople(); renderAcct(); }
});
setInterval(function(){ if(!document.hidden && S.step===0) renderPeople(); },60000);

})();
