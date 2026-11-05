import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./legacy/data/drizzle",
  schema: "./legacy/data/db/schema.ts",
  dialect: "sqlite",
});
