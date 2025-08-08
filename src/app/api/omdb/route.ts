import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";

type OmdbResponse = {
  Error?: string;
  Response: "True" | "False";
  Title?: string;
  Year?: string;
  Poster?: string;
};

export async function GET(req: NextRequest) {
  if (!env.OMDB_API_KEY) {
    return NextResponse.json({ error: "OMDb API key missing" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const title = searchParams.get("t");
  const year = searchParams.get("y");
  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("t", title);
  if (year) url.searchParams.set("y", year);
  url.searchParams.set("apikey", env.OMDB_API_KEY);

  const res = await fetch(url.toString());
  const data = (await res.json()) as unknown as OmdbResponse;
  if (data.Error) return NextResponse.json({ error: data.Error }, { status: 400 });
  if (data.Response === "False") return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  return NextResponse.json(data);
}


