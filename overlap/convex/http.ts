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
      case "meet.book":
        return ok(await ctx.runMutation(api.meet.book, args));
      case "feedback.send":
        return ok(await ctx.runMutation(api.feedback.send, args));
      default:
        return bad("Unknown operation");
    }
  } catch (e) {
    /* thrown messages are written to be read by a person, so pass them on */
    return bad(e instanceof Error ? e.message : "Something went wrong");
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
