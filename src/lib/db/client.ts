import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

export type AppDatabase = PostgresJsDatabase<typeof schema>;

export function createDbClient(databaseUrl: string): {
  db: AppDatabase;
  dispose: () => Promise<void>;
} {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
  });

  return {
    db: drizzle(sql, { schema }),
    dispose: async () => {
      await sql.end();
    },
  };
}
