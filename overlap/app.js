/* ═══════════════════════════════════════════════════════════════════
   Overlap — one app, three addresses.
   team/, plan/ and next/ are real pages so a link lands where it says,
   but moving between them is a pushState, not a reload.
   ═══════════════════════════════════════════════════════════════════ */
document.getElementById("root").innerHTML = "<div class=\"app\">\n\n  <header class=\"nav\" id=\"nav\">\n    <div class=\"nav-bar\">\n      <a class=\"nav-title\" href=\"/overlap/\"><svg class=\"rail-mark\" viewBox=\"0 0 64 56\" aria-hidden=\"true\"><g fill=\"currentColor\"><rect x=\"4\" y=\"13\" width=\"9\" height=\"30\" rx=\"4.5\"/><rect x=\"18\" y=\"4\" width=\"9\" height=\"48\" rx=\"4.5\"/><rect x=\"32\" y=\"17\" width=\"9\" height=\"22\" rx=\"4.5\"/><rect x=\"46\" y=\"9\" width=\"9\" height=\"38\" rx=\"4.5\"/></g><rect x=\"1\" y=\"24\" width=\"61\" height=\"7\" rx=\"3.5\" fill=\"var(--mark-cut,#fff)\"/></svg>Overlap</a>\n      <span class=\"nav-sub\">The hour that works for the whole team.</span>\n      <button class=\"nav-act\" id=\"resetBtn\">Reset</button>\n    </div>\n  </header>\n\n  <!-- ══════════ the side: everything you set, nothing you read ══════════ -->\n  <aside class=\"rail\" id=\"rail\">\n    <a class=\"rail-brand\" href=\"/overlap/\"><svg class=\"rail-mark\" viewBox=\"0 0 64 56\" aria-hidden=\"true\"><g fill=\"currentColor\"><rect x=\"4\" y=\"13\" width=\"9\" height=\"30\" rx=\"4.5\"/><rect x=\"18\" y=\"4\" width=\"9\" height=\"48\" rx=\"4.5\"/><rect x=\"32\" y=\"17\" width=\"9\" height=\"22\" rx=\"4.5\"/><rect x=\"46\" y=\"9\" width=\"9\" height=\"38\" rx=\"4.5\"/></g><rect x=\"1\" y=\"24\" width=\"61\" height=\"7\" rx=\"3.5\" fill=\"var(--mark-cut,#fff)\"/></svg>Overlap</a>\n    <div class=\"rail-body\">\n\n    <section class=\"rsec\" id=\"peopleSec\">\n      <button class=\"rhead\" data-fold=\"peopleSec\">\n        <span>People</span><b id=\"peopleCount\"></b><i class=\"fold\"></i>\n      </button>\n      <div class=\"rbody\">\n        <div class=\"card\" id=\"peopleList\"></div>\n        <div class=\"secfoot\">Working hours are what the overlap is built from.</div>\n      </div>\n    </section>\n\n\n    <section class=\"rsec\" id=\"meetSec\">\n      <button class=\"rhead\" data-fold=\"meetSec\">\n        <span>Meeting</span><b id=\"meetSum\"></b><i class=\"fold\"></i>\n      </button>\n      <div class=\"rbody\">\n        <div class=\"card\">\n          <div class=\"row\">\n            <div class=\"grow\"><div class=\"t\">Name</div></div>\n            <input id=\"titleInput\" placeholder=\"Intro call\" maxlength=\"80\">\n          </div>\n          <div class=\"row stack\">\n            <div class=\"grow\"><div class=\"t\">Length</div></div>\n            <div class=\"chips\" id=\"durChips\" style=\"padding:0\"></div>\n          </div>\n        </div>\n        <div class=\"sechead gap\"><span>Who is invited</span><b id=\"guestCount\"></b></div>\n        <div class=\"card\" id=\"guestList\"></div>\n        <div class=\"secfoot\" id=\"guestFoot\"></div>\n      </div>\n    </section>\n    </div>\n\n    <div class=\"dock\">\n      <div class=\"dock-hint\" id=\"dockHint\"></div>\n      <button class=\"btn\" id=\"primary\">Continue</button>\n      <div class=\"dock-more\">\n        <button class=\"linkbtn\" id=\"icsBtn\">Apple Calendar</button>\n        <button class=\"linkbtn\" id=\"copyBtn\">Copy times</button>\n        <button class=\"linkbtn\" id=\"shareBtn\">Copy link</button>\n      </div>\n    </div>\n\n    <div class=\"rail-foot\" id=\"railFoot\"></div>\n  </aside>\n\n  <main>\n\n    <section class=\"step respond-only\" id=\"respondPane\">\n      <div class=\"sec\">\n        <div class=\"card\">\n          <div class=\"row\">\n            <div class=\"grow\"><div class=\"t\">Your name</div></div>\n            <input id=\"respondName\" placeholder=\"So they know who answered\" maxlength=\"40\"\n                   style=\"text-align:right;flex:1;font-size:17px;letter-spacing:-.02em\">\n          </div>\n          <div class=\"row tap\" data-respondcity=\"1\">\n            <div class=\"grow\"><div class=\"t\">You are in</div></div>\n            <div class=\"v\" id=\"respondCity\"></div><div class=\"chev\"></div>\n          </div>\n        </div>\n        <div class=\"secfoot\">Drag along your row below to cross out the hours you cannot do.</div>\n      </div>\n      <div class=\"sec\" id=\"respondDone\" style=\"display:none\">\n        <div class=\"card\"><div class=\"empty\"><b>Sent.</b>Change anything and send again — it replaces your answer.</div></div>\n      </div>\n    </section>\n\n    <!-- ══════════ the schedule ══════════ -->\n    <section class=\"pane\" id=\"overlapSec\">\n      <div class=\"panehead\">\n        <h2>Calendar</h2>\n        <span class=\"ph-note\" id=\"gridTz\"></span>\n        <button class=\"linkbtn\" id=\"editToggle\">Edit hours</button>\n      </div>\n      <div class=\"weekbar\">\n        <div class=\"daytabs\" id=\"dayTabs\"></div>\n        <div class=\"wsteps\">\n          <button id=\"winPrev\" aria-label=\"Earlier week\">‹</button>\n          <button id=\"winNext\" aria-label=\"Later week\">›</button>\n        </div>\n      </div>\n      <div class=\"weeksub\" id=\"windowSub\"></div>\n      <div class=\"wtb\">\n        <div class=\"wtblabs\" id=\"wtbLabs\"></div>\n        <div class=\"wtbscroll\" id=\"wtbScroll\"><div class=\"wtbgrid\" id=\"wtb\"></div></div>\n      </div>\n      <div class=\"legend\">\n        <i class=\"lg free\"></i><span>can meet</span>\n        <i class=\"lg part\"></i><span>off hours</span>\n        <i class=\"lg busy\"></i><span>asleep or busy</span>\n      </div>\n      <div class=\"secfoot\" id=\"editFoot\"></div>\n    </section>\n\n    <!-- ══════════ the hours it produces ══════════ -->\n    <section class=\"pane\" id=\"planSec\">\n      <div class=\"panehead\"><h2>Best times</h2><span class=\"ph-note\" id=\"bestNote\"></span></div>\n      <div class=\"card\" id=\"bestList\"></div>\n      <div class=\"secfoot\" id=\"bestFoot\"></div>\n    </section>\n\n  </main>\n\n  <p class=\"foot\" id=\"foot\"></p>\n</div>\n\n<div class=\"scrim\" id=\"scrim\"></div>\n\n<!-- ══════════ SHEET — add / edit a person ══════════ -->\n<div class=\"sheet\" id=\"sheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"sheetCancel\">Cancel</button>\n    <span class=\"t\" id=\"sheetTitle\">Add person</span>\n    <button class=\"p\" id=\"sheetDone\">Done</button>\n  </div>\n  <div class=\"sheet-body\">\n    <div style=\"padding:0 16px 14px\">\n      <div class=\"card\">\n        <div class=\"field\"><label>Name</label><input id=\"fName\" placeholder=\"Optional\" maxlength=\"40\"></div>\n        <div class=\"field\"><label>Email</label><input id=\"fEmail\" type=\"email\" placeholder=\"Optional — invites them\" maxlength=\"80\" autocapitalize=\"off\" autocorrect=\"off\"></div>\n      </div>\n    </div>\n    <div class=\"sechead\" style=\"padding:0 20px 7px\"><span>Working hours</span></div>\n    <div style=\"padding:0 16px 14px\">\n      <div class=\"card\">\n        <div class=\"field\"><label>From</label><div class=\"grow\"></div><div class=\"stepper\"><button data-h=\"s-\">−</button><span></span><button data-h=\"s+\">+</button></div><div class=\"v\" id=\"fStart\" style=\"width:58px;text-align:right;font-variant-numeric:tabular-nums\"></div></div>\n        <div class=\"field\"><label>To</label><div class=\"grow\"></div><div class=\"stepper\"><button data-h=\"e-\">−</button><span></span><button data-h=\"e+\">+</button></div><div class=\"v\" id=\"fEnd\" style=\"width:58px;text-align:right;font-variant-numeric:tabular-nums\"></div></div>\n        <div class=\"field\"><label style=\"width:auto;flex:1\">Weekends too</label><div class=\"switch\" id=\"fWeekend\"><i></i></div></div>\n      </div>\n    </div>\n    <div class=\"sechead\" style=\"padding:0 20px 7px\"><span>Asleep</span></div>\n    <div style=\"padding:0 16px 6px\">\n      <div class=\"card\">\n        <div class=\"field\"><label>From</label><div class=\"grow\"></div><div class=\"stepper\"><button data-h=\"z-\">−</button><span></span><button data-h=\"z+\">+</button></div><div class=\"v\" id=\"fSleep\" style=\"width:58px;text-align:right;font-variant-numeric:tabular-nums\"></div></div>\n        <div class=\"field\"><label>Until</label><div class=\"grow\"></div><div class=\"stepper\"><button data-h=\"w-\">−</button><span></span><button data-h=\"w+\">+</button></div><div class=\"v\" id=\"fWake\" style=\"width:58px;text-align:right;font-variant-numeric:tabular-nums\"></div></div>\n      </div>\n    </div>\n    <div class=\"sechead\" style=\"padding:0 20px 7px\"><span>Calendar</span></div>\n    <div style=\"padding:0 16px 6px\"><div class=\"card\" id=\"gcalCard\"></div></div>\n    <div class=\"sechead\" style=\"padding:0 20px 7px\"><span>Timezone</span></div>\n    <div class=\"search\">\n      <svg width=\"15\" height=\"15\" viewBox=\"0 0 16 16\" fill=\"none\"><circle cx=\"7\" cy=\"7\" r=\"5\" stroke=\"currentColor\" stroke-width=\"1.8\"/><path d=\"M11 11l3.5 3.5\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/></svg>\n      <input id=\"citySearch\" placeholder=\"City or timezone\" autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\">\n    </div>\n    <div style=\"padding:0 16px\"><div class=\"card\" id=\"cityList\"></div></div>\n  </div>\n</div>\n\n<!-- ══════════ SHEET — sign in ══════════ -->\n<div class=\"sheet\" id=\"authSheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"authCancel\">Cancel</button>\n    <span class=\"t\" id=\"authTitle\">Sign in</span>\n    <button class=\"p\" id=\"authGo\">Next</button>\n  </div>\n  <div class=\"sheet-body\">\n    <p class=\"sheet-lede\" id=\"authLede\">One email, one code. No password to forget.</p>\n    <div style=\"padding:0 16px 14px\">\n      <div class=\"card\">\n        <div class=\"field\"><label>Email</label><input id=\"authEmail\" type=\"email\" placeholder=\"you@company.com\"\n          autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\"></div>\n        <div class=\"field\" id=\"authCodeField\" style=\"display:none\"><label>Code</label>\n          <input id=\"authCode\" inputmode=\"numeric\" maxlength=\"6\" placeholder=\"6 digits\"></div>\n      </div>\n    </div>\n    <p class=\"sheet-lede\" id=\"authNote\"></p>\n  </div>\n</div>\n\n<!-- ══════════ SHEET — invite ══════════ -->\n<div class=\"sheet\" id=\"teamSheet\"><div class=\"grab\"></div><div class=\"sheet-nav\"><button id=\"teamClose\">Done</button><span class=\"t\">Teams</span><span style=\"width:44px\"></span></div><div class=\"sheet-body\"><p class=\"sheet-lede\">Keep a team per client, per project, per anything. They all stay put, and you can switch at any time.</p><div style=\"padding:0 16px 16px\"><div class=\"card\" id=\"teamList\"></div></div><div style=\"padding:0 16px\" class=\"btnrow\" id=\"teamActs\"></div></div></div><div class=\"sheet\" id=\"inviteSheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"inviteClose\">Done</button>\n    <span class=\"t\">Invite</span>\n    <button class=\"p\" id=\"inviteCopy\">Copy</button>\n  </div>\n  <div class=\"sheet-body\">\n    <p class=\"sheet-lede\">Two ways in. The first asks one question and needs no account.</p>\n    <div style=\"padding:0 16px 8px\" id=\"askWrap\">\n      <div class=\"sechead\"><span>Ask when they can’t</span></div>\n      <div class=\"card\"><div class=\"linkbox\" id=\"askLink\"></div></div>\n      <button class=\"btn\" id=\"askCopy\" style=\"margin-top:10px\">Copy the question link</button>\n    </div>\n    <div style=\"padding:0 20px\"><div class=\"sechead\"><span>Invite to the team</span></div></div>\n    <div style=\"padding:0 16px 16px\"><div class=\"card\"><div class=\"linkbox\" id=\"inviteLink\"></div></div></div>\n    <div style=\"padding:0 16px\"><button class=\"btn\" id=\"inviteCopyBig\">Copy invite link</button></div>\n  </div>\n</div>\n\n<!-- ══════════ SHEET — what next ══════════ -->\n<div class=\"sheet\" id=\"fbSheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"fbClose\">Close</button>\n    <span class=\"t\">What next?</span>\n    <button class=\"p\" id=\"fbSend\">Send</button>\n  </div>\n  <div class=\"sheet-body\">\n    <div id=\"fbForm\">\n      <p class=\"sheet-lede\" id=\"fbLede\">Your event is open in Google Calendar — press Save there.\n        While you are here: what should Overlap do that it doesn’t?</p>\n      <div style=\"padding:0 16px 4px\"><div class=\"chips\" id=\"wantChips\"></div></div>\n      <div style=\"padding:12px 16px 0\">\n        <div class=\"card\">\n          <textarea id=\"fbText\" rows=\"4\" maxlength=\"800\" placeholder=\"Anything at all — what got in your way, what’s missing, what you’d pay for.\"></textarea>\n        </div>\n      </div>\n      <div style=\"padding:12px 16px 0\" id=\"fbEmailCard\">\n        <div class=\"card\">\n          <div class=\"row\">\n            <div class=\"grow\"><div class=\"t\">Email</div><div class=\"s\">If you want a reply.</div></div>\n            <input id=\"fbEmail\" type=\"email\" placeholder=\"Optional\" maxlength=\"80\" autocapitalize=\"off\" autocorrect=\"off\"\n                   style=\"text-align:right;flex:1;font-size:17px;letter-spacing:-.02em\">\n          </div>\n        </div>\n      </div>\n      <p class=\"sheet-lede\" id=\"fbFoot\" style=\"padding-top:14px\"></p>\n    </div>\n    <div id=\"fbThanks\" style=\"display:none\">\n      <div style=\"padding:0 16px 16px\">\n        <div class=\"card\"><div class=\"empty\"><b>Thank you — noted.</b>Every line of this gets read. It decides what gets built next.</div></div>\n      </div>\n      <div style=\"padding:0 16px\"><button class=\"btn sec\" id=\"fbAgain\">Say something else</button></div>\n    </div>\n  </div>\n</div>\n\n<div class=\"toast\" id=\"toast\"></div>";

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
          s:9,e:18,wknd:false,you:!!you,ov:{},
          sl:23,sw:7,          /* asleep from 23:00 to 07:00 */
          busy:{},gcal:0};     /* hours the calendar says are taken */
}
function todayStart(tz){ var p=zp(Date.now(),tz); return wall(p.y,p.m,p.d,0,0,tz); }

