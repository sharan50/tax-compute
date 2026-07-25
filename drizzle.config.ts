import { defineConfig } from "drizzle-kit";

// `generate` only diffs the schema against existing migration snapshots and
// never opens a DB connection, so DATABASE_URL must stay optional here.
// Commands that do connect (e.g. `migrate`) will fail naturally without it.
const connectionString = process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
