/* ═══════════════════════════════════════════════════════════
   Overlap — the door.

   Google if a client ID is configured, a six-digit code by email
   otherwise. Either way it ends with a session token in local
   storage and a redirect to wherever you were headed.
   ═══════════════════════════════════════════════════════════ */
(function(){
"use strict";

var CONVEX=(window.OVERLAP_CONVEX_URL||"").replace(/\/+$/,"");
var LIVE=/^https?:\/\//.test(CONVEX);
var GID=window.OVERLAP_GOOGLE_CLIENT_ID||"";
var TOKKEY="overlap.token", GUESTKEY="overlap.guest";

function $(s){ return document.querySelector(s); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function base(){ return location.pathname.replace(/\/login\/?$/,"").replace(/\/$/,""); }
function nextUrl(){
  var m=location.search.match(/[?&]next=([^&]+)/);
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
  try{
    localStorage.setItem(TOKKEY,r.token);
    localStorage.removeItem(GUESTKEY);     /* no longer a guest */
  }catch(e){}
  location.replace(nextUrl());
}
/* A look round without an account. Everything works, it just lives in this
   browser — no shared teams, nothing that follows you to another device. */
function asGuest(){
  try{ localStorage.setItem(GUESTKEY,"1"); }catch(e){}
  location.replace(nextUrl());
}

/* ── already signed in? straight through ── */
try{ if(LIVE && localStorage.getItem(TOKKEY)) location.replace(nextUrl()); }catch(e){}

if(!LIVE){
  $("#ways").innerHTML='<p class="note">No backend is connected yet, so there is '+
    'nothing to sign in to — Overlap still works without an account.</p>'+
    '<a class="btn" href="'+esc(base())+'/team/">Continue as guest</a>';
  $("#guestwrap").style.display="none";
} else {
  /* ── Google ── */
  if(GID){
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
  } else {
    $("#gwrap").style.display="none";
    $("#or").style.display="none";
  }

  /* ── email code ── */
  var stage=0, mail="";
  function step(){
    var btn=$("#go");
    if(stage===0){
      mail=$("#email").value.trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return say("That email looks off",true);
      btn.disabled=true; btn.textContent="…";
      cx("auth.requestCode",{email:mail}).then(function(r){
        stage=1; btn.disabled=false; btn.textContent="Sign in";
        $("#codewrap").style.display="";
        $("#email").disabled=true;
        say(r&&r.devCode?("Dev mode — your code is "+r.devCode)
                        :("A six-digit code is on its way to "+mail+"."));
        $("#code").focus();
      }).catch(function(e){ btn.disabled=false; btn.textContent="Continue"; say(e.message,true); });
      return;
    }
    var code=$("#code").value.trim();
    if(code.length<6) return say("Six digits",true);
    btn.disabled=true; btn.textContent="…";
    cx("auth.verify",{email:mail,code:code}).then(land)
      .catch(function(e){ btn.disabled=false; btn.textContent="Sign in"; say(e.message,true); });
  }
  $("#go").addEventListener("click",step);
  $("#loginForm").addEventListener("submit",function(ev){ ev.preventDefault(); step(); });
  $("#guest").addEventListener("click",function(ev){ ev.preventDefault(); asGuest(); });
}
})();
