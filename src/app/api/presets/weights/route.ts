import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { criteria, criteriaPreset, criteriaPresetWeight } from "~/server/db/schema";
import { inArray, eq } from "drizzle-orm";

// GET /api/presets/weights?ids=<id1,id2,...>
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids") || "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: "ids query param is required" }, { status: 400 });

  const presets = await db.select().from(criteriaPreset).where(inArray(criteriaPreset.id, ids as string[]));
  if (!presets.length) return NextResponse.json({ error: "No presets found" }, { status: 404 });

  const weights = await db.select().from(criteriaPresetWeight).where(inArray(criteriaPresetWeight.presetId, ids as string[]));
  const allCriteria = await db.select().from(criteria);
  const byCriteria = new Map(allCriteria.map((c) => [c.id, c] as const));

  const grouped: Record<string, any> = Object.fromEntries(
    presets.map((p) => [p.id, { id: p.id, name: p.name, description: p.description, weights: [] as any[] }])
  );

  for (const w of weights) {
    const c = w.criteriaId ? byCriteria.get(w.criteriaId) : undefined;
    if (!w.presetId) continue;
    grouped[w.presetId].weights.push({
      criteriaId: w.criteriaId,
      weight: w.weight,
      criteriaName: c?.name ?? null,
      parentId: c?.parentId ?? null,
    });
  }

  return NextResponse.json({ presets: Object.values(grouped) });
}
