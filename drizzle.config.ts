import { defineConfig } from "drizzle-kit";

// `pnpm db:generate` writes a new migration into drizzle/ from the schema.
// Applied migrations are never edited; the app runs pending ones at startup.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/server/db/schema.ts",
  out: "./drizzle",
});
