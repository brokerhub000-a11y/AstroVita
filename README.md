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

The root `package.json` provides the build and start scripts that Railway's
Railpack detects when deploying this GitHub repository. Keep the service's root
directory at the repository root.

In Railway, connect `brokerhub000-a11y/AstroVita` and deploy branch `main`.
The commands can be left on automatic detection, or set explicitly:

- Build command: `pnpm run build`
- Start command: `pnpm start`
- Healthcheck path: `/`

The build script sets the Vite build-time base path and port. At runtime, the
static server listens on Railway's assigned `PORT`, including client-side routes
such as `/dashboard`. No application secrets or database are needed for the
current local demo/check-in UI. The unused workspace API server is not deployed.

After deployment succeeds, generate a public domain in the service's networking
settings to expose the website.

The optional `.railway/railway.ts` describes the same service for Railway CLI
users. It is not automatically applied by connecting the GitHub repository:
authenticate and link the CLI to the intended project, then run
`railway config plan` and review the changes before `railway config apply`.

For the original all-package build, use `pnpm run build:workspace` with the
environment variables required by those packages.
