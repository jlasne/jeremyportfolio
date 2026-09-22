import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/* Founder City: every tower reads its RevenueCat numbers once a day. */
const crons = cronJobs();
crons.daily("founder city refresh", { hourUTC: 4, minuteUTC: 0 }, internal.city.refreshAll, {});

/* x.jeremylasne.com: three mails a day at 10:00, 14:00 and 17:00 Paris.
   The schedule is hourly because Paris moves twice a year and Convex runs
   on UTC; `x.tick` looks at the Paris clock and returns immediately on the
   twenty-one hours that are not a slot. */
crons.hourly("x content manager", { minuteUTC: 0 }, internal.x.tick, {});
export default crons;
