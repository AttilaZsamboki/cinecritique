import { NextRequest, NextResponse } from "next/server";
import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { mode, title, year, imdbId } = body as {
      mode?: "title" | "imdb";
      title?: string;
      year?: number | null;
      imdbId?: string;
    };

    const ctx = await createTRPCContext({ headers: req.headers });
    const trpc = createCaller(ctx);

    let result: any;
    if (mode === "imdb") {
      if (!imdbId) return NextResponse.json({ error: "imdbId is required" }, { status: 400 });
      result = await trpc.movie.importFromOmdbByImdbId({ imdbId });
    } else {
      if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
      result = await trpc.movie.importFromOmdbByTitle({ title, year: year ?? undefined });
    }

    return NextResponse.json({ movie: result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
