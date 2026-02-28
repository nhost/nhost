import { type NextRequest, NextResponse } from 'next/server';
import { createNhostClient } from '../../../../lib/nhost/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const nhost = await createNhostClient();
    const { fileId } = await params;
    const fileName = request.nextUrl.searchParams.get('fileName') || 'file';
    const download = request.nextUrl.searchParams.get('download') === 'true';

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 },
      );
    }

    const response = await nhost.storage.getFile(fileId);

    if (!response.body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get the file content as an array buffer
    const arrayBuffer = await response.body.arrayBuffer();

    // Determine content disposition based on download parameter
    const contentDisposition = download
      ? `attachment; filename="${fileName}"`
      : `inline; filename="${fileName}"`;

    // Create the response with appropriate headers
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.body.type || 'application/octet-stream',
        'Content-Disposition': contentDisposition,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control':
          response.headers.get('Cache-Control') ||
          'public, max-age=31536000, immutable',
        Etag: response.headers.get('ETag') || '',
        'Last-Modified': response.headers.get('Last-Modified') || '',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: `Failed to access file: ${message}` },
      { status: 500 },
    );
  }
}
