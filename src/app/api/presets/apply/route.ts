import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { criteria, criteriaPreset, criteriaPresetWeight } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const presetId = (body?.presetId as string) || "";
  if (!presetId) return NextResponse.json({ error: "presetId is required" }, { status: 400 });

  // ensure preset exists
  const preset = await db.select().from(criteriaPreset).where(eq(criteriaPreset.id, presetId));
  if (!preset.length) return NextResponse.json({ error: "Preset not found" }, { status: 404 });

  // load weights
  const weights = await db.select().from(criteriaPresetWeight).where(eq(criteriaPresetWeight.presetId, presetId));
  if (!weights.length) return NextResponse.json({ error: "Preset has no weights" }, { status: 400 });

  // Apply: update criteria.weight for each row we have in preset
  for (const w of weights) {
    if (!w.criteriaId) continue;
    await db.update(criteria).set({ weight: w.weight }).where(eq(criteria.id, w.criteriaId));
  }

  return NextResponse.json({ applied: weights.length });
}
