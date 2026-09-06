# Private academy construction build

The website navigation opens `/academy/phase-one/`. This section reads the current course, journeys, lessons, and introductions from Supabase on each page load. Welcome media is retrieved again on opening. No curriculum text is bundled into source control. Existing display components are reused without copying curriculum wording.

The Node server protects every website file and API route with one construction credential. Username: `academy`. Set a randomly generated password of at least 24 characters in `ACA_CONSTRUCTION_PASSWORD`. Use HTTPS at the hosting reverse proxy. The server must not be exposed directly over HTTP. Do not deploy `private-dist` to a public static file host: doing so bypasses the server protection.

Server environment also requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ACA_PHASE_ONE_COURSE_ID`. The service key stays exclusively on the server. The read-only API is restricted to that course and its attached media; it exposes no accounts, enrollments, progress, or arbitrary storage paths. This construction access is not a paid-learner authorization model.

Build: `npm run build:academy`. Start: `npm run start:academy`. Verify: `npm run test:academy`.

Activation requires a Node-capable HTTPS host, securely configured environment, and the official domain routed to that host. Confirm anonymous requests receive 401 for the homepage, Phase One page, assets, and curriculum API before switching the domain. Keep the current website in place until the replacement is verified. GitHub Pages cannot run this server.
