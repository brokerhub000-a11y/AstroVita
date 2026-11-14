import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const web = service("AstroVita Web", {
    source: github("brokerhub000-a11y/AstroVita", { branch: "main" }),
    build: "PORT=3000 BASE_PATH=/ pnpm --filter @workspace/astro-guard run build",
    start: "pnpm --filter @workspace/astro-guard start",
    healthcheck: "/",
    env: {
      NODE_ENV: "production",
    },
  });

  return project("AstroVita", {
    resources: [web],
  });
});
