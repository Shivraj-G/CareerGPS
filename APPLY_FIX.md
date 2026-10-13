# CareerGPS Profile Render + Email Fix

This is a focused patch for the current CareerGPS project version. It contains only the files needed to fix the Profile React crash and the blank account email.

## Root causes fixed

1. `GoalFeasibilityDashboard` rendered `routes[selectedRouteIdx].cost` directly. The backend's `cleanSuggestedRoutes()` normalizes route cost to an object shaped like `{ estimate: "..." }`; React cannot render a plain object as a child. The dashboard now formats structured cost/timeline values into readable text, and uses `route.time.route_endpoint` / `route.time.next_milestone` from the current API contract.
2. `ProfilePage.jsx` consumed `useAuth` from `frontend/src/contexts/AuthContext.jsx`, but the app in `frontend/src/main.jsx` was wrapped by a different, locally defined `AuthContext`. Consequently, ProfilePage received the default context (`user: null`, no-op `refreshUser`) rather than the logged-in identity. The `Profile` wrapper now passes the actual `user` and `refreshUser` from the app's provider as props. ProfilePage uses those props, so the locked email field and post-save refresh use the real authenticated user context.

## Apply

1. Back up your current project folder.
2. Extract this ZIP into the root of your existing `CareerGPS` project (the folder containing `frontend`). Allow the five files to be replaced.
3. In a terminal, run:

   ```powershell
   cd frontend
   npm test
   npm run dev
   ```

4. Open `http://localhost:5173/profile`, refresh the page, and inspect the console. Expand the Candidate Pathways section to verify route cost displays as text without a React child error. Confirm the authenticated email is populated in both the profile summary and locked Email Address field.

## Verification performed here

- Frontend tests: 26 passed, 0 failed.
- JSX syntax parsing: `main.jsx`, `ProfilePage.jsx`, and `GoalFeasibilityDashboard.jsx` passed.
- Vite production build: not run because dependency installation (`npm ci`) timed out in this environment. Run `npm run build` locally after dependencies are available.

No backend, database, AI service, or environment file is changed by this patch.
