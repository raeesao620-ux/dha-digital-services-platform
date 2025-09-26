
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not found, using default PostgreSQL connection");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/dha_database",
  },
});
