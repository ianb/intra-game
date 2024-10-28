import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    );
  }

  const targetUrl = `${process.env.ASSET_URL}/${encodeURIComponent(url)}`;

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Create a Headers object to set caching and content-type headers
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    // Convert the response data to a Buffer
    const buffer = await response.arrayBuffer();

    // Return the response with custom headers and the buffered data
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error fetching asset:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset" },
      { status: 500 }
    );
  }
}
