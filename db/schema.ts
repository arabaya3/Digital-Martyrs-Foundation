import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pocStates = sqliteTable("poc_states", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const pocDocuments = sqliteTable("poc_documents", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  objectKey: text("object_key").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
