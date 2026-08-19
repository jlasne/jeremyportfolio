/* Connect the backend by pasting your Convex HTTP Actions URL here.
   It is the .convex.site host (not .convex.cloud) — `npx convex dev` prints it.

     window.OVERLAP_CONVEX_URL = "https://tidy-otter-123.convex.site";

   Left empty, Overlap runs entirely in the browser: no accounts, no shared
   teams, and feedback is queued locally until a backend appears. */
window.OVERLAP_CONVEX_URL = "https://amicable-chickadee-753.eu-west-1.convex.site";

/* Sign in with Google. Create an OAuth client at
   https://console.cloud.google.com/apis/credentials → Create credentials →
   OAuth client ID → Web application, add your site to Authorized JavaScript
   origins (https://jeremylasne.com and http://localhost:8000 for local work),
   then paste the client ID below AND set OVERLAP_GOOGLE_CLIENT_ID to the same
   value in the Convex dashboard.

   Left empty, the login page falls back to a six-digit code by email. */
window.OVERLAP_GOOGLE_CLIENT_ID = "";