var S={
  people:[], title:"", dur:30, offsetDays:0, dispId:null,
  pick:null, day:0, wants:[], nogo:[],
  teams:[], cur:""                 /* every saved team; the one on screen */
};

function newTeamId(){ return "t"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36); }
function freshState(){
  var me=newPerson("You",LOCAL_TZ,true);
  S.people=[me]; S.title=""; S.dur=30; S.offsetDays=0; S.dispId=me.id;
  S.pick=null; S.day=0; S.wants=[]; S.nogo=[];
  S.cur=newTeamId(); S.teams=[{id:S.cur,name:"My team",p:[]}];
  stash();
}
/* ── several teams, kept side by side ───────────────────────────────
   S.people is whichever one is on screen; the rest sit packed in
   S.teams until you switch back to them. */
function peopleArr(){
  return S.people.map(function(p){
    var ov=[],k; for(k in p.ov) if(p.ov.hasOwnProperty(k)) ov.push([+k,p.ov[k]?1:0]);
    var bz=[],bk;
    for(bk in p.busy||{}) if(p.busy.hasOwnProperty(bk)) bz.push(+bk);
    return [p.id,p.name,p.tz,p.email,p.s,p.e,p.wknd?1:0,p.you?1:0,ov,
            p.sl==null?23:p.sl,p.sw==null?7:p.sw,bz,p.gcal||0];
  });
}
function readPeople(arr){
  S.people=(arr||[]).map(function(a){
    var p={id:a[0],name:a[1]||"",tz:a[2],email:a[3]||"",s:+a[4],e:+a[5],
           wknd:!!a[6],you:!!a[7],ov:{},
           sl:a[9]==null?23:+a[9],sw:a[10]==null?7:+a[10],busy:{},gcal:+(a[12]||0)};
    (a[8]||[]).forEach(function(pair){ p.ov[pair[0]]=!!pair[1]; });
    (a[11]||[]).forEach(function(ts){ p.busy[ts]=1; });
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
/* ── what an hour is for one person ───────────────────────────────
   "free"  they can meet
   "off"   awake, but outside their working hours — askable
   "sleep" asleep, or their calendar already has them
   A hand edit wins over everything: if you say you can take a 6am, you can. */
function asleep(p,ts){
  var z=zp(ts,p.tz), h=z.H+z.M/60, a=p.sl==null?23:p.sl, b=p.sw==null?7:p.sw;
  if(a===b) return false;
  return a<b ? (h>=a&&h<b) : (h>=a||h<b);
}
function pstate(p,ts){
  var k=""+ts;
  if(p.ov[k]!==undefined) return p.ov[k]?"free":"off";
  if(p.busy&&p.busy[k]) return "sleep";
  if(asleep(p,ts)) return "sleep";
  var z=zp(ts,p.tz), mins=z.H*60+z.M, d=dow(ts,p.tz);
  if(!p.wknd && (d===0||d===6)) return "off";
  return (mins>=p.s*60 && mins+SLOT<=p.e*60) ? "free" : "off";
}
function isFree(p,ts){ return pstate(p,ts)==="free"; }
/* ── the guest list ─────────────────────────────────────────────────
   The team is who Overlap knows; the guests are who this meeting is
   for. Leaving someone out takes their hours out of the overlap as
   well as their name off the invitation — their row stays on the
   calendar, greyed, so you can see what you are choosing to ignore. */
function invited(p){ return S.nogo.indexOf(p.id)<0; }
function guests(){ return S.people.filter(invited); }
/* free for the whole meeting, not just its first slot */
function freeFor(p,ts,dur){
  var n=Math.ceil(dur/SLOT), i;
  for(i=0;i<n;i++) if(!isFree(p,ts+i*SLOT*60000)) return false;
  return true;
}
function countFree(ts){
  var g=guests(), n=0, i;
  for(i=0;i<g.length;i++) if(isFree(g[i],ts)) n++;
  return n;
}
function countFor(ts,dur){
  var g=guests(), n=0, i;
  for(i=0;i<g.length;i++) if(freeFor(g[i],ts,dur)) n++;
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
  var pen=0,i,p,z,h,late, g=guests();
  for(i=0;i<g.length;i++){
    p=g[i]; z=zp(ts,p.tz); h=z.H+z.M/60; late=h+S.dur/60;
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
function pname(p){ return p.name || (responding&&p.you?"You":tzCity(p.tz)); }
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
    ng:S.nogo,cur:S.cur,teams:S.teams,p:peopleArr()};
}
function unpack(o){
  if(!o||!o.p||!o.p.length) return false;
  readPeople(o.p);
  S.title=o.t||""; S.dur=o.d||30; S.offsetDays=o.o||0; S.day=o.y||0;
  if(byId(o.x)) S.dispId=o.x;
  S.pick=o.k||null;
  S.nogo=(o.ng||[]).slice();
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
function foldOpen(id){ return $("#"+id).classList.contains("open"); }
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
  /* shut, a fold has to say what is inside it */
  var names=S.people.map(pname), shown=names.slice(0,3).join(", ")+
      (names.length>3?" +"+(names.length-3):"");
  $("#peopleCount").textContent=
    foldOpen("peopleSec")
      ? S.people.length+(S.people.length===1?" person":" people") : shown;

  $("#durChips").innerHTML=DURS.map(function(d){
    return '<button class="chip'+(S.dur===d?" on":"")+'" data-dur="'+d+'">'+d+"′</button>";
  }).join("");

  var days=dayStarts(), tz=dispTz();
  var a=zp(days[0],tz), z=zp(days[DAYS-1],tz);
  var window7=WD[dow(days[0],tz)]+" "+a.d+(a.m!==z.m?" "+MO[a.m-1]:"")+
    " → "+WD[dow(days[DAYS-1],tz)]+" "+z.d+" "+MO[z.m-1];
  $("#windowSub").textContent=window7;
  $("#meetSum").textContent=foldOpen("meetSec")
    ? S.dur+" min" : (S.title.trim()||"Meeting")+" · "+S.dur+" min";
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
/* how far ahead of the reader someone lives, at this day: "+2h", "−5:30" */
function relOffset(p,ts,tz){
  var d=(off(ts,p.tz)-off(ts,tz))/60;
  if(!d) return "";
  var s=d<0?"−":"+", a=Math.abs(d), h=Math.floor(a), m=Math.round((a-h)*60);
  return s+h+(m?":"+pad(m):"")+"h";
}
/* the hour a person reads off their own clock at this instant */
function localHour(ts,tz){
  var z=zp(ts,tz);
  return fmtHourShort(z.H)+(z.M?":"+pad(z.M):"");
}
function renderWTB(){
  var tz=dispTz(), days=dayStarts();
  if(S.day>=DAYS||S.day<0) S.day=0;
  var day=days[S.day], z=zp(day,tz), now=Date.now();
  var total=guests().length;              /* who counts */
  var g=$("#wtb"), labs=$("#wtbLabs"), i, html="", lhtml="", stamps=[];
  var rows="var(--wruler) var(--wsum) repeat("+S.people.length+",var(--wrow))";
  g.style.gridTemplateColumns="repeat(24,minmax(var(--cw),1fr))";
  g.style.gridTemplateRows=rows;
  labs.style.gridTemplateRows=rows;
  for(i=0;i<24;i++) stamps.push(wall(z.y,z.m,z.d,i,0,tz));
  var picked=sel(), pick=-1;
  for(i=0;i<24;i++) if(stamps[i]===picked) pick=i;

  /* ── the ruler: the day, once, on the reader's own clock ── */
  lhtml+='<div class="rlab head"><b>'+esc(tzCity(tz))+"</b></div>";
  for(i=0;i<24;i++){
    var rh=zp(stamps[i],tz).H;
    html+='<div class="tick'+(rh%6===0?" q":"")+(i===pick?" on":"")+'">'+
          (rh%2===0||i===pick?fmtHourShort(rh):"")+"</div>";
  }

  /* ── the band: the whole team at once. It darkens as fewer can make it ── */
  lhtml+='<div class="rlab sum"><b>Everyone</b><span>'+
         (total===S.people.length?total+(total===1?" person":" people")
                                 :total+" of "+S.people.length+" invited")+"</span></div>";
  for(i=0;i<24;i++) html+=sumCell(stamps[i],i,pick);

  /* ── one row per person, drawn as bars, not as a chequerboard ── */
  S.people.forEach(function(p){
    var city=tzCity(p.tz), rel=relOffset(p,day,tz), out=!invited(p);
    lhtml+='<div class="rlab'+(out?" notin":"")+'"><b>'+esc(pname(p))+"</b><span><em>"+
           esc(pname(p)===city?tzLabel(p.tz,day):city)+"</em>"+
           (rel?"<i>"+esc(rel)+"</i>":"")+"</span></div>";
    var prev=null;
    for(i=0;i<24;i++){
      var ts=stamps[i], st=pstate(p,ts),
          next=(i<23)?pstate(p,stamps[i+1]):null,
          nd=(i>0)&&dayKey(ts,p.tz)!==dayKey(stamps[i-1],p.tz),
          cls="hc"+(st==="free"?"":(st==="off"?" off":" busy"))+
              (st!==prev?" s":"")+(st!==next?" e":"")+
              (nd?" date":"")+(ts+3600000<now?" past":"")+(i===pick?" pick":"")+
              (out?" notin":"");
      html+='<div class="'+cls+'" data-ts="'+ts+'" data-col="'+i+
            '" data-p="'+p.id+'">'+
            (i===pick?'<span class="n">'+localHour(ts,p.tz)+"</span>":
             nd?'<span class="dm">'+WD[dow(ts,p.tz)]+"</span>":"")+"</div>";
      prev=st;
    }
  });

  g.innerHTML=html; labs.innerHTML=lhtml;
  g.classList.toggle("edit",editing||responding);

  /* a column is only as wide as the room allows, so measure one */
  var cw=g.firstElementChild?g.firstElementChild.getBoundingClientRect().width:36;

  /* hours already gone, greyed in one stroke rather than cell by cell */
  if(dayKey(now,tz)===dayKey(day,tz)){
    var q=zp(now,tz), h=q.H+q.M/60;
    var wash=document.createElement("div");
    wash.className="pastwash";
    wash.style.width=(h*cw).toFixed(1)+"px";
    g.appendChild(wash);
    var line=document.createElement("div");
    line.className="nowline";
    line.style.left=(h*cw).toFixed(1)+"px";
    g.appendChild(line);
  }

  markColumn(true);
  if(!g.querySelector(".colmark")){
    var bc=8, bn=-1, sc=$("#wtbScroll");
    for(i=0;i<24;i++){ var c=countFor(stamps[i],S.dur); if(c>bn){ bn=c; bc=i; } }
    sc.scrollLeft=Math.max(0,bc*cw-sc.clientWidth/2+cw/2);
  }
  var whole=0;
  for(i=0;i<24;i++) if(countFree(stamps[i])===total) whole++;
  $("#gridTz").textContent=!total?"nobody is invited"
    :total<2?fmtDate(day,tz)
    :(whole?whole+(whole===1?" hour suits":" hours suit"):"no hour suits")+" all "+total;
  $("#editToggle").textContent=editing?"Done":"Edit hours";
  $("#editToggle").classList.toggle("on",editing);
  $("#editFoot").textContent=editing
    ? "Drag along someone's row to take hours away or give them back."
    : "";
}
/* how much of the team is out, as ink: 0 is everyone free and paper white,
   1 is nobody and solid ink. The curve is bent so that losing one of five
   still reads as a good hour, and losing four does not. */
function outWeight(n,total){
  if(!total||!n) return 1;
  return Math.pow(1-n/total,1.7)*.92;
}
/* one hour of the team band */
function sumCell(ts,i,pick){
  var total=guests().length, n=countFree(ts), k=outWeight(n,total);
  return '<div class="hc sum'+(n===0?" none":(n===total?" all":""))+
    (ts+3600000<Date.now()?" past":"")+(i===pick?" pick":"")+
    '" data-ts="'+ts+'" data-col="'+i+'" style="--k:'+k.toFixed(3)+'">'+
    (i===pick?'<span class="n">'+n+"</span>":"")+"</div>";
}
function markColumn(scrollTo){
  var g=$("#wtb"), old=g.querySelector(".colmark"), t=sel();
  if(old) old.parentNode.removeChild(old);
  if(!t) return;
  var cell=g.querySelector('.hc[data-ts="'+t+'"]');
  if(!cell) return;                       /* the choice sits on another day */
  var m=document.createElement("div");
  m.className="colmark";
  m.style.left=cell.offsetLeft+"px";
  m.style.width=cell.offsetWidth+"px";
  g.appendChild(m);
  if(scrollTo){
    var sc=$("#wtbScroll"), x=cell.offsetLeft-sc.clientWidth/2+cell.offsetWidth/2;
    sc.scrollLeft=Math.max(0,x);
  }
}
function refreshSum(col,ts){
  var c=$("#wtb").querySelector('.hc.sum[data-col="'+col+'"]');
  if(!c) return;
  var total=guests().length, n=countFree(ts), pick=c.classList.contains("pick");
  c.className="hc sum"+(n===0?" none":(n===total?" all":""))+
    (ts+3600000<Date.now()?" past":"")+(pick?" pick":"");
  c.style.setProperty("--k",outWeight(n,total).toFixed(3));
  c.innerHTML=pick?'<span class="n">'+n+"</span>":"";
}

/* ═══════════════ render — best times ═══════════════ */
var lastBest=[];
function renderBest(){
  lastBest=bestSlots();
  var tz=dispTz(), total=guests().length;
  if(!lastBest.length){
    $("#bestList").innerHTML='<div class="empty"><b>No overlap this week</b>'+
      (guests().length
        ? "Nobody is free at the same time. Widen someone's hours, allow weekends, or step the week forward."
        : "Nobody is invited yet. Choose who is coming under Next.")+"</div>";
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
        '<span class="w2">'+guests().map(function(p){
            var k=dayKey(x.ts,p.tz)-dayKey(x.ts,tz);
            return '<span class="lt'+(freeFor(p,x.ts,S.dur)?"":" out")+'"><b>'+
                   fmtT(x.ts,p.tz)+(k?'<i class="nd">'+(k>0?"+1":"−1")+"</i>":"")+
                   "</b> "+esc(tzCity(p.tz))+"</span>";
          }).join('<i class="sep">·</i>')+"</span></span></button>";
    }).join("");
    $("#bestNote").textContent=lastBest[0].n<total
      ? "the closest this week — no hour suits everyone" : S.dur+" min";
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
var TOKKEY="overlap.token", QKEY="overlap.queue", GUESTKEY="overlap.guest";
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
function guest(){ try{ return localStorage.getItem(GUESTKEY)==="1"; }catch(e){ return false; } }
function setToken(t){
  try{ t?localStorage.setItem(TOKKEY,t):localStorage.removeItem(TOKKEY); }catch(e){}
}
/* people <- team members, so the server is the one truth once signed in */
function adoptMembers(list){
  S.people=list.map(function(m){
    var p=newPerson(m.name,m.tz,!!m.isYou);
    p.mid=m._id; p.email=m.email||""; p.s=m.startHour; p.e=m.endHour; p.wknd=!!m.weekends;
    if(m.sleepStart!=null) p.sl=m.sleepStart;
    if(m.sleepEnd!=null) p.sw=m.sleepEnd;
    (m.overrides||[]).forEach(function(o){ p.ov[o.ts]=o.free; });
    (m.busy||[]).forEach(function(ts){ p.busy[ts]=1; });
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
  var busy=[],b;
  for(b in p.busy||{}) if(p.busy.hasOwnProperty(b)) busy.push(+b);
  return {name:p.name,tz:p.tz,email:p.email||"",startHour:p.s,endHour:p.e,
          weekends:!!p.wknd,overrides:ov,
          sleepStart:p.sl==null?23:p.sl,sleepEnd:p.sw==null?7:p.sw,busy:busy};
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

/* ═══════════════ Answering an invite ═══════════════
   #r=<code> opens the app as the person being asked. They pick their city,
   mark the hours they cannot do, and it goes back to the team. No account,
   no email — the same bargain as a shared document. */
var RKEY="overlap.seat";
var respondCode=(location.hash.match(/^#r=([A-Za-z0-9_-]+)/)||[])[1]||"";
var responding=false, mySeat="";
function seatFor(code){
  try{ return JSON.parse(localStorage.getItem(RKEY)||"{}")[code]||""; }catch(e){ return ""; }
}
function keepSeat(code,id){
  try{
    var m=JSON.parse(localStorage.getItem(RKEY)||"{}");
    m[code]=id; localStorage.setItem(RKEY,JSON.stringify(m));
  }catch(e){}
}
function enterRespond(){
  responding=true;
  mySeat=seatFor(respondCode);
  document.body.classList.add("responding");
  history.replaceState(null,"",location.pathname);
  return cx("teams.respondInfo",{invite:respondCode,memberId:mySeat||undefined})
    .then(function(r){
      if(!r) throw new Error("That link has expired");
      S.teams=[{id:"resp",name:r.team.name,p:[]}]; S.cur="resp";
      adoptMembers(r.members);
      var me=S.people.filter(function(p){ return p.you; })[0];
      if(!me){                                  /* first visit: take a seat */
        me=newPerson("",LOCAL_TZ,true);
        S.people.push(me);
      }
      S.dispId=me.id; S.paint=me.id;
      renderAll();
      $("#respondName").value=me.name||"";
      $("#respondCity").textContent=tzCity(me.tz);
      $("#respondName").addEventListener("input",function(){
        var y=S.people.filter(function(q){ return q.you; })[0];
        if(!y) return;
        y.name=this.value.trim();
        renderWTB();
      });
    });
}
function sendResponse(){
  var me=S.people.filter(function(p){ return p.you; })[0];
  if(!me) return;
  me.name=$("#respondName").value.trim();
  if(!me.name) return toast("Your name, so they know who answered");
  var a=memberArgs(me);
  a.invite=respondCode; a.memberId=mySeat||undefined;
  $("#primary").disabled=true; $("#primary").textContent="Sending…";
  cx("teams.respond",a).then(function(id){
    mySeat=id; keepSeat(respondCode,id);
    $("#primary").disabled=false; $("#primary").textContent="Send again";
    $("#respondDone").style.display="";
    haptic(); toast("Sent — they can see it now");
  }).catch(function(e){
    $("#primary").disabled=false; $("#primary").textContent="Send my answer";
    toast(e.message);
  });
}

/* ═══════════════ Google Calendar ═══════════════
   The page asks Google for a short-lived token with one narrow scope and
   reads free/busy directly. Nothing is stored, no event titles are ever
   requested — only the blocks of time that are already taken. */
var GID=window.OVERLAP_GOOGLE_CLIENT_ID||"";
var gsiReady=false, gTokenClient=null;
function loadGsi(){
  if(!GID||gsiReady) return Promise.resolve(gsiReady);
  return new Promise(function(res){
    var sc=document.createElement("script");
    sc.src="https://accounts.google.com/gsi/client";
    sc.async=true; sc.defer=true;
    sc.onload=function(){ gsiReady=true; res(true); };
    sc.onerror=function(){ res(false); };
    document.head.appendChild(sc);
  });
}
function gToken(){
  return loadGsi().then(function(okGsi){
    if(!okGsi) throw new Error("Google could not be reached");
    return new Promise(function(res,rej){
      gTokenClient=google.accounts.oauth2.initTokenClient({
        client_id:GID,
        scope:"https://www.googleapis.com/auth/calendar.freebusy",
        callback:function(r){
          if(r&&r.access_token) res(r.access_token);
          else rej(new Error("Calendar access was declined"));
        },
        error_callback:function(){ rej(new Error("Calendar access was declined")); }
      });
      gTokenClient.requestAccessToken({prompt:""});
    });
  });
}
/* busy blocks → the hours they cover, in this person's clock */
function markBusy(p,blocks,from,to){
  p.busy={};
  var step=SLOT*60000, ts;
  blocks.forEach(function(b){
    var a=Date.parse(b.start), z=Date.parse(b.end);
    if(isNaN(a)||isNaN(z)) return;
    for(ts=Math.floor(Math.max(a,from)/step)*step; ts<Math.min(z,to); ts+=step) p.busy[ts]=1;
  });
  p.gcal=Date.now();
}
function syncCalendar(p){
  if(!GID) return Promise.reject(new Error("Google is not configured"));
  var days=dayStarts(), from=days[0], to=days[DAYS-1]+86400000;
  return gToken().then(function(tok){
    return fetch("https://www.googleapis.com/calendar/v3/freeBusy",{
      method:"POST",
      headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},
      body:JSON.stringify({
        timeMin:new Date(from).toISOString(),
        timeMax:new Date(to).toISOString(),
        timeZone:p.tz,
        items:[{id:"primary"}]
      })
    });
  }).then(function(r){ return r.json(); }).then(function(j){
    if(j.error) throw new Error(j.error.message||"Calendar refused");
    var cal=(j.calendars||{}).primary||{};
    if(cal.errors&&cal.errors.length) throw new Error("That calendar could not be read");
    markBusy(p,cal.busy||[],from,to);
    syncPerson(p);
    afterChange();
    var n=(cal.busy||[]).length;
    toast(n?("Calendar read — "+n+(n===1?" block":" blocks")+" taken"):"Calendar read — nothing booked");
  });
}
function renderGcalCard(){
  var c=$("#gcalCard");
  if(!c) return;
  if(!GID){
    c.innerHTML='<div class="row"><div class="grow"><div class="t">Not set up</div>'+
      '<div class="s">Add a Google client ID to read busy times.</div></div></div>';
    return;
  }
  var p=draft&&draft.id?byId(draft.id):null, n=p&&p.busy?Object.keys(p.busy).length:0;
  c.innerHTML='<div class="row tap" data-gcal="1"><div class="plus">↻</div>'+
    '<div class="grow"><div class="t">'+(p&&p.gcal?"Read again":"Read my busy times")+"</div>"+
    '<div class="s">'+(p&&p.gcal?(n+(n===1?" hour":" hours")+" taken this week")
      :"Google Calendar, free/busy only — never the titles")+"</div></div></div>";
}

/* ═══════════════ account & team ═══════════════ */
/* The rail carries who you are and which team you are in. All that is left
   here is the line at the foot of the page. */
function renderAcct(){
  $("#foot").innerHTML=(LIVE
    ? "Accounts and teams run on Convex. Your hours, nothing more."
    : "No account, no server, nothing stored anywhere but this browser.")+
    '<br>Built by <a href="/">Jeremy Lasne</a>.';
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
/* the seamless one: no account, one question, straight back to the team */
function askUrl(){
  if(LIVE&&ME&&ME.team) return location.origin+basePath()+"/team/#r="+ME.team.invite;
  return "";
}
function openInvite(){
  var ask=askUrl();
  $("#askWrap").style.display=ask?"":"none";
  $("#askLink").textContent=ask;
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
/* every name in the team, ticked or not, plus what the calendar can do with them */
function renderGuests(){
  var n=guests().length, total=S.people.length;
  $("#guestList").innerHTML=S.people.map(function(p){
    var on=invited(p);
    return '<div class="row tap gst'+(on?" on":"")+'" data-guest="'+p.id+'">'+
      '<div class="avatar'+(p.you?" you":"")+'">'+esc(initials(p))+"</div>"+
      '<div class="grow"><div class="t">'+esc(pname(p))+"</div>"+
      '<div class="s">'+esc(p.email||tzCity(p.tz)+" · no email")+"</div></div>"+
      '<span class="tick"></span></div>';
  }).join("");
  $("#guestCount").textContent=n===total
    ? "all "+total : n+" of "+total;
  var noMail=guests().filter(function(p){ return !p.email; }).length;
  $("#guestFoot").textContent=!n
    ? "Nobody is invited, so there is nothing to look for. Tap a name."
    : noMail
      ? noMail+(noMail===1?" of them has":" of them have")+" no email — their time is in the description, but the calendar cannot add them."
      : "The calendar adds these people as guests.";
}
var ASKED="overlap.asked";
function alreadyAsked(){ try{ return localStorage.getItem(ASKED)==="1"; }catch(e){ return false; } }
/* The question comes up once the event is made — the only moment the app has
   actually done its job, and the only moment anyone knows what it was missing.
   It stops coming up once you answer it. */
function openFeedback(afterCreate){
  renderFeedback();
  $("#fbLede").textContent=afterCreate
    ? "Your event is open in Google Calendar — press Save there. While you are here: what should Overlap do that it doesn’t?"
    : "What should Overlap do that it doesn’t? Every line of this gets read.";
  $("#scrim").classList.add("on"); $("#fbSheet").classList.add("on");
  document.body.style.overflow="hidden";
}
function closeFeedback(){
  $("#fbSheet").classList.remove("on"); $("#scrim").classList.remove("on");
  document.body.style.overflow="";
}
function renderFeedback(){
  $("#wantChips").innerHTML=WANTS.map(function(w){
    return '<button class="chip'+(S.wants.indexOf(w)>=0?" on":"")+'" data-want="'+esc(w)+'">'+esc(w)+"</button>";
  }).join("");
  $("#fbEmailCard").style.display=(LIVE&&ME&&ME.user)?"none":"";
  $("#fbFoot").textContent="Nothing here is required — closing this changes nothing about the event.";
}
function sendFeedback(quiet){
  var text=$("#fbText").value.trim();
  if(!text && !S.wants.length){         /* optional to fill — just move on */
    if(quiet) return;
    return toast("Tell me one thing");
  }
  var rec={text:text,wants:S.wants.slice(),
           email:(ME&&ME.user?ME.user.email:$("#fbEmail").value.trim()),
           token:token()||undefined};
  var done=function(){
    $("#fbText").value=""; S.wants=[]; renderFeedback();
    try{ localStorage.setItem(ASKED,"1"); }catch(e){}
    if(!quiet){
      $("#fbForm").style.display="none"; $("#fbThanks").style.display="";
      haptic();
    } else toast("Noted — thank you");
  };
  if(LIVE) cx("feedback.send",rec).then(done).catch(function(){ queueFeedback(rec); done(); });
  else { queueFeedback(rec); done(); }
}

/* ═══════════════ one page, three sections ═══════════════
   Everything you set lives in the rail; the page itself is only what you
   read — the schedule, the hours it produces, and the box that asks what
   is missing. /team/, /plan/ and /next/ still resolve: they scroll. */
var PATHS=["team","plan","next"];
var PANES=["overlapSec","planSec"];
function basePath(){
  return location.pathname.replace(/\/(team|plan|next)\/?$/,"").replace(/\/$/,"");
}
function stepFromPath(){
  var m=location.pathname.match(/\/(team|plan|next)\/?$/);
  return m?PATHS.indexOf(m[1]):0;
}
function goPane(n,quiet){
  if(n>=PANES.length){                    /* /next/ has no screen; it has a sheet */
    if(!quiet) history.pushState({step:n},"",basePath()+"/"+PATHS[n]+"/"+location.hash);
    openFeedback(false);
    return;
  }
  var el=$("#"+PANES[n]);
  if(!el) return;
  if(!quiet && location.pathname.replace(/\/$/,"")!==basePath()+"/"+PATHS[n])
    history.pushState({step:n},"",basePath()+"/"+PATHS[n]+"/"+location.hash);
  var top=el.getBoundingClientRect().top+window.scrollY-($("#nav").offsetHeight+12);
  window.scrollTo({top:Math.max(0,n?top:0),behavior:quiet?"auto":"smooth"});
}
function renderRail(){
  var b=basePath(), you=ME&&ME.user;
  $("#railFoot").innerHTML=
    '<button class="rail-team" data-teams="1"><span class="avatar you">'+
      esc(teamName().slice(0,2).toUpperCase())+"</span>"+
      '<span class="rail-tx"><b>'+esc(teamName())+"</b><span>"+
      S.people.length+(S.people.length===1?" person":" people")+"</span></span>"+
      '<span class="caret"></span></button>'+
    '<button class="rail-team" data-invite="1"><span class="plus">↗</span>'+
      '<span class="rail-tx"><b>Invite</b><span>Send a link to the team</span></span></button>'+
    (you?'<button class="rail-team" data-signout="1"><span class="avatar">'+esc(initials(you))+"</span>"+
      '<span class="rail-tx"><b>'+esc(you.name||you.email)+"</b><span>Sign out</span></span></button>"
      :'<a class="rail-team" href="'+b+'/login/"><span class="plus">→</span>'+
       '<span class="rail-tx"><b>'+(guest()?"Guest":"Sign in")+"</b><span>"+
       (guest()?"Sign in to keep this":"Keep this on every device")+"</span></span></a>");
}
function renderAll(){
  if(responding){
    var rp=$("#respondPane"), ov=$("#overlapSec");
    if(ov.parentNode!==rp) rp.appendChild(ov);
    renderDays(); renderWTB(); renderRespondDock();
    return;
  }
  renderAcct(); renderRail(); renderPeople(); renderDays(); renderWTB();
  renderBest(); renderGuests(); renderDock();
}
function renderRespondDock(){
  var b=$("#primary"), h=$("#dockHint"), me=S.people.filter(function(p){ return p.you; })[0];
  var n=me?Object.keys(me.ov).filter(function(k){ return !me.ov[k]; }).length:0;
  b.disabled=false;
  b.textContent=mySeat?"Send again":"Send my answer";
  h.textContent=n?(n+(n===1?" hour":" hours")+" crossed out"):"Cross out what does not work";
}
/* one button now, and it is the one that matters */
function renderDock(){
  var b=$("#primary"), h=$("#dockHint"), tz=dispTz(), t=sel(), total=guests().length;
  b.textContent="Add to Google Calendar";
  b.disabled=!t;
  if(!t){
    h.textContent=!total ? "Nobody is invited yet"
      : total===1 ? "Just you so far — add the other side"
      : "No hour works yet — widen someone’s hours";
    return;
  }
  var n=countFor(t,S.dur);
  h.textContent=fmtLongDate(t,tz)+", "+fmtT(t,tz)+" · "+S.dur+" min · "+
    (n===total?"everyone free":n+" of "+total+" free");
}

/* ═══════════════ the sheet ═══════════════ */
var draft=null, draftIsNew=false;
function openSheet(p){
  draftIsNew=!p;
  draft=p?{id:p.id,name:p.name,tz:p.tz,email:p.email,s:p.s,e:p.e,wknd:p.wknd,
           sl:p.sl==null?23:p.sl,sw:p.sw==null?7:p.sw}:
          {id:null,name:"",tz:LOCAL_TZ,email:"",s:9,e:18,wknd:false,sl:23,sw:7};
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
  $("#fSleep").textContent=fmtHour(draft.sl);
  $("#fWake").textContent=fmtHour(draft.sw);
  renderGcalCard();
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
  p.sl=draft.sl; p.sw=draft.sw;
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
  return guests().map(function(p){
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
  var emails=guests().filter(function(p){ return p.email; }).map(function(p){ return p.email; });
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
    .concat(guests().filter(function(p){ return p.email; }).map(function(p){
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

  if((el=up("data-step"))){ ev.preventDefault(); goPane(+el.getAttribute("data-step")); return; }
  if((el=up("data-guest"))){
    var gid=el.getAttribute("data-guest"), at=S.nogo.indexOf(gid);
    if(at>=0) S.nogo.splice(at,1); else S.nogo.push(gid);
    afterChange(); haptic(); return;
  }
  if((el=up("data-fold"))){
    var sec=$("#"+el.getAttribute("data-fold"));
    sec.classList.toggle("open"); renderPeople(); haptic(); return;
  }
  if((el=up("data-add"))){ openSheet(null); return; }
  if((el=up("data-del"))){
    ev.stopPropagation();
    var id=el.getAttribute("data-del"), gone=byId(id);
    if(inTeam()&&gone&&gone.mid){ mutate("teams.removeMember",{memberId:gone.mid}); haptic(); return; }
    S.people=S.people.filter(function(p){ return p.id!==id; });
    S.nogo=S.nogo.filter(function(x){ return x!==id; });
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
  if((el=up("data-respondcity"))){
    var me=S.people.filter(function(p){ return p.you; })[0];
    if(me) openSheet(me);
    return;
  }
  if((el=up("data-gcal"))){
    var who=draft&&draft.id?byId(draft.id):null;
    if(!who) return toast("Save this person first");
    toast("Asking Google…");
    syncCalendar(who).then(function(){ renderGcalCard(); })
      .catch(function(e){ toast(e.message); });
    return;
  }
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
    setToken(""); ME=null;
    try{ localStorage.removeItem(GUESTKEY); }catch(e){}
    afterChange(); toast("Signed out");
    if(LIVE) location.replace(basePath()+"/login/");
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
    if(k==="z-") draft.sl=(draft.sl+23)%24;
    if(k==="z+") draft.sl=(draft.sl+1)%24;
    if(k==="w-") draft.sw=(draft.sw+23)%24;
    if(k==="w+") draft.sw=(draft.sw+1)%24;
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
$("#askCopy").addEventListener("click",function(){ copyText(askUrl(),"Question link copied"); });
$("#inviteCopyBig").addEventListener("click",function(){ copyText(inviteUrl(),"Invite link copied"); });
$("#fbSend").addEventListener("click",function(){ sendFeedback(false); });
$("#fbClose").addEventListener("click",closeFeedback);
$("#fbAgain").addEventListener("click",function(){
  $("#fbThanks").style.display="none"; $("#fbForm").style.display="";
});
$("#sheetCancel").addEventListener("click",closeSheet);
$("#sheetDone").addEventListener("click",commitDraft);
$("#scrim").addEventListener("click",function(){
  closeSheet(); closeAuth(); closeTeams(); closeFeedback();
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
  freshState(); afterChange(); goPane(0);
});
$("#primary").addEventListener("click",function(){
  if(responding) return sendResponse();
  if(!sel()) return toast("Pick an hour on the calendar first");
  window.open(gcalUrl(),"_blank","noopener");
  haptic();
  if(alreadyAsked()) return toast("Google Calendar opened — press Save");
  setTimeout(function(){ openFeedback(true); },260);
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
  var st=pstate(p,ts);
  el.classList.toggle("busy",st==="sleep");
  el.classList.toggle("off",st==="off");
  edgeRow(p.id);
  refreshSum(+el.getAttribute("data-col"),ts);
}
/* bars run across neighbouring hours, so the rounded ends have to move when
   an hour in the middle changes. Twenty-four cells — cheap enough to redo. */
function cellState(el){
  return el.classList.contains("busy")?"sleep":(el.classList.contains("off")?"off":"free");
}
function edgeRow(pid){
  var cells=$("#wtb").querySelectorAll('.hc[data-p="'+pid+'"]'), i, st, next, prev=null;
  for(i=0;i<cells.length;i++){
    st=cellState(cells[i]);
    next=(i+1<cells.length)?cellState(cells[i+1]):null;
    cells[i].classList.toggle("s",st!==prev);
    cells[i].classList.toggle("e",st!==next);
    prev=st;
  }
}
function takeSlot(ts){
  S.pick=ts; save(); markColumn(); renderDock(); renderBest(); haptic();
}
/* pointerdown paints (edit mode only) — picking waits for a real click, so a
   sideways swipe scrolls the strip instead of booking an hour */
$("#wtb").addEventListener("pointerdown",function(ev){
  if(!editing && !responding) return;
  var el=ev.target.closest?ev.target.closest(".hc"):null;
  if(!el) return;
  var pid=el.getAttribute("data-p");
  if(!pid) return;
  if(responding){                         /* only ever your own row */
    var me=S.people.filter(function(q){ return q.you; })[0];
    if(!me || pid!==me.id) return;
  }
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
  painting=null; _auto=null;
  if(responding){ renderRespondDock(); return; }
  save(); renderBest(); renderDock();
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
window.addEventListener("popstate",function(){ goPane(stepFromPath(),true); });
window.addEventListener("scroll",function(){
  $("#nav").classList.toggle("scrolled",window.scrollY>4);
},{passive:true});

/* ═══════════════ boot ═══════════════ */
/* With a backend connected these pages need an account. Without one there
   is nothing to sign in to, so the app runs locally and lets you through. */
if(LIVE && respondCode){
  enterRespond().catch(function(e){
    document.body.classList.remove("responding");
    responding=false;
    toast(e.message||"That link has expired");
  });
}
if(LIVE && !token() && !guest() && !respondCode && location.hash.indexOf("#t=")!==0){
  location.replace(basePath()+"/login/?next="+encodeURIComponent(location.pathname));
}
var cameFromLink=location.hash.indexOf("#p=")===0;
if(!load()) freshState();
if(cameFromLink){
  history.replaceState(null,"",location.pathname);
  save();
}
if(!responding && sel()!==null){ var _d=dayIndex(sel()); if(_d>=0) S.day=_d; }
if(window.innerWidth>=900){
  $("#peopleSec").classList.add("open");
  $("#meetSec").classList.add("open");
}
renderAll();
if(!responding){
  var landOn=cameFromLink&&sel()?1:(typeof OVERLAP_STEP==="number"?OVERLAP_STEP:stepFromPath());
  if(landOn) requestAnimationFrame(function(){ goPane(landOn,true); });
}

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
    if(!ME && token()){        /* the session died while we were away */
      setToken("");
      location.replace(basePath()+"/login/?next="+encodeURIComponent(location.pathname));
      return;
    }
    flushFeedback();
    if(pendingInvite && token()) acceptInvite().then(afterChange);
    else if(pendingInvite){
      openAuth(); $("#authLede").textContent="Sign in to join the team you were invited to.";
      afterChange();
    }
    /* Signed in on the login page, but never through the sheet that used to
       make the team. Make it here, once, so the invite and question links
       exist the moment you land. */
    else if(token() && ME && !ME.team) ensureTeam().then(afterChange,function(){ afterChange(); });
    else afterChange();
  });
}
/* keep the clocks honest without a heartbeat the phone has to pay for */
document.addEventListener("visibilitychange",function(){
  if(!document.hidden && !responding) renderPeople();
});
setInterval(function(){ if(!document.hidden && !responding) renderPeople(); },60000);

})();
