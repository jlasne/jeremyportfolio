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
var HOST=null, PICK=null, MINS=30, SCROLLED=false;

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
/* The week as rows of days and columns of half hours, which is the shape
   the app already uses. White is an hour you can take, ink is one you
   cannot, and the column you picked is ruled off. */
var DAYS_SHOWN=7, COLS=48;
function todayStart(tz){ var p=zp(Date.now(),tz); return wall(p.y,p.m,p.d,0,0,tz); }
function dayStarts(tz){
  var out=[], base=todayStart(tz), n;
  for(n=0;n<DAYS_SHOWN;n++) out.push(base+n*86400000);
  return out;
}
function sizeGrid(rows){
  var wrap=document.querySelector(".wtb");
  if(!wrap) return;
  var avail=Math.max(240,window.innerHeight-wrap.getBoundingClientRect().top-150);
  var row=Math.max(34,Math.min(64,(avail-26)/rows));
  wrap.style.setProperty("--wruler","26px");
  wrap.style.setProperty("--wrow",Math.round(row)+"px");
  wrap.style.setProperty("--cw","30px");
  wrap.style.setProperty("--lab","94px");
}
function render(){
  var tz=LOCAL_TZ, days=dayStarts(tz), i, n, any=false;
  $("#who").textContent=HOST.name;
  $("#lede").textContent=HOST.isYou
    ? "This is your own booking link. This is what a client sees when you send it."
    : (tzCity(tz)===tzCity(HOST.tz)
        ? "Pick an hour. You are both on the same clock."
        : "Pick an hour. Shown on your clock in "+tzCity(tz)+
          ", and it lands on theirs in "+tzCity(HOST.tz)+".");
  $("#durs").innerHTML=[15,30,45,60].map(function(m){
    return '<button class="chip'+(MINS===m?" on":"")+'" data-min="'+m+'">'+m+"′</button>";
  }).join("");

  var g=$("#wtb"), labs=$("#wtbLabs"), html="", lhtml="";
  sizeGrid(DAYS_SHOWN);
  var rows="var(--wruler) repeat("+DAYS_SHOWN+",var(--wrow))";
  g.style.gridTemplateColumns="repeat("+COLS+",minmax(var(--cw),1fr))";
  g.style.gridTemplateRows=rows;
  labs.style.gridTemplateRows=rows;

  /* the ruler, on the reader's own clock */
  lhtml+='<div class="rlab head"><b>'+esc(tzCity(tz))+"</b></div>";
  var z0=zp(days[0],tz);
  for(i=0;i<COLS;i++){
    var h=Math.floor(i/2);
    html+='<div class="tick'+(h%6===0&&i%2===0?" q":"")+'">'+
          (i%4===0?fmtHourShort(h):"")+"</div>";
  }

  /* one row per day */
  for(n=0;n<DAYS_SHOWN;n++){
    var z=zp(days[n],tz);
    lhtml+='<div class="rlab"><b>'+esc(WD[dow(days[n],tz)])+" "+z.d+"</b>"+
           "<span><em>"+esc(MO[z.m-1])+"</em></span></div>";
    var free=[];
    for(i=0;i<COLS;i++){
      var ts=wall(z.y,z.m,z.d,0,i*30,tz);
      free.push({ts:ts,ok:freeAt(ts)});
      if(free[i].ok) any=true;
    }
    for(i=0;i<COLS;i++){
      var c=free[i], cls=c.ok?"":"busy";
      if(!c.ok){
        if(i===0||free[i-1].ok) cls+=" s";
        if(i===COLS-1||free[i+1].ok) cls+=" e";
      }
      if(PICK===c.ts) cls+=" pick";
      html+='<div class="hc'+(cls?" "+cls:"")+'"'+
            (c.ok?' data-at="'+c.ts+'"':"")+"></div>";
    }
  }
  labs.innerHTML=lhtml;
  g.innerHTML=html;
  $("#none").style.display=any?"none":"";

  /* Their night is the first thing on the left, and nobody scrolls past a
     wall of ink to find out there were hours. Start where the hours are. */
  if(!SCROLLED) requestAnimationFrame(function(){
    var cell=g.querySelector('.hc[data-at]'), sc=$("#wtbScroll");
    if(!cell||!sc) return;
    sc.scrollLeft=Math.max(0,cell.offsetLeft-sc.clientWidth*0.2);
    SCROLLED=true;
  });
}
function renderDock(){
  var b=$("#go"), h=$("#note");
  if(HOST&&HOST.isYou){
    b.disabled=true; b.textContent="Your own link";
    h.textContent="Send it to somebody else and they can take one of these.";
    return;
  }
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
  if(!PICK||(HOST&&HOST.isYou)) return;
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
  return cx("meet.host",{handle:handle,token:token()||undefined}).then(function(h){
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
  if(el.hasAttribute("data-min")){ MINS=+el.getAttribute("data-min"); PICK=null; SCROLLED=false; }
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
