import { deleteDocument, documentBucket, readDocument } from "@/db/documents";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const metadata = await readDocument(id);
  if (!metadata) return Response.json({ error: "Document not found" }, { status: 404 });
  const object = await documentBucket().get(metadata.objectKey);
  if (!object) return Response.json({ error: "Stored file not found" }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": metadata.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return Response.json({ deleted: await deleteDocument(id) });
}
