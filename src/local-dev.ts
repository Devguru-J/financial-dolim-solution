import { app } from "@/app";

const port = Number(process.env.PORT || 8788);

const server = Bun.serve({
  port,
  fetch(request: Request) {
    return app.fetch(request, {
      APP_ENV: process.env.APP_ENV ?? "development",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      CF_PAGES: "1",
      CF_PAGES_BRANCH: "local",
      CF_PAGES_COMMIT_SHA: "local",
      CF_PAGES_URL: `http://127.0.0.1:${port}`,
    } as Env);
  },
});

console.log(`Local Bun server ready on http://127.0.0.1:${server.port}`);
