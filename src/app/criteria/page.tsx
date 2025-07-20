"use client";
import { useState, useEffect } from "react";
import { api } from "~/trpc/react";

export default function CriteriaPage() {
  const { data: allCriteria = [], isLoading } = api.movie.getAllCriteria.useQuery();
  const utils = api.useUtils();
  const updateWeight = api.movie.updateCriteriaWeight.useMutation();

  // Local state for weights (optimistic UI)
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [lastServerWeights, setLastServerWeights] = useState<Record<string, number>>({});

  // Initialize weights from server data
  useEffect(() => {
    if (allCriteria.length > 0) {
      const initial: Record<string, number> = {};
      allCriteria.forEach(c => { initial[c.id] = c.weight ?? 0; });
      setWeights(initial);
      setLastServerWeights(initial);
    }
  }, [allCriteria]);

  // On mutation, update local state immediately, revert on error
  const handleWeightChange = (id: string, value: number) => {
    setWeights(w => ({ ...w, [id]: value }));
    updateWeight.mutate(
      { id, weight: value },
      {
        onSuccess: () => {
          setLastServerWeights(w => ({ ...w, [id]: value }));
          utils.movie.getAllCriteria.invalidate().catch(() => console.log(""));
        },
        onError: () => {
          // Revert to last server value
          setWeights(w => ({ ...w, [id]: lastServerWeights[id] ?? 0 }));
        },
      }
    );
  };

  if (isLoading) return <div>Loading...</div>;

  const mainCriteria = allCriteria.filter(c => !c.parentId);
  const subCriteria = allCriteria.filter(c => c.parentId);

  return (
    <div className="px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            <div className="flex flex-wrap justify-between gap-3 p-4">
              <div className="flex min-w-72 flex-col gap-3">
                <p className="text-[#1b0e0e] tracking-light text-[32px] font-bold leading-tight">Evaluation Criteria</p>
                <p className="text-[#994d51] text-sm font-normal leading-normal">Explore the criteria used to evaluate movies and TV series.</p>
              </div>
            </div>
            {mainCriteria.sort((a, b) => (b.weight??0) - (a.weight??0)).map(main => (
             <>
            <div className="flex flex-row justify-between w-full items-center pr-5">
            <h3 key={main.id} className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">{main.name}</h3>
            <span 
                    className="w-16 border rounded px-2 py-1 text-sm text-[#994d51] flex flex-row"
            >
            <input
                    min={0}
                    max={100}
                     value={weights[main.id] ?? 0}
                    onChange={e => handleWeightChange(main.id, Number(e.target.value))}
                    className="border-0 w-10 padding-0 outline-none"
                  />
            %
            </span>
            </div>
            <div key={main.id + "1"} className="p-4 grid grid-cols-[20%_1fr] gap-x-6">
                              {subCriteria.sort((a, b) => (b.weight??0) - (a.weight??0)).filter(sc => sc.parentId === main.id).map(sub => (
              <div key={sub.id} className="col-span-3 grid grid-cols-subgrid border-t border-t-[#e7d0d1] py-5 pr-1">
                <p className="text-[#994d51] text-sm font-normal leading-normal">{sub.name}</p>
                <p className="text-[#1b0e0e] text-sm font-normal leading-normal">{sub.description}</p>

            <span 
                    className="w-16 border rounded px-2 py-1 text-sm text-[#994d51] flex flex-row"
            >
            <input
                    min={0}
                    max={100}
                     value={weights[sub.id] ?? 0}
                    onChange={e => handleWeightChange(main.id, Number(e.target.value))}
                    className="border-0 w-10 padding-0 outline-none"
                  />
            %
            </span>
              </div>
                              ))}
                </div>
             </>   
            ))}

                </div>
                </div>
  );
}