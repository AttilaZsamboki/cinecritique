import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { criteria, criteriaPreset, criteriaPresetWeight } from "~/server/db/schema";

// List presets with weights count
export async function GET() {
  const presets = await db.select().from(criteriaPreset);
  const weights = await db.select().from(criteriaPresetWeight);
  const byPreset = new Map<string, number>();
  for (const w of weights) {
    byPreset.set(w.presetId??"", (byPreset.get(w.presetId??"") || 0) + 1);
  }
  return NextResponse.json({
    presets: presets.map((p) => ({ ...p, weightsCount: byPreset.get(p.id) || 0 })),
  });
}

// Create a new preset from current criteria weights
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = (body?.name as string) || "Preset";
  const description = (body?.description as string) || null;

  const inserted = await db.insert(criteriaPreset).values({ name, description: description as any }).returning({ id: criteriaPreset.id });
  const presetId = inserted[0]?.id;

  const crits = await db.select().from(criteria);
  if (crits.length) {
    await db.insert(criteriaPresetWeight).values(
      crits.map((c) => ({ presetId, criteriaId: c.id, weight: c.weight ?? 0 }))
    );
  }

  return NextResponse.json({ id: presetId });
}
