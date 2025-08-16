"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
 

export default function CriteriaPage() {
  const { data: allCriteria = [], isLoading } = api.movie.getAllCriteria.useQuery();
  const utils = api.useUtils();
  const updateWeight = api.movie.updateCriteriaWeight.useMutation();
  const updateWeightsBulk = api.movie.updateCriteriaWeights.useMutation({
    onSuccess: () => utils.movie.getAllCriteria.invalidate().catch(() => {}),
  });
  const createCriteria = api.movie.createCriteria.useMutation({
    onSuccess: () => utils.movie.getAllCriteria.invalidate().catch(() => {}),
  });
  const updateCriteria = api.movie.updateCriteria.useMutation({
    onSuccess: () => utils.movie.getAllCriteria.invalidate().catch(() => {}),
  });
  const deleteCriteria = api.movie.deleteCriteria.useMutation({
    onSuccess: () => utils.movie.getAllCriteria.invalidate().catch(() => {}),
  });
  const deleteCriteriaForce = api.movie.deleteCriteriaForce.useMutation({
    onSuccess: () => utils.movie.getAllCriteria.invalidate().catch(() => {}),
  });
  const { data: refInfo = {} } = api.movie.getCriteriaReferenceInfo.useQuery();

  // Local state for weights (optimistic UI)
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [lastServerWeights, setLastServerWeights] = useState<Record<string, number>>({});
  // Local drafts for inline editing (name/description)
  const [drafts, setDrafts] = useState<Record<string, { name: string; description: string }>>({});

  // Initialize weights from server data
  useEffect(() => {
    if (allCriteria.length > 0) {
      const initial: Record<string, number> = {};
      allCriteria.forEach(c => { initial[c.id] = c.weight ?? 0; });
      setWeights(initial);
      setLastServerWeights(initial);
      const initialDrafts: Record<string, { name: string; description: string }> = {};
      allCriteria.forEach(c => { initialDrafts[c.id] = { name: c.name ?? "", description: c.description ?? "" }; });
      setDrafts(initialDrafts);
    }
  }, [allCriteria]);

  // Local-only; commit on blur/enter
  const handleWeightChange = (id: string, value: number) => {
    setWeights(w => ({ ...w, [id]: value }));
  };
  const commitWeightChange = (id: string) => {
    const value = weights[id] ?? 0;
    updateWeight.mutate(
      { id, weight: value },
      {
        onSuccess: () => {
          setLastServerWeights(w => ({ ...w, [id]: value }));
        },
        onError: () => {
          setWeights(w => ({ ...w, [id]: lastServerWeights[id] ?? 0 }));
        },
      }
    );
  };

  const mainCriteria = useMemo(() => allCriteria.filter(c => !c.parentId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [allCriteria]);
  const subCriteria = useMemo(() => allCriteria.filter(c => c.parentId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [allCriteria]);
  const isLoadingNow = isLoading;
 

  if (isLoadingNow) {
    return <div className="px-4 sm:px-8 lg:px-40 py-8">Loading...</div>;
  }

  return (
    <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
      <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 mb-6">
          <div>
            <h1 className="text-[#1b0e0e] tracking-tight text-3xl sm:text-4xl font-bold leading-tight">Evaluation Criteria</h1>
            <p className="text-[#6b4a4c] mt-2 text-sm sm:text-base">Manage main and sub-criteria, weights, order and descriptions.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => createCriteria.mutate({ name: "New Group", weight: 0, parentId: null })}
              className="h-9 rounded-xl px-3 text-sm bg-[#994d51] text-white shadow-sm hover:bg-[#7a3d41] transition-colors"
            >New Main Criteria</button>
            <button
              onClick={() => {
                const total = mainCriteria.reduce((sum, m) => sum + (weights[m.id] ?? 0), 0);
                const updates = mainCriteria.map((m) => ({ id: m.id, weight: total > 0 ? Math.round(((weights[m.id] ?? 0) / total) * 100) : Math.round(100 / Math.max(1, mainCriteria.length)) }));
                // Ensure sum is exactly 100 by adjusting the largest
                const sum = updates.reduce((s, u) => s + u.weight, 0);
                if (sum !== 100 && updates.length > 0) {
                  const idx = updates.reduce((imax, u, i, arr) => (u.weight > arr[imax]!.weight ? i : imax), 0);
                  updates[idx] = { ...updates[idx]!, weight: updates[idx]!.weight + (100 - sum) };
                }
                updateWeightsBulk.mutate({ updates });
              }}
              className="h-9 rounded-xl px-3 text-sm bg-[#f3e7e8] text-[#1b0e0e] shadow-sm hover:bg-[#e7d0d1] transition-colors"
              title="Normalize main criteria weights so they sum to 100%"
            >Rebalance Mains to 100%</button>
          </div>
        </div>

        {mainCriteria.map(main => (
          <div key={main.id} className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-sm mb-4">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <span className="px-1 py-1 rounded text-[#c8b3b4]">⋮⋮</span>
                        <input
                          className="text-base font-semibold px-2 py-1 rounded-lg border border-[#e7d0d1] bg-white/70"
                          value={drafts[main.id]?.name ?? ''}
                          onChange={(e) => setDrafts(d => ({ ...d, [main.id]: { ...(d[main.id] ?? { name: '', description: '' }), name: e.target.value } }))}
                          onBlur={() => updateCriteria.mutate({ id: main.id, name: drafts[main.id]?.name ?? '' })}
                        />
                        <span className="text-xs text-[#6b4a4c]">Main</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-[#6b4a4c]">Weight</label>
                        <input
                          type="number" min={0} max={100}
                          value={weights[main.id] ?? 0}
                          onChange={e => {
                            handleWeightChange(main.id, Number(e.target.value));
                          }}
                          onBlur={() => commitWeightChange(main.id)}
                          className="w-16 text-sm border rounded px-2 py-1 text-[#994d51]"
                        />
                        <button onClick={() => createCriteria.mutate({ name: "New Sub", weight: 0, parentId: main.id })} className="h-8 rounded-lg px-2 text-sm bg-[#f3e7e8] hover:bg-[#e7d0d1]">Add Sub</button>
                        {(() => {
                          const info = refInfo[main.id] ?? { hasSubs: false, referenced: false };
                          if (info.hasSubs) {
                            return (
                              <button disabled title="Cannot delete: has sub-criteria" className="h-8 rounded-lg px-2 text-sm bg-gray-200 text-gray-500 cursor-not-allowed">Delete</button>
                            );
                          }
                          if (info.referenced) {
                            return (
                              <button
                                onClick={() => {
                                  if (confirm(`Force-delete this main criterion and remove its references?`)) {
                                    deleteCriteriaForce.mutate({ id: main.id });
                                  }
                                }}
                                className="h-8 rounded-lg px-2 text-sm text-white bg-[#7a1f27] hover:bg-[#5d1820]"
                                title="Force delete (will remove references)"
                              >Force Delete</button>
                            );
                          }
                          return (
                            <button onClick={() => deleteCriteria.mutate({ id: main.id })} className="h-8 rounded-lg px-2 text-sm text-white bg-[#e92932] hover:bg-[#c61f27]">Delete</button>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="px-4 pb-4">
                      {subCriteria.filter(sc => sc.parentId === main.id).map(sub => (
                        <div key={sub.id} className="grid grid-cols-1 sm:grid-cols-[auto_20%_1fr_auto] items-start gap-3 border-t border-t-[#e7d0d1] py-3">
                          <span className="px-1 py-1 rounded text-[#c8b3b4]">⋮⋮</span>
                                  <input
                                    className="text-sm font-medium px-2 py-1 rounded-lg border border-[#e7d0d1] bg-white/70"
                                    value={drafts[sub.id]?.name ?? ''}
                                    onChange={(e) => setDrafts(d => ({ ...d, [sub.id]: { ...(d[sub.id] ?? { name: '', description: '' }), name: e.target.value } }))}
                                    onBlur={() => updateCriteria.mutate({ id: sub.id, name: drafts[sub.id]?.name ?? '' })}
                                  />
                                  <textarea
                                    className="text-sm px-2 py-1 rounded-lg border border-[#e7d0d1] bg-white/70"
                                    placeholder="Description"
                                    value={drafts[sub.id]?.description ?? ''}
                                    onChange={(e) => setDrafts(d => ({ ...d, [sub.id]: { ...(d[sub.id] ?? { name: '', description: '' }), description: e.target.value } }))}
                                    onBlur={() => updateCriteria.mutate({ id: sub.id, description: drafts[sub.id]?.description ?? '' })}
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number" min={0} max={100}
                                      value={weights[sub.id] ?? 0}
                                      onChange={e => handleWeightChange(sub.id, Number(e.target.value))}
                                      onBlur={() => commitWeightChange(sub.id)}
                                      className="w-16 text-sm border rounded px-2 py-1 text-[#994d51]"
                                    />
                                    {(() => {
                                      const isRef = !!refInfo[sub.id]?.referenced;
                                      if (isRef) {
                                        return (
                                          <button
                                            onClick={() => {
                                              if (confirm(`Force-delete this criterion and remove its references?`)) {
                                                deleteCriteriaForce.mutate({ id: sub.id });
                                              }
                                            }}
                                            title="Force delete (will remove references)"
                                            className="h-8 rounded-lg px-2 text-sm text-white bg-[#7a1f27] hover:bg-[#5d1820]"
                                          >Force Delete</button>
                                        );
                                      }
                                      return (
                                        <button onClick={() => deleteCriteria.mutate({ id: sub.id })} className="h-8 rounded-lg px-2 text-sm text-white bg-[#e92932] hover:bg-[#c61f27]">Delete</button>
                                      );
                                    })()}
                                  </div>
                        </div>
                      ))}
                      {subCriteria.filter(sc => sc.parentId === main.id).length > 0 ? (
                            <div className="flex justify-end pt-3">
                              <button
                                onClick={() => {
                                  const subs = subCriteria.filter(sc => sc.parentId === main.id);
                                  const total = subs.reduce((sum, s) => sum + (weights[s.id] ?? 0), 0);
                                  const updates = subs.map((s) => ({ id: s.id, weight: total > 0 ? Math.round(((weights[s.id] ?? 0) / total) * 100) : Math.round(100 / Math.max(1, subs.length)) }));
                                  const sum = updates.reduce((s, u) => s + u.weight, 0);
                                  if (sum !== 100 && updates.length > 0) {
                                    const idx = updates.reduce((imax, u, i, arr) => (u.weight > arr[imax]!.weight ? i : imax), 0);
                                    updates[idx] = { ...updates[idx]!, weight: updates[idx]!.weight + (100 - sum) };
                                  }
                                  updateWeightsBulk.mutate({ updates });
                                }}
                                className="h-8 rounded-lg px-2 text-sm bg-[#f3e7e8] hover:bg-[#e7d0d1]"
                                title="Normalize sub-criteria weights under this main so they sum to 100%"
                              >Rebalance Subs to 100%</button>
                            </div>
                          ) : null}
                    </div>
                  </div>
        ))}
      </div>
    </div>
  );
}