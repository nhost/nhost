import { createNhostClient } from "../../../../lib/nhost/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const nhost = await createNhostClient();
    const { fileId } = await params;
    const fileName = request.nextUrl.searchParams.get("fileName") || "view";

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    const response = await nhost.storage.getFile(fileId);

    if (!response.body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get the file content as an array buffer
    const arrayBuffer = await response.body.arrayBuffer();

    // Create the response with proper headers for inline viewing
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": response.body.type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": arrayBuffer.byteLength.toString(),
        // Add cache headers for better performance
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: `Failed to view file: ${message}` },
      { status: 500 }
    );
  }
}