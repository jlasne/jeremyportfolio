/* ═══════════════════════════════════════════════════════════
   Overlap — the door.

   One way through it: Google. The page never sees a secret — it
   receives an ID token, hands it to Convex, and Convex asks Google
   whether the token is real and who it was minted for.

   It ends with a session token in local storage and a redirect to
   wherever you were headed, share link and all.
   ═══════════════════════════════════════════════════════════ */
(function(){
"use strict";

var CONVEX=(window.OVERLAP_CONVEX_URL||"").replace(/\/+$/,"");
var LIVE=/^https?:\/\//.test(CONVEX);
var GID=window.OVERLAP_GOOGLE_CLIENT_ID||"";
var TOKKEY="overlap.token";

function $(s){ return document.querySelector(s); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function base(){ return location.pathname.replace(/\/login\/?$/,"").replace(/\/$/,""); }

/* next= carries the whole destination, hash included, so a share link
   survives the round trip through Google. */
function nextUrl(){
  var m=location.search.match(/[?&]next=([^&]*)/);
  var n=m?decodeURIComponent(m[1]):"";
  return (/^\/[^/]/.test(n)?n:base()+"/team/");
}
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
function say(msg,bad){
  var n=$("#note");
  n.textContent=msg||"";
  n.className="note"+(bad?" bad":"");
}
function land(r){
  try{ localStorage.setItem(TOKKEY,r.token); }catch(e){}
  location.replace(nextUrl());
}

/* ── already signed in? straight through ── */
try{ if(LIVE && localStorage.getItem(TOKKEY)) location.replace(nextUrl()); }catch(e){}

/* Somebody followed a share link. Say what they are walking into before
   asking them to sign in for it. */
var joining=(nextUrl().match(/#j=([A-Za-z0-9_-]+)/)||[])[1]||"";
if(LIVE && joining){
  cx("meet.peek",{invite:joining}).then(function(m){
    if(!m) return;
    $(".lede").textContent="“"+m.title+"” — "+
      (m.count===1?"one person so far":m.count+" people so far")+
      ". Sign in and your hours land on their calendar.";
  }).catch(function(){});
}

if(!LIVE){
  $("#ways").innerHTML='<p class="note">No backend is connected yet, so there is '+
    'nothing to sign in to.</p><a class="btn" href="'+esc(base())+'/team/">Open Overlap anyway</a>';
} else if(!GID){
  $("#ways").innerHTML='<p class="note">Google sign-in is not configured yet — '+
    'set a client ID in <code>config.js</code>. See overlap/README.md.</p>';
} else {
  var sc=document.createElement("script");
  sc.src="https://accounts.google.com/gsi/client";
  sc.async=true; sc.defer=true;
  sc.onload=function(){
    try{
      google.accounts.id.initialize({
        client_id:GID,
        callback:function(resp){
          say("Signing you in…");
          cx("auth.google",{credential:resp.credential}).then(land)
            .catch(function(e){ say(e.message,true); });
        }
      });
      google.accounts.id.renderButton($("#gbtn"),
        {theme:"outline",size:"large",shape:"pill",text:"continue_with",width:320});
    }catch(e){ say("Google sign-in could not start",true); }
  };
  sc.onerror=function(){ say("Google sign-in could not load",true); };
  document.head.appendChild(sc);
}
})();
