# Astro-Guard

Astro-Guard is a NASA Space Apps Challenge research and anatomy visualization web app that keeps challenge data, visual assets, and software-generated displays clearly separated.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/astro-guard/` — Astro-Guard React/Vite web app
- `artifacts/astro-guard/src/data/researchStatus.ts` — source status, qualitative challenge context, and anatomy model provenance used by the UI
- `artifacts/astro-guard/resources/resource_inventory.md` — official resource inventory and visual asset attribution
- `artifacts/astro-guard/NASA_DATA_ANALYSIS.md` — dataset availability and scientific data limitations
- `artifacts/astro-guard/PROJECT_ARCHITECTURE.md` — routes, implementation approach, and data-integrity rules

## Architecture decisions

- The application is frontend-only until official challenge data or a real server-side requirement exists.
- NASA HRP pages provide qualitative risk context, but the app has no connected astronaut telemetry dataset or sensor feed.
- Synthetic readings and scripted alert drills for all five displayed systems are permitted only when clearly labeled as simulation; never present them as NASA or live sensor data. Demo alerts must never classify manual check-in entries.
- The optional manual check-in accepts raw user-entered measurements only. Keep entries in page memory; never transmit or persist them, and do not label them as NASA or sensor data.
- Do not invent clinical thresholds, diagnoses, risk scores, treatment advice, or emergency instructions. General prevention education is allowed only when source-cited and clearly not driven by entered values. Personalized assessment requires a mission-approved medical protocol.
- A same-person comparison of manually entered readings may describe numerical differences only when records are recent, self-reported as comparable, and measurement quality is stated. Do not infer causes, health status, safety, or treatment from these descriptive trends; keep all entries in page memory only.
- The anatomy model is a third-party educational visual asset, not NASA data or a clinical tool.

## Product

The app has two main screens: a short space-themed landing page and an interactive anatomy dashboard. The user approved the animated cartoon astronaut instead of Earth. It starts dancing automatically; each click/tap advances one move, and that move repeats until the next click. Do not show an Earth switch, movement-options bar, or Pause buttons on either screen. Preserve the simple Start-to-dashboard flow; source and demo-status details should remain secondary to the 3D exploration.

## User preferences

- Follow the user's latest scope over earlier product directions: concise landing page, then one interactive 3D dashboard.
- Keep NASA HRP context distinct from third-party anatomy assets, clearly labeled synthetic readings, and user-entered check-in values.

## Gotchas

- The challenge Resources tab showed only a “Resources will be available on Friday, November 13” notice when reviewed on November 13, 2026. Recheck it before adding datasets.
- The selected Écorché GLB is meshopt-compressed and only includes skeleton and muscle meshes; skin and internal organs are not in the asset.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
