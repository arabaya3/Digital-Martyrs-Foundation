import { deletePocState, readPocState, writePocState } from "@/db/poc-state";
import { deleteWorkspaceDocuments } from "@/db/documents";

const MAX_STATE_BYTES = 2_000_000;

function workspaceId(request: Request) {
  return new URL(request.url).searchParams.get("workspace")?.trim() || "primary";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected persistence error";
}

export async function GET(request: Request) {
  try {
    const row = await readPocState(workspaceId(request));
    if (!row) return Response.json({ state: null, updatedAt: null });
    return Response.json({ state: JSON.parse(row.payload), updatedAt: row.updatedAt });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { state?: unknown };
    if (!body.state || typeof body.state !== "object") {
      return Response.json({ error: "state object is required" }, { status: 400 });
    }
    const payload = JSON.stringify(body.state);
    if (new TextEncoder().encode(payload).byteLength > MAX_STATE_BYTES) {
      return Response.json({ error: "state payload is too large" }, { status: 413 });
    }
    await writePocState(workspaceId(request), payload);
    return Response.json({ saved: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const workspace = workspaceId(request);
    await Promise.all([deletePocState(workspace), deleteWorkspaceDocuments(workspace)]);
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
