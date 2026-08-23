/* ═══════════════════════════════════════════════════════════════════
   Overlap. One screen: the meeting down the side in three numbered
   steps, the calendar in the middle, and the hour you pick on it.
   team/, plan/ and next/ all resolve; next/ opens the question.
   ═══════════════════════════════════════════════════════════════════ */
document.getElementById("root").innerHTML = "<div class=\"app\">\n\n  <header class=\"nav\" id=\"nav\">\n    <div class=\"nav-bar\">\n      <a class=\"nav-title\" href=\"/overlap/\"><svg class=\"rail-mark\" viewBox=\"0 0 64 56\" aria-hidden=\"true\"><g fill=\"currentColor\"><rect x=\"4\" y=\"13\" width=\"9\" height=\"30\" rx=\"4.5\"/><rect x=\"18\" y=\"4\" width=\"9\" height=\"48\" rx=\"4.5\"/><rect x=\"32\" y=\"17\" width=\"9\" height=\"22\" rx=\"4.5\"/><rect x=\"46\" y=\"9\" width=\"9\" height=\"38\" rx=\"4.5\"/></g><rect x=\"1\" y=\"24\" width=\"61\" height=\"7\" rx=\"3.5\" fill=\"var(--mark-cut,#fff)\"/></svg>Overlap</a>\n      <span class=\"nav-sub\">The hour that works for everyone.</span>\n      <button class=\"nav-act\" id=\"shareTop\">Share</button>\n    </div>\n  </header>\n\n  <!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 the side: everything you set, nothing you read \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n  <aside class=\"rail\" id=\"rail\">\n    <a class=\"rail-brand\" href=\"/overlap/\"><svg class=\"rail-mark\" viewBox=\"0 0 64 56\" aria-hidden=\"true\"><g fill=\"currentColor\"><rect x=\"4\" y=\"13\" width=\"9\" height=\"30\" rx=\"4.5\"/><rect x=\"18\" y=\"4\" width=\"9\" height=\"48\" rx=\"4.5\"/><rect x=\"32\" y=\"17\" width=\"9\" height=\"22\" rx=\"4.5\"/><rect x=\"46\" y=\"9\" width=\"9\" height=\"38\" rx=\"4.5\"/></g><rect x=\"1\" y=\"24\" width=\"61\" height=\"7\" rx=\"3.5\" fill=\"var(--mark-cut,#fff)\"/></svg>Overlap</a>\n    <div class=\"rail-body\">\n\n    <section class=\"rsec\" id=\"meetSec\">\n      <button class=\"rhead\" data-fold=\"meetSec\">\n        <i class=\"stepn\" id=\"s1\">1</i><span>Name it</span><b id=\"meetSum\"></b><i class=\"fold\"></i>\n      </button>\n      <div class=\"rbody\">\n        <div class=\"card\">\n          <div class=\"row\">\n            <div class=\"grow\"><div class=\"t\">Name</div></div>\n            <input id=\"titleInput\" placeholder=\"Intro call\" maxlength=\"80\">\n          </div>\n          <div class=\"row\">\n            <div class=\"grow\"><div class=\"t\">Length</div></div>\n            <div class=\"stepper\"><button data-dur=\"-\">\u2212</button><span></span><button data-dur=\"+\">+</button></div>\n            <div class=\"v\" id=\"durVal\" style=\"width:64px;text-align:right;font-variant-numeric:tabular-nums\"></div>\n          </div>\n        </div>\n        <button class=\"btn\" id=\"createBtn\">Create the meeting</button>\n        <div class=\"secfoot\" id=\"meetFoot\"></div>\n      </div>\n    </section>\n\n    <section class=\"rsec\" id=\"peopleSec\">\n      <button class=\"rhead\" data-fold=\"peopleSec\">\n        <i class=\"stepn\" id=\"s2\">2</i><span>Invite them</span><b id=\"peopleCount\"></b><i class=\"fold\"></i>\n      </button>\n      <div class=\"rbody\">\n        <div class=\"card\" id=\"peopleList\"></div>\n        <div class=\"secfoot\" id=\"guestFoot\"></div>\n      </div>\n    </section>\n    </div>\n\n    <div class=\"dock\">\n      <div class=\"dock-step\"><i class=\"stepn\" id=\"dockStep\">3</i><span id=\"dockHint\"></span></div>\n      <button class=\"btn\" id=\"primary\">Continue</button>\n      <div class=\"dock-more\">\n        <button class=\"linkbtn\" id=\"hoursBtn\">My hours</button>\n        <button class=\"linkbtn\" id=\"icsBtn\">Apple Calendar</button>\n      </div>\n    </div>\n\n    <div class=\"rail-foot\" id=\"railFoot\"></div>\n  </aside>\n\n  <main>\n\n    <!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 the schedule \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n    <section class=\"pane\" id=\"overlapSec\">\n      <div class=\"panehead\">\n        <h2>Calendar</h2>\n        <span class=\"ph-note\" id=\"gridTz\"></span>\n        <button class=\"linkbtn\" id=\"editToggle\">Edit hours</button>\n      </div>\n      <div class=\"weekbar\">\n        <div class=\"daytabs\" id=\"dayTabs\"></div>\n        <div class=\"wsteps\">\n          <button id=\"winPrev\" aria-label=\"Earlier week\">\u2039</button>\n          <button id=\"winNext\" aria-label=\"Later week\">\u203a</button>\n        </div>\n      </div>\n      <div class=\"weeksub\" id=\"windowSub\"></div>\n      <div class=\"wtb\">\n        <div class=\"wtblabs\" id=\"wtbLabs\"></div>\n        <div class=\"wtbscroll\" id=\"wtbScroll\"><div class=\"wtbgrid\" id=\"wtb\"></div></div>\n      </div>\n      <div class=\"legend\">\n        <i class=\"lg free\"></i><span>can meet</span>\n        <i class=\"lg part\"></i><span>off hours</span>\n        <i class=\"lg busy\"></i><span>asleep or busy</span>\n      </div>\n      <div class=\"secfoot\" id=\"editFoot\"></div>\n    </section>\n\n  </main>\n\n  <p class=\"foot\" id=\"foot\"></p>\n</div>\n\n<div class=\"scrim\" id=\"scrim\"></div>\n\n<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 SHEET \u00b7 your day, given once \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n<div class=\"sheet\" id=\"sheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"sheetCancel\">Cancel</button>\n    <span class=\"t\" id=\"sheetTitle\">Your day</span>\n    <button class=\"p\" id=\"sheetDone\">Done</button>\n  </div>\n  <div class=\"sheet-body\">\n    <p class=\"sheet-lede\" id=\"sheetLede\">Answer this once. Every meeting after this starts with it already filled in.</p>\n    <div class=\"sechead\" style=\"padding:0 20px 7px\"><span>Working hours</span></div>\n    <div style=\"padding:0 16px 14px\">\n      <div class=\"card\">\n        <div class=\"field\"><label>From</label><div class=\"grow\"></div><div class=\"stepper\"><button data-h=\"s-\">\u2212</button><span></span><button data-h=\"s+\">+</button></div><div class=\"v\" id=\"fStart\" style=\"width:58px;text-align:right;font-variant-numeric:tabular-nums\"></div></div>\n        <div class=\"field\"><label>To</label><div class=\"grow\"></div><div class=\"stepper\"><button data-h=\"e-\">\u2212</button><span></span><button data-h=\"e+\">+</button></div><div class=\"v\" id=\"fEnd\" style=\"width:58px;text-align:right;font-variant-numeric:tabular-nums\"></div></div>\n        <div class=\"field\"><label style=\"width:auto;flex:1\">Weekends too</label><div class=\"switch\" id=\"fWeekend\"><i></i></div></div>\n      </div>\n    </div>\n    <div class=\"sechead\" style=\"padding:0 20px 7px\"><span>Asleep</span></div>\n    <div style=\"padding:0 16px 6px\">\n      <div class=\"card\">\n        <div class=\"field\"><label>From</label><div class=\"grow\"></div><div class=\"stepper\"><button data-h=\"z-\">\u2212</button><span></span><button data-h=\"z+\">+</button></div><div class=\"v\" id=\"fSleep\" style=\"width:58px;text-align:right;font-variant-numeric:tabular-nums\"></div></div>\n        <div class=\"field\"><label>Until</label><div class=\"grow\"></div><div class=\"stepper\"><button data-h=\"w-\">\u2212</button><span></span><button data-h=\"w+\">+</button></div><div class=\"v\" id=\"fWake\" style=\"width:58px;text-align:right;font-variant-numeric:tabular-nums\"></div></div>\n      </div>\n    </div>\n    <div class=\"sechead\" style=\"padding:0 20px 7px\"><span>Calendar</span></div>\n    <div style=\"padding:0 16px 6px\"><div class=\"card\" id=\"gcalCard\"></div></div>\n    <div class=\"sechead\" style=\"padding:0 20px 7px\"><span>Timezone</span></div>\n    <div class=\"search\">\n      <svg width=\"15\" height=\"15\" viewBox=\"0 0 16 16\" fill=\"none\"><circle cx=\"7\" cy=\"7\" r=\"5\" stroke=\"currentColor\" stroke-width=\"1.8\"/><path d=\"M11 11l3.5 3.5\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/></svg>\n      <input id=\"citySearch\" placeholder=\"City or timezone\" autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\">\n    </div>\n    <div style=\"padding:0 16px\"><div class=\"card\" id=\"cityList\"></div></div>\n  </div>\n</div>\n\n<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 SHEET \u00b7 your meetings \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n<div class=\"sheet\" id=\"meetSheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"meetClose\">Done</button>\n    <span class=\"t\">Your meetings</span>\n    <span style=\"width:44px\"></span>\n  </div>\n  <div class=\"sheet-body\">\n    <p class=\"sheet-lede\">Every meeting you started or were invited to.</p>\n    <div style=\"padding:0 16px 16px\"><div class=\"card\" id=\"meetList\"></div></div>\n    <div style=\"padding:0 16px\" class=\"btnrow\" id=\"meetActs\"></div>\n  </div>\n</div>\n\n<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 SHEET \u00b7 the two links \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n<div class=\"sheet\" id=\"shareSheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"shareClose\">Done</button>\n    <span class=\"t\">Send a link</span>\n    <span style=\"width:44px\"></span>\n  </div>\n  <div class=\"sheet-body\">\n    <p class=\"sheet-lede\">Two links that do two different jobs. Send the one that\n      matches what you are actually doing.</p>\n\n    <div style=\"padding:0 20px 7px\"><div class=\"sechead\">\n      <span class=\"modet\">Team meeting</span><b>everyone answers</b></div></div>\n    <div style=\"padding:0 16px 8px\"><div class=\"card\">\n      <div class=\"linkbox\" id=\"shareLink\"></div>\n      <div class=\"row tap\" data-sharecopy=\"1\"><div class=\"plus\">\u2197</div>\n        <div class=\"grow\"><div class=\"t\">Copy the meeting link</div>\n        <div class=\"s\">One meeting. They answer, then you pick the hour.</div></div>\n        <div class=\"chev\"></div></div>\n    </div></div>\n    <div style=\"padding:0 16px 20px\"><div class=\"secfoot\" style=\"padding:2px 4px 0\">\n      For a kickoff or a standup: the hour is still up for debate.</div></div>\n\n    <div style=\"padding:0 20px 7px\"><div class=\"sechead\">\n      <span class=\"modet\">Client booking</span><b>they take an hour</b></div></div>\n    <div style=\"padding:0 16px 8px\"><div class=\"card\" id=\"bookCard\"></div></div>\n    <div style=\"padding:0 16px 20px\"><div class=\"secfoot\" id=\"bookFoot\"\n      style=\"padding:2px 4px 0\"></div></div>\n\n    <div id=\"recentWrap\" style=\"display:none\">\n      <div style=\"padding:0 20px 7px\"><div class=\"sechead\"><span>You have met with</span></div></div>\n      <div style=\"padding:0 16px 16px\"><div class=\"card\" id=\"recentList\"></div></div>\n    </div>\n  </div>\n</div>\n\n<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 SHEET \u00b7 what next \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n<div class=\"sheet\" id=\"fbSheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"fbClose\">Close</button>\n    <span class=\"t\">What next?</span>\n    <button class=\"p\" id=\"fbSend\">Send</button>\n  </div>\n  <div class=\"sheet-body\">\n    <div id=\"fbForm\">\n      <p class=\"sheet-lede\" id=\"fbLede\">Your event is open in Google Calendar. Press Save there.\n        While you are here: what should Overlap do that it doesn\u2019t?</p>\n      <div style=\"padding:0 16px 4px\"><div class=\"chips\" id=\"wantChips\"></div></div>\n      <div style=\"padding:12px 16px 0\">\n        <div class=\"card\">\n          <textarea id=\"fbText\" rows=\"4\" maxlength=\"800\" placeholder=\"Anything at all. What got in your way, what is missing, what you would pay for.\"></textarea>\n        </div>\n      </div>\n      <div style=\"padding:12px 16px 0\" id=\"fbEmailCard\">\n        <div class=\"card\">\n          <div class=\"row\">\n            <div class=\"grow\"><div class=\"t\">Email</div><div class=\"s\">If you want a reply.</div></div>\n            <input id=\"fbEmail\" type=\"email\" placeholder=\"Optional\" maxlength=\"80\" autocapitalize=\"off\" autocorrect=\"off\"\n                   style=\"text-align:right;flex:1;font-size:17px;letter-spacing:-.02em\">\n          </div>\n        </div>\n      </div>\n      <p class=\"sheet-lede\" id=\"fbFoot\" style=\"padding-top:14px\"></p>\n    </div>\n    <div id=\"fbThanks\" style=\"display:none\">\n      <div style=\"padding:0 16px 16px\">\n        <div class=\"card\"><div class=\"empty\"><b>Thank you, noted.</b>Every line of this gets read. It decides what gets built next.</div></div>\n      </div>\n      <div style=\"padding:0 16px\"><button class=\"btn sec\" id=\"fbAgain\">Say something else</button></div>\n    </div>\n  </div>\n</div>\n\n<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 SHEET \u00b7 people you have met \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->\n<div class=\"sheet\" id=\"peepSheet\">\n  <div class=\"grab\"></div>\n  <div class=\"sheet-nav\">\n    <button id=\"peepClose\">Done</button>\n    <span class=\"t\">People</span>\n    <span style=\"width:44px\"></span>\n  </div>\n  <div class=\"sheet-body\">\n    <p class=\"sheet-lede\">Everyone you have shared a meeting with, whoever did the inviting. Nothing to add and nothing to keep tidy: meeting somebody is what puts them here.</p>\n    <div style=\"padding:0 16px 16px\"><div class=\"card\" id=\"peepList\"></div></div>\n  </div>\n</div>\n\n<div class=\"toast\" id=\"toast\"></div>";

