# AstroVita

A two-screen astronaut-health visualization for the NASA Space Apps Challenge “Create Health Monitoring Software for Astronauts on Space Missions.”

## Run

In the Replit workspace, run from the workspace root:

```bash
pnpm --filter @workspace/astro-guard run dev
```

For local development, install workspace dependencies first, then provide the Vite variables normally supplied by Replit:

```bash
pnpm install
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/astro-guard run dev
```

Open `http://localhost:5173`. Node.js 24 and pnpm are used by this workspace.
An internet connection is needed to download the anatomy models on first load.
The app is also served through its managed Replit web workflow. For a static check, run:

```bash
pnpm --filter @workspace/astro-guard run typecheck
```

## Railway deployment

The root `package.json` exposes `build` and `start` for Railway auto-detection.
The current UI uses local demo/check-in state and does not call the workspace API
server, so Railway only needs to run the web service.

Connect `brokerhub000-a11y/AstroVita` to Railway with the service root at the
repository root. Automatic command detection is supported; the equivalent
commands are:

```bash
pnpm run build
pnpm start
```

The service builds the Vite app and serves the generated files with Node on
Railway's assigned `PORT`. The build uses `/` as the site base path and supports
the `/dashboard` client-side route. `.railway/railway.ts` is an optional CLI
configuration, not a file applied automatically by GitHub-based deployment.

## Experience

- `/` — short introduction with the animated astronaut
- `/dashboard` — interactive translucent 3D anatomy and selected-system panel
- Legacy research routes redirect to the two-screen experience.

## Data status

The official challenge page now links NASA HRP hazard, risk, and research information. No challenge-specific astronaut telemetry dataset or sensor feed was exposed in the reviewed resources. Per the user's direction, the dashboard keeps its clearly marked demo scenarios and offers an optional manual check-in. Check-in values stay in page memory and are not sent or saved. Selected-system panels include general NASA-cited prevention context that is not based on a reading; there are no NASA readings, connected sensor data, clinical thresholds, or diagnoses. See `NASA_DATA_ANALYSIS.md` and `resources/resource_inventory.md`.

## Anatomy asset

The view uses separately sourced BodyParts3D-derived skin/organ meshes and the Écorché skeleton. These are educational visual assets, not NASA data or clinical tools. Full attribution and license information are in `resources/resource_inventory.md`.
