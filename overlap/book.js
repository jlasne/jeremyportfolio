/* ═══════════════════════════════════════════════════════════
   Overlap — somebody else's free hours.

   One screen: whose calendar this is, the hours they have left,
   and a button. You see the hours before anybody asks who you
   are; signing in happens when you take one, because the hour
   has to land in a calendar with your name on it.

   The clock maths comes from tz.js, the same copy the app uses.
   ═══════════════════════════════════════════════════════════ */
(function(){
"use strict";

var CONVEX=(window.OVERLAP_CONVEX_URL||"").replace(/\/+$/,"");
var LIVE=/^https?:\/\//.test(CONVEX);
var TOKKEY="overlap.token", HOLDKEY="overlap.hold";
var SLOT=30;                       /* offer half hours */

function $(s){ return document.querySelector(s); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function base(){ return location.pathname.replace(/\/book\/?$/,"").replace(/\/$/,""); }
function token(){ try{ return localStorage.getItem(TOKKEY)||""; }catch(e){ return ""; } }

function cx(op,args){
  var ctl=window.AbortController?new AbortController():null;
  var timer=setTimeout(function(){ if(ctl) ctl.abort(); },15000);
  return fetch(CONVEX+"/overlap",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({op:op,args:args||{}}),
    signal:ctl?ctl.signal:undefined
  }).then(function(r){ return r.json(); }).then(function(j){
    clearTimeout(timer);
    if(j&&j.ok) return j.value;
    throw new Error((j&&j.error)||"Something went wrong");
  },function(e){
    clearTimeout(timer);
    throw new Error(e&&e.name==="AbortError"?"The server did not answer":"Can’t reach the server");
  });
}

var handle=(location.hash||"").replace(/^#\/?/,"").trim().toLowerCase();
var HOST=null, PICK=null, MINS=30;

/* ── whether an instant is one they could actually take ──
   Their working day, minus their night, minus what their calendar already
   holds, minus what somebody else has booked, minus the notice they asked
   for. Same rules the app draws, asked one instant at a time. */
function freeAt(ts){
  var h=HOST, end=ts+MINS*60000;
  if(ts < Date.now()+h.minNoticeMin*60000) return false;
  if(ts > Date.now()+h.windowDays*86400000) return false;

  var p=zp(ts,h.tz), mins=p.H*60+p.M, d=dow(ts,h.tz);
  if(!h.weekends && (d===0||d===6)) return false;
  if(mins < h.startHour*60 || mins+MINS > h.endHour*60) return false;

  /* asleep, which can wrap midnight */
  var sl=h.sleepStart*60, sw=h.sleepEnd*60;
  var asleep = sl>sw ? (mins>=sl||mins<sw) : (mins>=sl&&mins<sw);
  if(asleep) return false;

  var i, step=60*60000;
  for(i=0;i<h.busy.length;i++)
    if(ts < h.busy[i]+step && end > h.busy[i]) return false;

  var buf=h.bufferMin*60000;
  for(i=0;i<h.taken.length;i++){
    var a=h.taken[i].at-buf, z=h.taken[i].at+h.taken[i].mins*60000+buf;
    if(ts < z && end > a) return false;
  }
  return true;
}
/* every free half hour in their window, grouped by their day */
function days(){
  var out=[], n, j, ts, p, list;
  var start=todayStart(HOST.tz);
  for(n=0;n<HOST.windowDays;n++){
    p=zp(start+n*86400000+3600000*4,HOST.tz);   /* midday-ish, dodges DST */
    list=[];
    for(j=0;j<48;j++){
      ts=wall(p.y,p.m,p.d,0,j*SLOT,HOST.tz);
      if(freeAt(ts)) list.push(ts);
    }
    if(list.length) out.push({y:p.y,m:p.m,d:p.d,at:list});
    if(out.length>=10) break;
  }
  return out;
}
function todayStart(tz){ var p=zp(Date.now(),tz); return wall(p.y,p.m,p.d,0,0,tz); }

function render(){
  var d=days(), mine=LOCAL_TZ;
  $("#who").textContent=HOST.name;
  $("#lede").textContent="Pick an hour. Times are shown on your clock in "+
    tzCity(mine)+", and land on theirs in "+tzCity(HOST.tz)+".";
  $("#durs").innerHTML=[15,30,45,60].map(function(m){
    return '<button class="chip'+(MINS===m?" on":"")+'" data-min="'+m+'">'+m+"′</button>";
  }).join("");

  if(!d.length){
    $("#slots").innerHTML='<div class="empty"><b>Nothing free.</b>'+
      "No open hour in the next "+HOST.windowDays+" days. Try a shorter meeting.</div>";
    return;
  }
  $("#slots").innerHTML=d.map(function(day){
    var first=day.at[0];
    return '<div class="day"><h3>'+esc(fmtLongDate(first,mine))+"</h3><div class=\"times\">"+
      day.at.map(function(ts){
        return '<button class="slot'+(PICK===ts?" on":"")+'" data-at="'+ts+'">'+
               esc(fmtT(ts,mine))+"</button>";
      }).join("")+"</div></div>";
  }).join("");
}

function renderDock(){
  var b=$("#go"), h=$("#note");
  if(!PICK){ b.disabled=true; b.textContent="Pick an hour"; h.textContent=""; return; }
  b.disabled=false;
  b.textContent=token()?"Book this hour":"Sign in and book";
  var k=dayKey(PICK,HOST.tz)-dayKey(PICK,LOCAL_TZ);
  h.textContent=fmtLongDate(PICK,LOCAL_TZ)+", "+fmtT(PICK,LOCAL_TZ)+" your time · "+
    fmtT(PICK,HOST.tz)+(k?(k>0?" next day":" previous day"):"")+" for "+HOST.name;
}

/* Somebody who is not signed in still gets to choose first. The choice is
   kept here, they go to the door, and it is waiting when they come back. */
function holdPick(){
  try{ localStorage.setItem(HOLDKEY,JSON.stringify({h:handle,at:PICK,m:MINS})); }catch(e){}
}
function takeHold(){
  try{
    var o=JSON.parse(localStorage.getItem(HOLDKEY)||"null");
    localStorage.removeItem(HOLDKEY);
    if(o&&o.h===handle&&o.at) return o;
  }catch(e){}
  return null;
}

function gcalUrl(r){
  function stamp(ts){
    var x=new Date(ts), p=function(n){ return n<10?"0"+n:""+n; };
    return x.getUTCFullYear()+p(x.getUTCMonth()+1)+p(x.getUTCDate())+"T"+
           p(x.getUTCHours())+p(x.getUTCMinutes())+"00Z";
  }
  return "https://calendar.google.com/calendar/render?action=TEMPLATE"+
    "&text="+encodeURIComponent(r.title)+
    "&dates="+stamp(r.startsAt)+"/"+stamp(r.startsAt+r.durationMin*60000)+
    "&add="+encodeURIComponent(r.host.email)+
    "&details="+encodeURIComponent("Booked with Overlap.");
}

function book(){
  if(!PICK) return;
  if(!token()){
    holdPick();
    location.assign(base()+"/login/?next="+
      encodeURIComponent(location.pathname+"#"+handle));
    return;
  }
  var b=$("#go");
  b.disabled=true; b.textContent="…";
  cx("meet.bookWith",{token:token(),handle:handle,startsAt:PICK,
                      durationMin:MINS,tz:LOCAL_TZ})
    .then(function(r){
      $("#pane").innerHTML='<div class="done"><h2>Booked.</h2>'+
        "<p>"+esc(fmtLongDate(r.startsAt,LOCAL_TZ))+", "+esc(fmtT(r.startsAt,LOCAL_TZ))+
        " with "+esc(r.host.name)+".</p>"+
        '<a class="btn" id="add" href="'+esc(gcalUrl(r))+'" target="_blank" rel="noopener">'+
        "Add it to your calendar</a>"+
        "<p class=\"fine\">They are on the invitation, so pressing Save tells them too.</p>"+
        '<a class="back" href="'+esc(base())+'/team/">Your meetings</a></div>';
      window.open(gcalUrl(r),"_blank","noopener");
    })
    .catch(function(e){
      b.disabled=false; b.textContent="Book this hour";
      $("#note").textContent=e.message;
      /* somebody beat them to it, so redraw with that hour gone */
      if(/took that hour|too soon|too far/i.test(e.message)) start();
    });
}

function start(){
  return cx("meet.host",{handle:handle}).then(function(h){
    if(!h){
      $("#pane").innerHTML='<div class="done"><h2>No such link.</h2>'+
        "<p>That booking link does not belong to anybody.</p></div>";
      return;
    }
    HOST=h;
    document.title=h.name+" · Overlap";
    var held=takeHold();
    if(held && held.at>Date.now()){ PICK=held.at; MINS=held.m||30; }
    render(); renderDock();
    if(held && PICK && token()) book();
  }).catch(function(e){
    $("#note").textContent=e.message;
  });
}

/* ── wiring ── */
document.addEventListener("click",function(ev){
  var el=ev.target.closest?ev.target.closest("[data-at],[data-min]"):null;
  if(!el) return;
  if(el.hasAttribute("data-min")){ MINS=+el.getAttribute("data-min"); PICK=null; }
  else PICK=+el.getAttribute("data-at");
  render(); renderDock();
});
$("#go").addEventListener("click",book);

if(!LIVE){
  $("#pane").innerHTML='<div class="done"><h2>No backend.</h2>'+
    "<p>Booking links need a server to ask.</p></div>";
} else if(!handle){
  $("#pane").innerHTML='<div class="done"><h2>Which link?</h2>'+
    "<p>A booking link looks like <code>/overlap/book/#jeremy</code>.</p></div>";
} else start();
})();
