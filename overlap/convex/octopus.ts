/**
 * A small client for the Octopus MCP server, so Write can read the founder's
 * brains at the moment it writes.
 *
 * This file holds plain functions and no Convex functions, so it can be tested
 * in isolation. It speaks MCP over HTTP: initialize, tell the server it is
 * initialised, then call the `ask` tool. The server's address carries its own
 * signature, so one setting, OCTOPUS_MCP_URL, is all it needs. That address is
 * a secret: it lives in the Convex dashboard and never in the repository.
 *
 * Nothing here throws. Octopus being slow, down or misconfigured must never
 * stop a day from being written, so every failure comes back as an `error`
 * string and the posts are written without notes.
 */

const PROTOCOL = "2025-03-26";

type Rpc = { jsonrpc: "2.0"; id?: number; method: string; params?: unknown };

/** A reply is either plain JSON or a stream of events. Find the message with this id. */
function readMessage(text: string, type: string, id: number): any {
  const pick = (m: any) => (Array.isArray(m) ? m.find((x) => x?.id === id) : m?.id === id ? m : undefined);
  if (type.includes("text/event-stream")) {
    for (const event of text.split(/\r?\n\r?\n/)) {
      const data = event
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!data) continue;
      try {
        const hit = pick(JSON.parse(data));
        if (hit) return hit;
      } catch {
        /* a keep-alive or a partial line */
      }
    }
    return undefined;
  }
  try {
    return pick(JSON.parse(text));
  } catch {
    return undefined;
  }
}

async function send(url: string, body: Rpc, session: string | undefined, timeoutMs: number) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(session ? { "Mcp-Session-Id": session } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 202) throw new Error(`Octopus said ${res.status}`);
    const sid = res.headers.get("mcp-session-id") ?? session;
    const text = await res.text();
    if (body.id == null) return { sid, message: undefined };
    const message = readMessage(text, res.headers.get("content-type") ?? "", body.id);
    if (!message) throw new Error("Octopus sent no answer to that call");
    if (message.error) throw new Error(String(message.error.message ?? "Octopus refused the call").slice(0, 200));
    return { sid, message };
  } finally {
    clearTimeout(timer);
  }
}

/** Open a session, run the calls, and hand back what each returned as text. */
async function session(url: string, timeoutMs: number, calls: { name: string; args: Record<string, unknown> }[]) {
  let id = 1;
  const init = await send(
    url,
    {
      jsonrpc: "2.0",
      id: id++,
      method: "initialize",
      params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "x.jeremylasne.com", version: "1" } },
    },
    undefined,
    timeoutMs,
  );
  await send(url, { jsonrpc: "2.0", method: "notifications/initialized" }, init.sid, timeoutMs);
  const out: string[] = [];
  for (const c of calls) {
    const r = await send(
      url,
      { jsonrpc: "2.0", id: id++, method: "tools/call", params: { name: c.name, arguments: c.args } },
      init.sid,
      timeoutMs,
    );
    const parts = r.message?.result?.content;
    out.push(Array.isArray(parts) ? parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("\n") : "");
  }
  return out;
}

/**
 * What `ask` returns is a retrieval, followed by rules for writing an answer to
 * a person. Only the retrieval is wanted here. Take each concept's title, its
 * position and its newest piece of dated evidence, and leave the rest, so the
 * model gets advice to use and no instructions to obey.
 */
export function parseNotes(text: string, maxChars = 3800): string[] {
  const start = text.indexOf("WHAT THE BRAINS HOLD");
  if (start < 0) return [];
  let body = text.slice(start).replace(/^[^\n]*\n/, "");
  const stop = body.search(/\n(?:ALSO HELD|={3,}[^\n]*HOW TO WRITE)/);
  if (stop >= 0) body = body.slice(0, stop);

  const lines: string[] = [];
  let used = 0;
  for (const block of body.split(/\n-{3,}\n/)) {
    const title = block.match(/^\s*#\s+(.+)$/m)?.[1]?.trim();
    const position = block.match(/POSITION\s*\n([\s\S]*?)(?:\n\s*\n|$)/)?.[1]?.replace(/\s+/g, " ").trim();
    if (!title || !position) continue;
    const proof = block.match(/EVIDENCE[^\n]*\n\s*-\s*([^\n]+)/)?.[1]?.trim();
    const line = `- ${title}: ${position.slice(0, 420)}${proof ? ` [${proof.slice(0, 160)}]` : ""}`;
    if (used + line.length > maxChars) break;
    lines.push(line);
    used += line.length;
  }
  return lines;
}

const QUESTION =
  "What makes a strong X post? Hooks, clear writing, specific details, story, volume, audience, replies.";
const TERMS = ["hook", "writing", "posts", "specific", "story", "audience", "volume", "clarity"];

/** Read the brains. Never throws. */
export async function octopusNotes(opts: {
  url: string;
  brains?: string[];
  timeoutMs?: number;
}): Promise<{ notes: string; count: number; error?: string }> {
  const brains = opts.brains?.length ? opts.brains : ["x", "content"];
  try {
    const texts = await session(
      opts.url,
      opts.timeoutMs ?? 20_000,
      brains.map((brain) => ({ name: "ask", args: { question: QUESTION, brain, terms: TERMS } })),
    );
    const seen = new Set<string>();
    const lines = texts
      .flatMap((t) => parseNotes(t))
      .filter((l) => {
        const key = l.split(":")[0];
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
    if (!lines.length) return { notes: "", count: 0, error: "Octopus answered, but it held nothing on writing for X" };
    return { notes: lines.join("\n"), count: lines.length };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      notes: "",
      count: 0,
      error: aborted ? "Octopus did not answer in time" : e instanceof Error ? e.message : String(e),
    };
  }
}
