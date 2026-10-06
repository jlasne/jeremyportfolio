import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/* Founder City: every tower reads its RevenueCat numbers once a day. */
const crons = cronJobs();
crons.daily("founder city refresh", { hourUTC: 4, minuteUTC: 0 }, internal.city.refreshAll, {});

/* x.jeremylasne.com: writes the day at 17:00 Paris and reads the unread days
   into the brain at 23:00. No mail. The schedule is hourly because Paris moves
   twice a year and Convex runs on UTC; `x.tick` looks at the Paris clock and
   returns at once on the hours that are not one of those two. */
crons.hourly("x content manager", { minuteUTC: 0 }, internal.x.tick, {});
export default crons;
