// ---------------------------------------------------------------------------
// The database handle.
//
// Lazily created, because Next evaluates module code at build time and the
// connection string is not there yet on a first deploy. A plain function
// rather than a Proxy: a Proxy breaks libraries that inspect the client.
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof create>;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

let handle: Db | null = null;

export function getDb(): Db {
  if (!handle) handle = create();
  return handle;
}

export { schema };
