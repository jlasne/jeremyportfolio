/* Connect the backend by pasting your Convex HTTP Actions URL here.
   It is the .convex.site host (not .convex.cloud) — `npx convex dev` prints it.

     window.OVERLAP_CONVEX_URL = "https://tidy-otter-123.convex.site";

   Left empty, Overlap runs entirely in the browser: no accounts, no shared
   teams, and feedback is queued locally until a backend appears. */
window.OVERLAP_CONVEX_URL = "https://fiery-eel-944.eu-west-1.convex.site";

/* Sign in with Google. Create an OAuth client at
   https://console.cloud.google.com/apis/credentials → Create credentials →
   OAuth client ID → Web application, add your site to Authorized JavaScript
   origins (https://jeremylasne.com and http://localhost:8000 for local work),
   then paste the client ID below AND set OVERLAP_GOOGLE_CLIENT_ID to the same
   value in the Convex dashboard.

   Left empty, the login page falls back to a six-digit code by email. */
window.OVERLAP_GOOGLE_CLIENT_ID = "431005215419-uc7v7t0cehr2etha1tar00qm2ujf7fhj.apps.googleusercontent.com";

/* Read Outlook and Microsoft 365 busy times. Register an app at
   https://portal.azure.com → Microsoft Entra ID → App registrations → New,
   pick "Accounts in any organizational directory and personal Microsoft
   accounts", and add a redirect URI of type Single-page application (SPA)
   pointing at https://your-site/overlap/msauth/ — plus
   http://localhost:8000/overlap/msauth/ for local work. Under API
   permissions add the delegated Microsoft Graph permission Calendars.Read.
   Paste the Application (client) ID below.

   Left empty, the Outlook row simply is not drawn and Google is the only
   calendar Overlap can read. Nothing else changes. */
window.OVERLAP_MS_CLIENT_ID = "";
