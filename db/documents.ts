import { env } from "cloudflare:workers";

const CREATE_DOCUMENT_TABLE = `
  CREATE TABLE IF NOT EXISTS poc_documents (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    object_key TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

export interface StoredDocumentRow {
  id: string;
  workspaceId: string;
  objectKey: string;
  name: string;
  category: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

function database() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export function documentBucket() {
  if (!env.DOCUMENTS) throw new Error("R2 binding DOCUMENTS is unavailable");
  return env.DOCUMENTS;
}

export async function ensureDocumentTable() {
  await database().prepare(CREATE_DOCUMENT_TABLE).run();
}

export async function writeDocument(row: Omit<StoredDocumentRow, "uploadedAt">) {
  await ensureDocumentTable();
  await database().prepare(`
    INSERT INTO poc_documents (id, workspace_id, object_key, name, category, content_type, size)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(row.id, row.workspaceId, row.objectKey, row.name, row.category, row.contentType, row.size).run();
}

export async function readDocument(id: string) {
  await ensureDocumentTable();
  return database().prepare(`
    SELECT id, workspace_id AS workspaceId, object_key AS objectKey, name, category,
      content_type AS contentType, size, created_at AS uploadedAt
    FROM poc_documents WHERE id = ?
  `).bind(id).first<StoredDocumentRow>();
}

export async function deleteDocument(id: string) {
  const row = await readDocument(id);
  if (!row) return false;
  await documentBucket().delete(row.objectKey);
  await database().prepare("DELETE FROM poc_documents WHERE id = ?").bind(id).run();
  return true;
}

export async function deleteWorkspaceDocuments(workspaceId: string) {
  await ensureDocumentTable();
  const rows = await database().prepare("SELECT object_key AS objectKey FROM poc_documents WHERE workspace_id = ?").bind(workspaceId).all?.<{ objectKey: string }>();
  if (rows?.results) await Promise.all(rows.results.map((row) => documentBucket().delete(row.objectKey)));
  await database().prepare("DELETE FROM poc_documents WHERE workspace_id = ?").bind(workspaceId).run();
}
