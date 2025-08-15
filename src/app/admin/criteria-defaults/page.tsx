"use client";
import { useMemo, useState } from "react";
import { api } from "~/trpc/react";

export default function CriteriaDefaultsAdminPage() {
  const { data: allCriteria = [] } = api.movie.getAllCriteria.useQuery();
  const { data: rules = [], refetch } = api.movie.getCriteriaDefaultApplicability.useQuery();
  const setRule = api.movie.setCriteriaDefaultApplicability.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const byCriteria = useMemo(() => new Map(rules.map((r) => [r.criteriaId, r])), [rules]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-[#1b0e0e]">Criteria Default Applicability</h1>
      <p className="text-sm text-[#6b4a4c] mb-4">Set defaults per criterion. These are applied before per-movie overrides. Leave fields empty to not constrain by that dimension.</p>
      <div className="space-y-3">
        {allCriteria
          .filter((c) => !!c.parentId) // focus on leaf/sub criteria
          .map((c) => (
            <CriteriaRuleRow
              key={c.id}
              criterion={c}
              rule={byCriteria.get(c.id)}
              onSave={(payload) => setRule.mutate(payload)}
            />
          ))}
      </div>
    </div>
  );
}

type RulePayload = {
  criteriaId: string;
  defaultMode?: "include" | "exclude";
  includeTypesCsv?: string;
  excludeTypesCsv?: string;
  includeGenresCsv?: string;
  excludeGenresCsv?: string;
};

function CriteriaRuleRow({
  criterion,
  rule,
  onSave,
}: {
  criterion: { id?: string | null; name?: string | null };
  rule: { defaultMode: string | null; includeTypesCsv: string | null; excludeTypesCsv: string | null; includeGenresCsv: string | null; excludeGenresCsv: string | null } | undefined;
  onSave: (payload: RulePayload) => void;
}) {
  const [state, setState] = useState({
    defaultMode: (rule?.defaultMode as "include" | "exclude" | null) ?? null,
    includeTypesCsv: rule?.includeTypesCsv ?? "",
    excludeTypesCsv: rule?.excludeTypesCsv ?? "",
    includeGenresCsv: rule?.includeGenresCsv ?? "",
    excludeGenresCsv: rule?.excludeGenresCsv ?? "",
  });

  const id = criterion.id!;

  return (
    <div className="border border-[#e7d0d1] rounded-xl p-3 bg-white/80">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-[#1b0e0e]">{criterion.name}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`mode-${id}`}
              checked={state.defaultMode === null}
              onChange={() => setState((s) => ({ ...s, defaultMode: null }))}
            />
            Inherit (include)
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`mode-${id}`}
              checked={state.defaultMode === "include"}
              onChange={() => setState((s) => ({ ...s, defaultMode: "include" }))}
            />
            Include
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`mode-${id}`}
              checked={state.defaultMode === "exclude"}
              onChange={() => setState((s) => ({ ...s, defaultMode: "exclude" }))}
            />
            Exclude
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <input
          className="rounded-lg border border-[#e7d0d1] px-2 py-1 bg-white"
          placeholder="Include types (csv): animation,documentary"
          value={state.includeTypesCsv}
          onChange={(e) => setState((s) => ({ ...s, includeTypesCsv: e.target.value }))}
        />
        <input
          className="rounded-lg border border-[#e7d0d1] px-2 py-1 bg-white"
          placeholder="Exclude types (csv)"
          value={state.excludeTypesCsv}
          onChange={(e) => setState((s) => ({ ...s, excludeTypesCsv: e.target.value }))}
        />
        <input
          className="rounded-lg border border-[#e7d0d1] px-2 py-1 bg-white"
          placeholder="Include genres (csv): animation,comedy"
          value={state.includeGenresCsv}
          onChange={(e) => setState((s) => ({ ...s, includeGenresCsv: e.target.value }))}
        />
        <input
          className="rounded-lg border border-[#e7d0d1] px-2 py-1 bg-white"
          placeholder="Exclude genres (csv)"
          value={state.excludeGenresCsv}
          onChange={(e) => setState((s) => ({ ...s, excludeGenresCsv: e.target.value }))}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          className="px-3 py-1.5 rounded-lg bg-[#994d51] hover:bg-[#7a3d41] text-white text-xs"
          onClick={() =>
            onSave({
              criteriaId: id,
              defaultMode: state.defaultMode ?? undefined,
              includeTypesCsv: state.includeTypesCsv || undefined,
              excludeTypesCsv: state.excludeTypesCsv || undefined,
              includeGenresCsv: state.includeGenresCsv || undefined,
              excludeGenresCsv: state.excludeGenresCsv || undefined,
            })
          }
        >Save</button>
      </div>
    </div>
  );
}
