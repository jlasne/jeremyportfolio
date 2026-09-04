import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * One endpoint for the whole app.
 *
 * The client is a static HTML page on another origin, so it cannot use the
 * websocket client and needs CORS. Rather than open up Convex's generic
 * /api/* surface, everything goes through this door: {op, args} in,
 * {ok, value} out, with an explicit allow-list of operations.
 *
 * Lives at https://<deployment>.convex.site/overlap
 */

const ALLOW = process.env.OVERLAP_ALLOW_ORIGIN ?? "*";

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOW,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
const ok = (value: unknown) =>
  new Response(JSON.stringify({ ok: true, value: value ?? null }), { headers: headers() });
/**
 * The sentence a person should read, out of whatever the runtime threw.
 *
 * An argument validation failure is the one case we must not pass on: Convex
 * echoes the whole argument object back, and the arguments contain the
 * caller's session token. That has to stay off the screen and out of any
 * screenshot, so it is answered with a sentence and nothing else. It only
 * ever means one thing anyway: the page is newer than the deployment.
 */
function clean(msg: string): string {
  if (/ArgumentValidationError|not in the validator/i.test(msg))
    return "This page is newer than the server. Reload, and deploy if it persists.";
  const first = msg.split("\n")[0].trim();
  const said = first.replace(/^(Uncaught\s+)?[A-Za-z]*Error:\s*/, "").trim();
  if (/\btoken\b\s*[:=]/i.test(said)) return "Something went wrong";
  return said || "Something went wrong";
}
const bad = (error: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, error }), { status, headers: headers() });

const door = httpAction(async (ctx, request) => {
  let body: { op?: string; args?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return bad("Malformed request");
  }
  const op = body.op ?? "";
  const args = (body.args ?? {}) as any;

  try {
    switch (op) {
      case "me":
        return ok(await ctx.runQuery(api.meet.me, args));
      case "auth.google":
        return ok(await ctx.runAction(api.auth.google, args));
      case "auth.signOut":
        return ok(await ctx.runMutation(api.auth.signOut, args));
      case "meet.profile":
        return ok(await ctx.runMutation(api.meet.profile, args));
      case "meet.create":
        return ok(await ctx.runMutation(api.meet.create, args));
      case "meet.peek":
        return ok(await ctx.runQuery(api.meet.peek, args));
      case "meet.join":
        return ok(await ctx.runMutation(api.meet.join, args));
      case "meet.hours":
        return ok(await ctx.runMutation(api.meet.hours, args));
      case "meet.rename":
        return ok(await ctx.runMutation(api.meet.rename, args));
      case "meet.leave":
        return ok(await ctx.runMutation(api.meet.leave, args));
      case "meet.setHandle":
        return ok(await ctx.runMutation(api.meet.setHandle, args));
      case "meet.limits":
        return ok(await ctx.runMutation(api.meet.limits, args));
      case "meet.host":
        return ok(await ctx.runQuery(api.meet.host, args));
      case "meet.bookWith":
        return ok(await ctx.runMutation(api.meet.bookWith, args));
      case "meet.book":
        return ok(await ctx.runMutation(api.meet.book, args));
      case "feedback.send":
        return ok(await ctx.runMutation(api.feedback.send, args));
      case "city.towers":
        return ok(await ctx.runQuery(api.city.towers, args));
      case "city.breakGround":
        return ok(await ctx.runMutation(api.city.breakGround, args));
      default:
        return bad("Unknown operation");
    }
  } catch (e) {
    /* Thrown messages are written to be read by a person, so pass them on.
       Convex wraps them first: "Uncaught Error: Sign in first\n at mustBe
       (../convex/meet.ts:34:9)". The person is owed the first line of that
       and nothing else, and the internet is owed no file paths at all. */
    return bad(e instanceof Error ? clean(e.message) : "Something went wrong");
  }
});

const http = httpRouter();
http.route({ path: "/overlap", method: "POST", handler: door });
http.route({
  path: "/overlap",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: headers() })),
});

export default http;
