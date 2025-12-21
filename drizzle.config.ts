import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_DATABASE!,
  },
});

export const db = drizzle(process.env.POSTGRES_DATABASE!, { schema });
