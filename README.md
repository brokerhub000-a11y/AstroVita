# AstroVita

An astronaut health-monitoring visualization created for the NASA Space Apps
Challenge. The web app includes an animated astronaut landing page and an
interactive 3D health dashboard.

## Run locally

Use Node.js 24 and pnpm 10 from the repository root:

```bash
pnpm install
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/astro-guard run dev
```

Then open `http://localhost:5173`. For project details and data limitations, see
[`artifacts/astro-guard/README.md`](artifacts/astro-guard/README.md).

## Deploy to Railway

The repository's `.railway/railway.ts` defines one Railway web service sourced
from `brokerhub000-a11y/AstroVita`. The current UI uses local demo/check-in state
and does not depend on the workspace API server.

After connecting the GitHub repository to Railway and installing the Railway
CLI, run these commands from the repository root:

```bash
railway config plan
railway config apply
```

Review the plan before applying it. Railway then builds the Vite app and serves
the static output on its assigned port, including client-side routes such as
`/dashboard`.