(function(){
"use strict";

/* ═══════════════ state ═══════════════ */
var KEY="overlap.v4";
var uid=0;
function newPerson(name,tz,you){
  return {id:"p"+(++uid)+"_"+Math.floor(Math.random()*1e6),name:name,tz:tz,email:"",
          s:9,e:18,wknd:false,you:!!you,ov:{},
          sl:23,sw:7,          /* asleep from 23:00 to 07:00 */
          busy:{},gcal:0};     /* hours the calendar says are taken */
}
function todayStart(tz){ var p=zp(Date.now(),tz); return wall(p.y,p.m,p.d,0,0,tz); }

var S={
  people:[], title:"", dur:60, offsetDays:0, dispId:null,
  pick:null, day:0, wants:[], nogo:[],
  mid:""                           /* the meeting on screen, once there is one */
};

function freshState(){
  var me=newPerson("You",LOCAL_TZ,true);
  S.people=[me]; S.title=""; S.dur=60; S.offsetDays=0; S.dispId=me.id;
  S.pick=null; S.day=0; S.wants=[]; S.nogo=[]; S.mid="";
  save();
}
/* Packed for localStorage. Signed in, the server is the truth and this is
   only what survives a reload while the first call is in flight. */
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
/* You, always — the one row you are allowed to edit. */
function meRow(){
  return S.people.filter(function(p){ return p.you; })[0]||S.people[0]||null;
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
   Everyone who followed the link is in the meeting; the ticked ones are
   who it is for. Unticking somebody takes their hours out of the overlap
   as well as their name off the invitation — their row stays on the
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
function pname(p){ return p.name || (p.you?"You":tzCity(p.tz)); }
var toastT;
function toast(msg){
  var t=$("#toast"); t.textContent=msg; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove("on"); },1900);
}
function haptic(){ if(navigator.vibrate) try{ navigator.vibrate(8); }catch(e){} }

/* ═══════════════ persistence ═══════════════ */
function packed(){
  return {v:4,t:S.title,d:S.dur,o:S.offsetDays,x:S.dispId,y:S.day,k:S.pick,
    ng:S.nogo,mid:S.mid,p:peopleArr()};
}
function unpack(o){
  if(!o||!o.p||!o.p.length) return false;
  readPeople(o.p);
  S.title=o.t||""; S.dur=o.d||60; S.offsetDays=o.o||0; S.day=o.y||0;
  if(byId(o.x)) S.dispId=o.x;
  S.pick=o.k||null;
  S.nogo=(o.ng||[]).slice();
  S.mid=o.mid||"";
  return true;
}
function save(){
  try{ localStorage.setItem(KEY,JSON.stringify(packed())); }catch(e){}
}
/* The link that matters is the meeting's, and the server mints it. There is
   no state-in-the-URL any more: everything a link needs is a meeting.

   It points at /team/, not /, because / is the landing page — a share link
   has to open the app, not an advert for it. */
function shareUrl(){
  var app=location.origin+basePath()+"/team/";
  return (MEET&&MEET.invite) ? app+"#j="+MEET.invite : app;
}
function load(){
  try{ var raw=localStorage.getItem(KEY); if(raw && unpack(JSON.parse(raw))) return true; }catch(e){}
  return false;
}

/* ═══════════════ render — step 1, who ═══════════════ */
function foldOpen(id){ return $("#"+id).classList.contains("open"); }
/* One list, not two. Everybody in the meeting, and the tick that says whether
   they count — towards the overlap and towards the invitation, which were
   never two different questions. */
function renderPeople(){
  var now=Date.now(), html="";
  S.people.forEach(function(p){
    var on=invited(p);
    html+='<div class="row tap gst'+(on?" on":"")+'" data-guest="'+p.id+'">'+
      '<div class="avatar'+(p.you?" you":"")+'">'+esc(initials(p))+'</div>'+
      '<div class="grow"><div class="t">'+esc(pname(p))+(p.you?' <span style="color:rgba(60,60,67,.3);font-size:13px">you</span>':'')+'</div>'+
      '<div class="s">'+esc(tzCity(p.tz))+" · "+fmtT(now,p.tz)+" · "+fmtHourShort(p.s)+"–"+fmtHourShort(p.e)+
      (p.wknd?", 7 days":"")+(p.gcal?" · calendar":"")+"</div></div>"+
      '<span class="tick"></span></div>';
  });
  /* Two ways to invite somebody, and they are not alternatives: the link
     is for anyone, the list is for the people you keep meeting. */
  if(inMeeting())
    html+='<div class="row tap" data-share="1"><div class="plus">↗</div>'+
          '<div class="grow"><div class="t">Send them the link</div>'+
          '<div class="s">Anyone who opens it can answer</div></div><div class="chev"></div></div>';
  if(inMeeting() && PEEP.length)
    html+='<div class="row tap" data-peeps="1"><div class="plus">+</div>'+
          '<div class="grow"><div class="t">Invite someone you have met</div>'+
          '<div class="s">'+PEEP.length+(PEEP.length===1?" person":" people")+
          ' in your list</div></div><div class="chev"></div></div>';
  $("#peopleList").innerHTML=html;

  var n=guests().length, total=S.people.length;
  $("#peopleCount").textContent=total===1?"just you":total+" people";
  $("#guestFoot").textContent=!n
    ? "Nobody is ticked, so there is nothing to look for."
    : total===1
      ? (inMeeting()?"Nobody has answered yet. They turn up here when they do."
                    :"Create the meeting in step 1, then send them the link.")
      : "Everyone here has answered. Untick anyone who does not need to come.";

  $("#durVal").textContent=fmtDur(S.dur);

  var days=dayStarts(), tz=dispTz();
  var a=zp(days[0],tz), z=zp(days[DAYS-1],tz);
  $("#windowSub").textContent=WD[dow(days[0],tz)]+" "+a.d+(a.m!==z.m?" "+MO[a.m-1]:"")+
    " → "+WD[dow(days[DAYS-1],tz)]+" "+z.d+" "+MO[z.m-1];
  $("#meetSum").textContent=foldOpen("meetSec")
    ? fmtDur(S.dur) : (S.title.trim()||"Meeting")+" · "+fmtDur(S.dur);
  $("#meetFoot").textContent=!LIVE
    ? "No backend connected. This browser only, and no link to share."
    : MEET ? "Everyone who opens the link sees this name."
           : S.title.trim() ? "Creating it gives you the link to send round."
                            : "Name it, and the button below wakes up.";
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
/* The calendar is the page, so it takes the height the window can spare.
   Rows grow to fill it and the band grows fastest, because it is the answer;
   past a big team they stop growing and the page scrolls instead. */
function sizeGrid(n){
  var wrap=$(".wtb"), top=wrap.getBoundingClientRect().top;
  var reserve=window.innerWidth>=900?96:172;   /* legend, footnote, the dock on a phone */
  var avail=window.innerHeight-top-reserve;
  var ruler=28;
  if(!(avail>200)) avail=200;                  /* a short window just scrolls */
  var band=Math.max(72,Math.min(132,avail*.17));
  var row=Math.max(40,Math.min(140,(avail-ruler-band)/n));
  wrap.style.setProperty("--wruler",Math.round(ruler)+"px");
  wrap.style.setProperty("--wrow",Math.round(row)+"px");
  wrap.style.setProperty("--wsum",Math.round(band)+"px");
}
function renderWTB(){
  var tz=dispTz(), days=dayStarts();
  if(S.day>=DAYS||S.day<0) S.day=0;
  var day=days[S.day], z=zp(day,tz), now=Date.now();
  var total=guests().length;              /* who counts */
  var g=$("#wtb"), labs=$("#wtbLabs"), i, html="", lhtml="", stamps=[];
  sizeGrid(S.people.length);
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
  g.classList.toggle("edit",editing);

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
  return '<div class="hc sum'+(n===0?" none":(n===total?" all":""))+(k>.55?" dk":"")+
    (ts+3600000<Date.now()?" past":"")+(i===pick?" pick":"")+
    '" data-ts="'+ts+'" data-col="'+i+'" style="--k:'+k.toFixed(3)+'">'+
    (total?'<span class="n">'+n+"</span>":"")+"</div>";
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
  var k=outWeight(n,total);
  c.className="hc sum"+(n===0?" none":(n===total?" all":""))+(k>.55?" dk":"")+
    (ts+3600000<Date.now()?" past":"")+(pick?" pick":"");
  c.style.setProperty("--k",k.toFixed(3));
  c.innerHTML=total?'<span class="n">'+n+"</span>":"";
}

/* ═══════════════ backend ═══════════════
   Convex over its HTTP API — plain fetch, no SDK, no build step. Set
   window.OVERLAP_CONVEX_URL (see overlap/README.md) and the app goes live:
   real accounts, real meetings, links that survive a new device.

   Without one there is nothing to sign in to, so the app falls back to this
   browser alone. That is a workbench, not a product: no link works.
   ═════════════════════════════════════════ */
var CONVEX = (window.OVERLAP_CONVEX_URL||"").replace(/\/+$/,"");
var LIVE = /^https?:\/\//.test(CONVEX);
var TOKKEY="overlap.token", QKEY="overlap.queue";
var ME=null;        /* {user,profile,meetings} once signed in */
var MEET=null;      /* the meeting on screen */
/* `me` answers with your most recent meeting when you do not name one, which
   is right on load and wrong the moment you say New meeting. This says which
   of the two we are doing. */
var STARTING=false;
var PEEP=[];        /* people you have met with, whoever invited whom */

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
function signedIn(){ return !!(LIVE && ME && ME.user && token()); }
/* Signed in and having said what your day looks like are two different
   things. Everything waits on the second. */
function ready(){ return !LIVE || (signedIn() && ME.profile && ME.profile.ready); }
function inMeeting(){ return !!(signedIn() && MEET); }

/* people <- participants, so the server is the one truth once signed in */
function adoptSeats(list){
  S.people=(list||[]).map(function(m){
    var p=newPerson(m.name,m.tz,!!m.isYou);
    p.pid=m._id; p.email=m.email||""; p.s=m.startHour; p.e=m.endHour; p.wknd=!!m.weekends;
    if(m.sleepStart!=null) p.sl=m.sleepStart;
    if(m.sleepEnd!=null) p.sw=m.sleepEnd;
    p.gcal=m.gcal||0;
    (m.overrides||[]).forEach(function(o){ p.ov[o.ts]=o.free; });
    (m.busy||[]).forEach(function(ts){ p.busy[ts]=1; });
    return p;
  });
  if(!S.people.length) S.people=[newPerson("You",LOCAL_TZ,true)];
  if(!byId(S.dispId)) S.dispId=(meRow()||S.people[0]).id;
}
function refreshMe(){
  if(!LIVE||!token()) return Promise.resolve(null);
  return cx("me",{token:token(),meetingId:S.mid||undefined}).then(function(r){
    ME=r;
    if(!r) return null;
    MEET=STARTING?null:(r.meeting||null);
    PEEP=r.contacts||[];
    if(MEET){
      S.mid=MEET.id;
      S.title=MEET.title||"";
      S.dur=MEET.durationMin||60;
      if(MEET.startsAt) S.pick=MEET.startsAt;
      adoptSeats(r.participants);
    } else {
      S.mid="";
      /* signed in with nothing on the go: one row, yours, from your profile */
      var me=newPerson(r.user.name,(r.profile&&r.profile.tz)||LOCAL_TZ,true);
      applyProfile(me,r.profile);
      me.email=r.user.email||"";
      S.people=[me]; S.dispId=me.id;
    }
    return r;
  }).catch(function(){ ME=null; MEET=null; setToken(""); return null; });
}
function applyProfile(p,pr){
  if(!pr) return p;
  if(pr.tz) p.tz=pr.tz;
  if(pr.startHour!=null) p.s=pr.startHour;
  if(pr.endHour!=null) p.e=pr.endHour;
  p.wknd=!!pr.weekends;
  if(pr.sleepStart!=null) p.sl=pr.sleepStart;
  if(pr.sleepEnd!=null) p.sw=pr.sleepEnd;
  return p;
}
function hoursArgs(p){
  var ov=[], k;
  for(k in p.ov) if(p.ov.hasOwnProperty(k)) ov.push({ts:+k,free:!!p.ov[k]});
  var busy=[],b;
  for(b in p.busy||{}) if(p.busy.hasOwnProperty(b)) busy.push(+b);
  return {tz:p.tz,startHour:p.s,endHour:p.e,weekends:!!p.wknd,
          sleepStart:p.sl==null?23:p.sl,sleepEnd:p.sw==null?7:p.sw,
          overrides:ov,busy:busy,gcal:p.gcal||0};
}
/* Your row, and only ever your row. Nobody edits anybody else now. */
function syncPerson(p){
  if(!inMeeting()||!p||!p.you) return Promise.resolve();
  var a=hoursArgs(p);
  a.token=token(); a.meetingId=S.mid;
  return cx("meet.hours",a).catch(function(e){ toast(e.message); });
}
/* The answer you give once, kept on your account so the next meeting opens
   already filled in. Saved alongside your row in this meeting. */
function saveProfile(p){
  if(!signedIn()) return Promise.resolve();
  var a=hoursArgs(p);
  return cx("meet.profile",{token:token(),tz:a.tz,startHour:a.startHour,
      endHour:a.endHour,weekends:a.weekends,
      sleepStart:a.sleepStart,sleepEnd:a.sleepEnd})
    .then(function(){ if(ME&&ME.profile) ME.profile.ready=true; });
}
/* A blank one, on screen, before the server knows anything about it. */
function startFresh(){
  STARTING=true; MEET=null;
  S.mid=""; S.pick=null; S.day=0; S.title=""; S.nogo=[];
  var me=newPerson((ME&&ME.user&&ME.user.name)||"You",
                   (ME&&ME.profile&&ME.profile.tz)||LOCAL_TZ,true);
  if(ME){ applyProfile(me,ME.profile); me.email=(ME.user&&ME.user.email)||""; }
  S.people=[me]; S.dispId=me.id;
  save(); afterChange();
}
function createMeeting(){
  if(!signedIn()) return Promise.reject(new Error("Sign in first"));
  return cx("meet.create",{token:token(),title:S.title.trim(),durationMin:S.dur,tz:LOCAL_TZ})
    .then(function(r){ S.mid=r.id; STARTING=false; save(); return refreshMe(); })
    .then(function(){ afterChange(); haptic(); toast("Link ready. Send it to them."); openShare(); });
}
function joinMeeting(code){
  return cx("meet.join",{token:token(),invite:code,tz:LOCAL_TZ})
    .then(function(r){ S.mid=r.id; STARTING=false; save(); return refreshMe(); });
}
function switchMeeting(id){
  if(id===S.mid) return;
  S.mid=id; S.pick=null; S.day=0; STARTING=false; save();
  refreshMe().then(function(){ afterChange(); toast(MEET?MEET.title:"Switched"); });
}
function renameMeeting(){
  if(!inMeeting()) return;
  cx("meet.rename",{token:token(),meetingId:S.mid,title:S.title.trim(),durationMin:S.dur})
    .catch(function(e){ toast(e.message); });
}
function bookMeeting(ts){
  if(!inMeeting()) return Promise.resolve();
  return cx("meet.book",{token:token(),meetingId:S.mid,startsAt:ts})
    .catch(function(e){ toast(e.message); });
}

/* feedback survives being offline: queued here, flushed on the next call */
function queueFeedback(rec){
  try{
    var q=JSON.parse(localStorage.getItem(QKEY)||"[]");
    q.push(rec); localStorage.setItem(QKEY,JSON.stringify(q.slice(-20)));
  }catch(e){}
}
function flushFeedback(){
  if(!LIVE) return;
  var q=[];
  try{ q=JSON.parse(localStorage.getItem(QKEY)||"[]"); }catch(e){ return; }
  if(!q.length) return;
  var left=q.slice();
  q.reduce(function(chain,rec){
    return chain.then(function(){
      return cx("feedback.send",rec).then(function(){
        left=left.filter(function(x){ return x!==rec; });
      },function(){});
    });
  },Promise.resolve()).then(function(){
    try{ localStorage.setItem(QKEY,JSON.stringify(left)); }catch(e){}
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
    toast(n?("Calendar read. "+n+(n===1?" block":" blocks")+" taken."):"Calendar read. Nothing booked.");
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
      :"Google Calendar, free/busy only. Never the titles.")+"</div></div></div>";
}

/* ═══════════════ account ═══════════════ */
/* The rail carries who you are and which meeting you are looking at. All
   that is left here is the line at the foot of the page. */
function renderAcct(){
  $("#foot").innerHTML=(LIVE
    ? "Accounts and meetings run on Convex. Your hours, nothing more."
    : "No account, no server, nothing stored anywhere but this browser.")+
    '<br>Built by <a href="/">Jeremy Lasne</a>.';
}
/* ═══════════════ your meetings ═══════════════ */
function openMeetings(){
  renderMeetings();
  $("#scrim").classList.add("on"); $("#meetSheet").classList.add("on");
  document.body.style.overflow="hidden";
}
function closeMeetings(){
  $("#meetSheet").classList.remove("on"); $("#scrim").classList.remove("on");
  document.body.style.overflow="";
}
function renderMeetings(){
  var list=(ME&&ME.meetings)||[];
  $("#meetList").innerHTML=(list.length?list.map(function(m){
    var when=m.startsAt?fmtLongDate(m.startsAt,LOCAL_TZ)+" · "+fmtT(m.startsAt,LOCAL_TZ)
                       :(m.kind==="call"?"a call":"not booked yet");
    return '<div class="row tap" data-pickmeet="'+esc(m.id)+'">'+
      '<div class="avatar'+(m.id===S.mid?" you":"")+'">'+esc((m.title||"M").slice(0,2).toUpperCase())+"</div>"+
      '<div class="grow"><div class="t">'+esc(m.title||"Meeting")+"</div>"+
      '<div class="s">'+esc(when)+"</div></div>"+
      (m.id===S.mid?'<span class="mark">✓</span>':"")+"</div>";
  }).join(""):'<div class="empty"><b>Nothing yet.</b>Name a meeting and press Create.</div>')+
    '<div class="row tap" data-newmeet="1"><div class="plus">+</div>'+
    '<div class="grow"><div class="t">New meeting</div></div></div>';
  $("#meetActs").innerHTML=inMeeting()
    ? '<button class="btn sec" data-leavemeet="1">Leave this meeting</button>' : "";
}

/* ═══════════════ one link ═══════════════ */
function openShare(){
  if(!inMeeting()) return toast("Create the meeting first");
  $("#shareLink").textContent=shareUrl();
  renderRecent(); renderBook();
  $("#scrim").classList.add("on"); $("#shareSheet").classList.add("on");
  document.body.style.overflow="hidden";
}
function closeShare(){
  $("#shareSheet").classList.remove("on"); $("#scrim").classList.remove("on");
  document.body.style.overflow="";
}
/* Your own link, the one that does not expire and is not about any single
   meeting. Somebody opens it, sees your free hours and takes one. */
function bookUrl(h){ return location.origin+basePath()+"/book/#"+h; }
function renderBook(){
  var c=$("#bookCard"), f=$("#bookFoot"), h=ME&&ME.profile&&ME.profile.handle;
  if(!c) return;
  if(!signedIn()){ c.innerHTML='<div class="empty">Sign in to get one.</div>'; f.textContent=""; return; }
  if(!h){
    c.innerHTML='<div class="row tap" data-handle="1"><div class="plus">+</div>'+
      '<div class="grow"><div class="t">Pick a handle</div>'+
      '<div class="s">Turns into one permanent link, yours, for anybody</div></div>'+
      '<div class="chev"></div></div>';
    f.textContent="For a prospect or a client: no meeting to create, no waiting. "+
      "They open it, take an hour of your free time, and you get the invitation.";
    return;
  }
  c.innerHTML='<div class="linkbox">'+esc(bookUrl(h))+"</div>"+
    '<div class="row tap" data-bookcopy="1"><div class="plus">↗</div>'+
    '<div class="grow"><div class="t">Copy your booking link</div>'+
    '<div class="s">They book straight into your free hours.</div></div>'+
    '<div class="chev"></div></div>'+
    '<div class="row tap" data-handle="1"><div class="grow"><div class="t">Change the handle</div>'+
    '<div class="s">'+esc(h)+'</div></div><div class="chev"></div></div>';
  f.textContent="For a prospect or a client: no meeting to create, no waiting. "+
    "Same link every time, so it can live in your signature.";
}

/* In the share sheet it is a reminder of who the link still has to reach,
   so the ones already here are not worth listing. */
function renderRecent(){
  var w=$("#recentWrap"), out=PEEP.filter(function(r){ return !r.here; });
  if(!out.length){ w.style.display="none"; return; }
  w.style.display="";
  $("#recentList").innerHTML=out.slice(0,8).map(function(r){
    return '<div class="row tap" data-peep="'+esc(r.email)+'"><div class="avatar">'+
      esc((r.name||r.email||"?").slice(0,2).toUpperCase())+"</div>"+
      '<div class="grow"><div class="t">'+esc(r.name||r.email)+"</div>"+
      '<div class="s">'+esc(r.email)+"</div></div>"+
      '<span class="mark">↗</span></div>';
  }).join("");
}

/* ═══════════════ people you have met ═══════════════
   Not a list anybody maintains. You met them, so they are here. */
function openPeep(){
  renderPeep();
  $("#scrim").classList.add("on"); $("#peepSheet").classList.add("on");
  document.body.style.overflow="hidden";
}
function closePeep(){
  $("#peepSheet").classList.remove("on"); $("#scrim").classList.remove("on");
  document.body.style.overflow="";
}
function renderPeep(){
  if(!PEEP.length){
    $("#peepList").innerHTML='<div class="empty"><b>Nobody yet.</b>'+
      'Share a meeting link. Whoever answers it turns up here for good.</div>';
    return;
  }
  $("#peepList").innerHTML=PEEP.map(function(r){
    var met=r.met>1?r.met+" meetings":"1 meeting";
    return '<div class="row tap" data-peep="'+esc(r.email)+'">'+
      '<div class="avatar'+(r.here?" you":"")+'">'+
      esc((r.name||r.email||"?").slice(0,2).toUpperCase())+"</div>"+
      '<div class="grow"><div class="t">'+esc(r.name||r.email)+"</div>"+
      '<div class="s">'+esc(r.email)+" · "+met+(r.here?" · in this one":"")+"</div></div>"+
      '<span class="mark">'+(r.here?"✓":"↗")+"</span></div>";
  }).join("");
}
/* Tapping one is the only thing you can do with a contact, and it is the
   only thing worth doing: send them the link. */
function inviteContact(email){
  var r=PEEP.filter(function(x){ return x.email===email; })[0];
  if(!r) return;
  if(r.here) return toast(esc(r.name||email)+" is already in this one");
  if(!inMeeting()) return toast("Create the meeting first");
  var body="Find an hour that works for us:\n\n"+shareUrl();
  location.href="mailto:"+encodeURIComponent(email)+
    "?subject="+encodeURIComponent(S.title.trim()||"Meeting")+
    "&body="+encodeURIComponent(body);
}

/* ═══════════════ feedback ═══════════════ */
var WANTS=["Calendar sync","Client booking","AI agent","Recurring meetings",
           "Meeting links","Reminders","Slack","Round robin",
           "Holidays & PTO","Bigger teams","Mobile app","API & webhooks"];
var ASKED="overlap.asked";
function alreadyAsked(){ try{ return localStorage.getItem(ASKED)==="1"; }catch(e){ return false; } }
/* The question comes up once the event is made — the only moment the app has
   actually done its job, and the only moment anyone knows what it was missing.
   It stops coming up once you answer it. */
function openFeedback(afterCreate){
  renderFeedback();
  $("#fbLede").textContent=afterCreate
    ? "Your event is open in Google Calendar. Press Save there. While you are here: what should Overlap do that it doesn’t?"
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
  $("#fbFoot").textContent="Nothing here is required. Closing this changes nothing about the event.";
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
    } else toast("Noted, thank you");
  };
  if(LIVE) cx("feedback.send",rec).then(done).catch(function(){ queueFeedback(rec); done(); });
  else { queueFeedback(rec); done(); }
}

/* ═══════════════ one screen ═══════════════
   There is only the calendar now. /team/ and /plan/ both land on it;
   /next/ still opens the question, because that is a sheet and not a
   screen. */
function basePath(){
  return location.pathname.replace(/\/(team|plan|next)\/?$/,"").replace(/\/$/,"");
}
function isNextPage(){
  return /\/next\/?$/.test(location.pathname) ||
         (typeof OVERLAP_STEP==="number" && OVERLAP_STEP===2);
}

/* ═══════════════ the four steps ═══════════════
   1 name it · 2 get the link · 3 wait for them · 4 put it in the calendar.
   A step is done when the thing it asks for exists, and the one you are on
   is the first that is not. The rail says which, and the button does it. */
function stepDone(n){
  if(n===1) return inMeeting();          /* named, timed and created */
  if(n===2) return guests().length>1;    /* somebody else answered */
  if(n===3) return !!(MEET&&MEET.startsAt);
  return false;
}
function stepNow(){
  for(var n=1;n<=3;n++) if(!stepDone(n)) return n;
  return 3;
}
function renderSteps(){
  var now=stepNow(), n, el;
  for(n=1;n<=2;n++){
    el=$("#s"+n);
    if(!el) continue;
    el.textContent=stepDone(n)?"✓":n;
    el.className="stepn"+(stepDone(n)?" done":(n===now?" on":" wait"));
  }
  el=$("#dockStep");
  if(el){
    el.textContent="3";
    el.className="stepn"+(now===3?" on":" wait");
  }
}
/* Step 2 is a thing you get, so show it once you have it. */
/* Step 1's button, which is the whole of step 1 once it is named. The link
   itself never appears in the rail: "Send them the link" copies it, and the
   Share sheet shows it when somebody wants to look. */
function renderCreate(){
  var g=$("#createBtn");
  if(!g) return;
  g.style.display=inMeeting()?"none":"";
  g.disabled=!(LIVE&&signedIn()&&ready()&&S.title.trim());
}
function renderRail(){
  var b=basePath(), you=ME&&ME.user;
  var n=S.people.length;
  $("#railFoot").innerHTML=
    '<button class="rail-team" data-meetings="1"><span class="avatar you">'+
      esc((S.title.trim()||"M").slice(0,2).toUpperCase())+"</span>"+
      '<span class="rail-tx"><b>'+esc(S.title.trim()||"Untitled meeting")+"</b><span>"+
      (inMeeting()?n+(n===1?" person":" people"):"not created yet")+"</span></span>"+
      '<span class="caret"></span></button>'+
    (signedIn()
      ?'<button class="rail-team" data-peeps="1"><span class="plus">☺</span>'+
       '<span class="rail-tx"><b>People</b><span>'+
       (PEEP.length?PEEP.length+(PEEP.length===1?" you have met":" you have met")
                   :"Nobody yet")+"</span></span></button>":"")+
    (you?'<button class="rail-team" data-signout="1"><span class="avatar">'+esc(initials(you))+"</span>"+
      '<span class="rail-tx"><b>'+esc(you.name||you.email)+"</b><span>Sign out</span></span></button>"
      :'<a class="rail-team" href="'+b+'/login/"><span class="plus">→</span>'+
       '<span class="rail-tx"><b>Sign in</b><span>With Google</span></span></a>');
}
function renderAll(){
  renderAcct(); renderRail(); renderPeople(); renderCreate(); renderDays(); renderWTB();
  renderDock(); renderSteps();
}
/* One button, and what it says is where you are.
     no meeting  → make one
     no hour yet → say what is missing
     an hour     → put it in the calendar, for everyone at once */
function renderDock(){
  var b=$("#primary"), h=$("#dockHint"), tz=dispTz(), t=sel(), total=guests().length;
  $("#hoursBtn").style.display=ready()?"":"none";
  $("#icsBtn").style.display=(t?"":"none");

  if(LIVE && !signedIn()){
    b.textContent="Sign in with Google"; b.disabled=false;
    h.textContent="Overlap needs to know who you are before it can hold a link.";
    return;
  }
  if(LIVE && !ready()){
    b.textContent="Save my hours"; b.disabled=false;
    h.textContent="One answer, reused by every meeting after this.";
    return;
  }
  /* From here the button is step 4 and nothing else. It stays grey until
     the three steps above it are actually finished, and the line above it
     says which one is not. */
  b.textContent=MEET&&MEET.startsAt?"Open in Google Calendar":"Add to Google Calendar";
  if(LIVE && !inMeeting()){
    b.disabled=true;
    h.textContent=S.title.trim()
      ? "Create the meeting in step 1 first."
      : "Name it in step 1 to begin.";
    return;
  }
  if(total<2){
    b.disabled=true;
    h.textContent="Nobody has answered yet. Invite them in step 2.";
    return;
  }
  if(!t){
    b.disabled=true;
    h.textContent="No hour works yet. Widen someone’s hours, or look at next week.";
    return;
  }
  b.disabled=false;
  var n=countFor(t,S.dur);
  h.textContent=fmtLongDate(t,tz)+", "+fmtT(t,tz)+" · "+fmtDur(S.dur)+" · "+
    (n===total?"everyone free":n+" of "+total+" free");
}

/* ═══════════════ the sheet ═══════════════ */
/* The sheet only ever edits you. There is nobody else to edit — everyone
   answers for themselves through the link. */
var draft=null, draftSetup=false;
function openSheet(setup){
  var p=meRow();
  if(!p) return;
  draftSetup=!!setup;
  draft={id:p.id,tz:p.tz,s:p.s,e:p.e,wknd:p.wknd,
         sl:p.sl==null?23:p.sl,sw:p.sw==null?7:p.sw};
  $("#sheetTitle").textContent=setup?"Your day":"My hours";
  $("#sheetCancel").style.visibility=setup?"hidden":"";
  $("#sheetDone").textContent=setup?"Save":"Done";
  $("#sheetLede").textContent=setup
    ? "Answer this once. Every meeting after this one starts with it already filled in."
    : "Yours alone. Everyone else answers for themselves through the link.";
  $("#citySearch").value="";
  renderDraft(); renderCities("");
  $("#scrim").classList.add("on"); $("#sheet").classList.add("on");
  document.body.style.overflow="hidden";
}
function closeSheet(){
  if(draftSetup) return;                 /* the one sheet you cannot walk past */
  $("#scrim").classList.remove("on"); $("#sheet").classList.remove("on");
  document.body.style.overflow=""; draft=null;
}
function commitDraft(){
  if(!draft) return;
  var p=byId(draft.id);
  if(!p){ draftSetup=false; closeSheet(); return; }
  p.tz=draft.tz; p.s=draft.s; p.e=draft.e; p.wknd=draft.wknd;
  p.sl=draft.sl; p.sw=draft.sw;
  var wasSetup=draftSetup;
  draftSetup=false;
  closeSheet();
  if(!LIVE){ afterChange(); return; }
  saveProfile(p).then(function(){ return syncPerson(p); })
    .then(function(){ afterChange(); if(wasSetup) haptic(); })
    .catch(function(e){ toast(e.message); afterChange(); });
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
    return pname(p)+": "+fmtT(t,p.tz)+d+"  ·  "+tzCity(p.tz);
  });
}
function inviteText(){
  var t=sel(), tz=dispTz();
  return meetingTitle()+"\n"+fmtLongDate(t,tz)+" · "+fmtDur(S.dur)+"\n\n"+localLines().join("\n");
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

  if((el=up("data-guest"))){
    var gid=el.getAttribute("data-guest"), at=S.nogo.indexOf(gid);
    if(at>=0) S.nogo.splice(at,1); else S.nogo.push(gid);
    afterChange(); haptic(); return;
  }
  if((el=up("data-fold"))){
    var sec=$("#"+el.getAttribute("data-fold"));
    sec.classList.toggle("open"); renderPeople(); haptic(); return;
  }
  if((el=up("data-dur"))){
    var d=el.getAttribute("data-dur")==="+"?DUR_STEP:-DUR_STEP;
    S.dur=Math.max(DUR_MIN,Math.min(DUR_MAX,S.dur+d));
    afterChange(); renameMeeting(); haptic(); return;
  }
  if((el=up("data-pick"))){
    S.pick=+el.getAttribute("data-pick");
    var di=dayIndex(S.pick); if(di>=0) S.day=di;
    renderDock(); save(); haptic();
    renderDays(); renderWTB();
    return;
  }
  if((el=up("data-share"))){ openShare(); return; }
  if((el=up("data-meetings"))){ openMeetings(); return; }
  if((el=up("data-peeps"))){ openPeep(); return; }
  if((el=up("data-sharecopy"))){ copyText(shareUrl(),"Meeting link copied"); return; }
  if((el=up("data-bookcopy"))){
    copyText(bookUrl(ME.profile.handle),"Booking link copied"); return;
  }
  if((el=up("data-handle"))){
    var now=(ME&&ME.profile&&ME.profile.handle)||"";
    var want=prompt("Your booking link: letters, numbers and dashes.\n\n"+
      location.origin+basePath()+"/book/#", now);
    if(want===null) return;
    cx("meet.setHandle",{token:token(),handle:want})
      .then(function(r){
        if(ME&&ME.profile) ME.profile.handle=r.handle;
        renderBook(); haptic(); toast("Your link is ready");
      })
      .catch(function(e){ toast(e.message); });
    return;
  }
  if((el=up("data-peep"))){ inviteContact(el.getAttribute("data-peep")); return; }
  if((el=up("data-hours"))){ openSheet(false); return; }
  if((el=up("data-gcal"))){
    var who=meRow();
    if(!who) return;
    toast("Asking Google…");
    syncCalendar(who).then(function(){ renderGcalCard(); })
      .catch(function(e){ toast(e.message); });
    return;
  }
  if((el=up("data-pickmeet"))){ switchMeeting(el.getAttribute("data-pickmeet")); closeMeetings(); return; }
  if((el=up("data-newmeet"))){
    closeMeetings();
    startFresh();
    $("#meetSec").classList.add("open");
    $("#titleInput").focus();
    return;
  }
  if((el=up("data-leavemeet"))){
    if(!confirm("Leave “"+(S.title.trim()||"this meeting")+"”?")) return;
    var gone=S.mid;
    closeMeetings();
    cx("meet.leave",{token:token(),meetingId:gone}).then(function(){
      S.mid=""; S.pick=null; STARTING=false; save(); return refreshMe();
    }).then(function(){ afterChange(); toast("Left"); })
      .catch(function(e){ toast(e.message); });
    return;
  }
  if((el=up("data-signout"))){
    var tk=token();
    setToken(""); ME=null; MEET=null;
    try{ localStorage.removeItem(KEY); }catch(e){}
    if(LIVE) location.replace(basePath()+"/login/");
    if(LIVE&&tk) cx("auth.signOut",{token:tk}).catch(function(){});
    return;
  }
  if((el=up("data-want"))){
    var w=el.getAttribute("data-want"), at2=S.wants.indexOf(w);
    if(at2>=0) S.wants.splice(at2,1); else S.wants.push(w);
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
$("#meetClose").addEventListener("click",closeMeetings);
$("#peepClose").addEventListener("click",closePeep);
$("#shareClose").addEventListener("click",closeShare);

$("#shareTop").addEventListener("click",function(){ openShare(); });
$("#hoursBtn").addEventListener("click",function(){ openSheet(false); });
$("#createBtn").addEventListener("click",function(){
  if(LIVE && !signedIn()) return location.assign(basePath()+"/login/");
  if(LIVE && !ready()) return openSheet(true);
  if(!S.title.trim()) return toast("Name the meeting first");
  var g=$("#createBtn"), was=g.textContent;
  g.disabled=true; g.textContent="…";
  createMeeting().catch(function(e){ toast(e.message); })
    .then(function(){ g.disabled=false; g.textContent=was; renderCreate(); renderSteps(); });
});
$("#fbSend").addEventListener("click",function(){ sendFeedback(false); });
$("#fbClose").addEventListener("click",closeFeedback);
$("#fbAgain").addEventListener("click",function(){
  $("#fbThanks").style.display="none"; $("#fbForm").style.display="";
});
$("#sheetCancel").addEventListener("click",closeSheet);
$("#sheetDone").addEventListener("click",commitDraft);
$("#scrim").addEventListener("click",function(){
  closeSheet(); closeMeetings(); closeShare(); closePeep(); closeFeedback();
});
$("#citySearch").addEventListener("input",function(){ renderCities(this.value); });
var titleT;
$("#titleInput").addEventListener("input",function(){
  S.title=this.value; save();
  renderRail(); renderCreate(); renderSteps(); renderDock();
  clearTimeout(titleT); titleT=setTimeout(renameMeeting,600);
});
$("#winPrev").addEventListener("click",function(){ S.offsetDays=Math.max(0,S.offsetDays-7); S.day=0; afterChange(); });
$("#winNext").addEventListener("click",function(){ S.offsetDays+=7; S.day=0; afterChange(); });

/* The one button. What it does is whatever the dock says it does. */
$("#primary").addEventListener("click",function(){
  if(LIVE && !signedIn()) return location.assign(basePath()+"/login/");
  if(LIVE && !ready()) return openSheet(true);
  if(LIVE && !inMeeting()) return toast("Create the meeting in step 1 first");
  if(guests().length<2) return toast("Nobody has answered yet");
  if(!sel()) return toast("Pick an hour on the calendar first");
  bookMeeting(sel());
  window.open(gcalUrl(),"_blank","noopener");
  haptic();
  if(alreadyAsked()) return toast("Google Calendar opened. Press Save.");
  setTimeout(function(){ openFeedback(true); },260);
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
  S.pick=ts; save(); markColumn(); renderDock(); haptic();
}
/* pointerdown paints (edit mode only) — picking waits for a real click, so a
   sideways swipe scrolls the strip instead of booking an hour */
$("#wtb").addEventListener("pointerdown",function(ev){
  if(!editing) return;
  var el=ev.target.closest?ev.target.closest(".hc"):null;
  if(!el) return;
  var pid=el.getAttribute("data-p");
  if(!pid) return;
  var me=meRow();                         /* only ever your own row */
  if(!me || pid!==me.id) return;
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
  save(); renderDock();
  if(who) syncPerson(who);
});
$("#editToggle").addEventListener("click",function(){
  editing=!editing; renderWTB(); haptic();
  $("#editToggle").textContent=editing?"Done":"Edit hours";
  toast(editing?"Drag along your own row to cross out hours":"");
});

var rzT;
window.addEventListener("resize",function(){
  clearTimeout(rzT);
  rzT=setTimeout(function(){
    renderAll();
  },120);
});
window.addEventListener("scroll",function(){
  $("#nav").classList.toggle("scrolled",window.scrollY>4);
},{passive:true});

/* ═══════════════ boot ═══════════════
   Signed in or nowhere. The only thing a signed-out browser can do is
   follow a link to the login page and come back — which is what makes a
   share link worth sending: whoever opens it lands in the same meeting.

   Without a backend configured there is nothing to sign in to, so the app
   runs against this browser alone. That is the workbench, not the product.
   ═══════════════════════════════════════ */
var joinCode=(location.hash.match(/^#j=([A-Za-z0-9_-]+)/)||[])[1]||"";
if(joinCode) history.replaceState(null,"",location.pathname);

if(LIVE && !token()){
  location.replace(basePath()+"/login/?next="+
    encodeURIComponent(location.pathname+(joinCode?"#j="+joinCode:"")));
}

if(!load()) freshState();
if(sel()!==null){ var _d=dayIndex(sel()); if(_d>=0) S.day=_d; }
if(window.innerWidth>=900){
  $("#peopleSec").classList.add("open");
  $("#meetSec").classList.add("open");
}
renderAll();
if(isNextPage()) requestAnimationFrame(function(){ openFeedback(false); });

if(LIVE){
  refreshMe().then(function(){
    if(!ME && token()){        /* the session died while we were away */
      setToken("");
      location.replace(basePath()+"/login/?next="+encodeURIComponent(location.pathname));
      return null;
    }
    flushFeedback();
    if(!ME) return null;
    /* a share link: walk in, then carry on as if you had always been here */
    if(joinCode){
      var code=joinCode; joinCode="";
      return joinMeeting(code).then(function(){
        toast("You are in. " + (MEET?MEET.title:"the meeting"));
      },function(e){ toast(e.message); });
    }
    return null;
  }).then(function(){
    afterChange();
    /* The one thing everybody has to do once, asked at the only moment it
       makes sense: the first time they are actually here. */
    if(signedIn() && !ready()) openSheet(true);
  });
}
/* keep the clocks honest without a heartbeat the phone has to pay for */
document.addEventListener("visibilitychange",function(){
  if(!document.hidden) renderPeople();
});
setInterval(function(){ if(!document.hidden) renderPeople(); },60000);

})();
