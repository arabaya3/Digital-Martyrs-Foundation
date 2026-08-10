import { documentBucket, writeDocument } from "@/db/documents";

const MAX_FILE_BYTES = 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function workspaceId(request: Request) {
  return new URL(request.url).searchParams.get("workspace")?.trim() || "primary";
}

function safeFileName(value: string) {
  return value.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180) || "document";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const category = String(form.get("category") || "general").slice(0, 80);
    if (!(file instanceof File)) return Response.json({ error: "file is required" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "Only PDF, JPG and PNG files are accepted" }, { status: 415 });
    if (file.size > MAX_FILE_BYTES) return Response.json({ error: "File exceeds the 1 MB POC limit" }, { status: 413 });

    const id = crypto.randomUUID();
    const name = safeFileName(file.name);
    const uploadedAt = new Date().toISOString();
    const objectKey = `${workspaceId(request)}/${id}/${name}`;
    await documentBucket().put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: name, category },
    });
    await writeDocument({ id, workspaceId: workspaceId(request), objectKey, name, category, contentType: file.type, size: file.size });
    return Response.json({ document: { id, name, category, contentType: file.type, size: file.size, uploadedAt } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Document upload failed" }, { status: 500 });
  }
}
