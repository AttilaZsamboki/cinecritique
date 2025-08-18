import { NextRequest, NextResponse } from "next/server";
import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { mode, title, year, tmdbId } = body as {
      mode?: "title" | "tmdb";
      title?: string;
      year?: number | null;
      tmdbId?: string;
    };

    const ctx = await createTRPCContext({ headers: req.headers });
    const trpc = createCaller(ctx);

    let result: any;
    if (mode === "tmdb") {
      if (!tmdbId) return NextResponse.json({ error: "tmdbId is required" }, { status: 400 });
      result = await trpc.movie.importFromTmdbByTmdbId({ tmdbId });
    } else {
      if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
      result = await trpc.movie.importFromTmdbByTitle({ title, year: year ?? undefined });
    }

    return NextResponse.json({ movie: result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
