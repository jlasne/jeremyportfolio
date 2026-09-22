# Tests

Three files, no framework, plain `node:assert`.

| file | what it proves |
| --- | --- |
| `units.mjs` | Templates refuse an unfilled placeholder. The model's answer is refused when it names an option nobody offered. The daily counter survives a restart. |
| `loop.mjs` | A real Chrome reads a page as a list, clicks, types character by character, and an empty box confirms a send. |
| `run.mjs` | A dry run drafts and never sends. A send moves the lead to contacted. The cap stops the run before the browser opens. |

`loop.mjs` and `run.mjs` launch Chrome and stub both OpenRouter and the
brandmatch API on localhost. Nothing reaches Instagram, OpenRouter or Convex.

    npm test

Set `CHROME_PATH` if the Chrome that Playwright ships with is not installed.
