import { $ } from "bun";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run db:push.");
  process.exit(1);
}

const projectRoot = new URL("../", import.meta.url).pathname;

try {
  await $`./node_modules/drizzle-kit/bin.cjs generate`.cwd(projectRoot);
} catch (error) {
  console.error("Failed to generate Drizzle migration files.");
  throw error;
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: "require",
});

try {
  await migrate(drizzle(sql), {
    migrationsFolder: `${projectRoot}drizzle`,
  });
  console.log("Drizzle schema push completed via generate + migrate.");
} finally {
  await sql.end({ timeout: 1 });
}
