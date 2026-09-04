import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/* Founder City: every tower reads its RevenueCat numbers once a day. */
const crons = cronJobs();
crons.daily("founder city refresh", { hourUTC: 4, minuteUTC: 0 }, internal.city.refreshAll, {});
export default crons;
