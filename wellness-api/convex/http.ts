import { httpRouter } from "convex/server";
import { httpAction, type ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * One endpoint for /wellness and /wellness/exp0.
 *
 * The client is a static HTML page on another origin, so it cannot use the
 * websocket client and needs CORS. Rather than open up Convex's generic
 * /api/* surface, everything goes through this door: {op, args} in,
 * {ok, value} out, with an explicit allow-list of operations.
 *
 * Lives at https://<deployment>.convex.site/overlap
 */

/* One origin, or several separated by commas: a request from an origin on
   the list gets its own origin back, so www and the bare domain can both
   use the door. Unset means anyone. */
const ALLOW = (process.env.OVERLAP_ALLOW_ORIGIN ?? "*").split(",").map((s) => s.trim()).filter(Boolean);
const allowFor = (origin: string | null) =>
  ALLOW.includes("*") ? "*" : origin && ALLOW.includes(origin) ? origin : ALLOW[0];

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOW[0],
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
  const res = await answer(ctx, request);
  res.headers.set("Access-Control-Allow-Origin", allowFor(request.headers.get("Origin")));
  return res;
});

async function answer(ctx: ActionCtx, request: Request): Promise<Response> {
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
      case "bio.get":
        return ok(await ctx.runQuery(api.bio.get, args));
      case "bio.unlock":
        return ok(await ctx.runQuery(api.bio.unlock, args));
      case "bio.save":
        return ok(await ctx.runMutation(api.bio.save, args));
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
}

const http = httpRouter();
http.route({ path: "/overlap", method: "POST", handler: door });
http.route({
  path: "/overlap",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const h = headers();
    h["Access-Control-Allow-Origin"] = allowFor(request.headers.get("Origin"));
    return new Response(null, { status: 204, headers: h });
  }),
});

export default http;
