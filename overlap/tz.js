/* ═══════════════════════════════════════════════════════════════════
   Clocks and cities, shared.

   Two pages need the same answer to "what time is that there": the app
   and the booking page. One copy, inlined into both by build.py, because
   a scheduler whose two screens disagree about an hour is worse than one
   that only has a single screen.

   These are plain top-level declarations on purpose: both pages call them
   by bare name from inside their own closures.
   ═══════════════════════════════════════════════════════════════════ */
var LOCAL_TZ=(function(){
  try{ return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"; }catch(e){ return "UTC"; }
})();

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
var DUR_MIN=15, DUR_MAX=480, DUR_STEP=15;
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
function fmtDur(m){
  if(m<60) return m+" min";
  var h=Math.floor(m/60), r=m%60;
  return h+"h"+(r?" "+r+"m":"");
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
