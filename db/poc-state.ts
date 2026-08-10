import { env } from "cloudflare:workers";

const CREATE_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS poc_states (
    id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

function database() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function ensurePocStateTable() {
  await database().prepare(CREATE_STATE_TABLE).run();
}

export async function readPocState(id: string) {
  await ensurePocStateTable();
  return database()
    .prepare("SELECT payload, updated_at AS updatedAt FROM poc_states WHERE id = ?")
    .bind(id)
    .first<{ payload: string; updatedAt: string }>();
}

export async function writePocState(id: string, payload: string) {
  await ensurePocStateTable();
  await database()
    .prepare(`
      INSERT INTO poc_states (id, payload, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(id, payload)
    .run();
}

export async function deletePocState(id: string) {
  await ensurePocStateTable();
  await database().prepare("DELETE FROM poc_states WHERE id = ?").bind(id).run();
}
