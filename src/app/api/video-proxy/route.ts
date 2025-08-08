import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });
  try {
    const upstream = await fetch(url, {
      headers: {
        // Attempt to bypass CORS and allow range requests for video
        // Some hosts require a user-agent
        "User-Agent": "Mozilla/5.0 (compatible; cinecritique/1.0)",
      },
    });
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const res = new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600",
        // Pass through partial content headers if present
        ...(upstream.headers.get("accept-ranges") ? { "accept-ranges": upstream.headers.get("accept-ranges")! } : {}),
        ...(upstream.headers.get("content-range") ? { "content-range": upstream.headers.get("content-range")! } : {}),
      },
    });
    return res;
  } catch {
    return new Response("Failed to fetch video", { status: 502 });
  }
}


