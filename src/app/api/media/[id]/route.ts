import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  return NextResponse.json({ error: message }, { status: 500 });
}

// PATCH: rename / set alt text.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 200);
    if (typeof body.altText === "string") data.altText = body.altText.trim().slice(0, 300) || null;

    const asset = await prisma.mediaAsset.update({ where: { id }, data });
    return NextResponse.json({ asset });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: remove from the library and from R2. Uploader or super admin only.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.role !== "super_admin" && asset.createdBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Best-effort object removal — the record goes either way, so a storage
    // hiccup can't leave an entry pointing at a file the user thinks is gone.
    let storageError: string | undefined;
    try {
      const r2 = await prisma.r2Config.findFirst({ where: { isActive: true } });
      if (r2) {
        const s3 = new S3Client({
          region: "auto",
          endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
        });
        await s3.send(new DeleteObjectCommand({ Bucket: r2.bucketName, Key: asset.key }));
      }
    } catch (e) {
      storageError = e instanceof Error ? e.message : "Could not delete the stored file";
    }

    await prisma.mediaAsset.delete({ where: { id } });
    return NextResponse.json({ success: true, storageError });
  } catch (error) {
    return handleError(error);
  }
}
