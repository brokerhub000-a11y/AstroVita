import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const web = service("AstroVita Web", {
    source: github("brokerhub000-a11y/AstroVita", { branch: "main" }),
    build: "pnpm run build",
    start: "pnpm start",
    healthcheck: "/",
    env: {
      NODE_ENV: "production",
    },
  });

  return project("AstroVita", {
    resources: [web],
  });
});
