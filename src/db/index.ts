import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const url = import.meta.env.TURSO_DATABASE_URL;
if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is not set. Copy .env.example to .env and fill it in (see README).",
  );
}

const client = createClient({
  url,
  authToken: import.meta.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
