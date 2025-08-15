"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { HorizontalCarousel, type CarouselItem } from "~/app/best-of/_components/HorizontalCarousel";

export type ItemsByKey = Record<string, CarouselItem[]>;

export function BestOfCarousels({
  itemsByCurated,
  criteriaLabels,
  itemsByGenre,
  itemsByYear,
  itemsByRated,
  itemsByCountry,
  topN,
}: {
  itemsByCurated: ItemsByKey;
  criteriaLabels: Record<string, string>;
  itemsByGenre: ItemsByKey;
  itemsByYear: ItemsByKey;
  itemsByRated: ItemsByKey;
  itemsByCountry: ItemsByKey;
  topN: number;
}) {
  const [visible, setVisible] = useState({
    curated: true,
    genre: true,
    year: false,
    rated: false,
    country: false,
  });

  // Local editable copy for curated only
  const [curatedLocal, setCuratedLocal] = useState<ItemsByKey>({});
  const [editCurated, setEditCurated] = useState(false);
  const [picker, setPicker] = useState<
    | { open: false }
    | { open: true; mode: "replace" | "add"; criteriaId: string; oldMovieId?: string; input: string }
  >({ open: false });
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToast({ id, type, message });
    window.setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, 2000);
  };

  // tRPC utils and mutations
  const utils = api.useUtils();
  const reorderMut = api.movie.reorderBestOfList.useMutation({
    onSuccess: async () => {
      await utils.movie.getBestOfForAll.invalidate().catch(() => {});
      showToast('success', 'Order saved');
    },
    onError: (e) => {
      console.error(e);
      showToast('error', 'Reorder failed');
    }
  });
  const replaceMut = api.movie.replaceInBestOfList.useMutation({
    onSuccess: async () => {
      await utils.movie.getBestOfForAll.invalidate().catch(() => {});
      showToast('success', 'Replaced');
    },
    onError: (e) => {
      setPickerError(e.message ?? "Replace failed");
      showToast('error', 'Replace failed');
    }
  });
  const addMut = api.movie.addToBestOfList.useMutation({
    onSuccess: async () => {
      await utils.movie.getBestOfForAll.invalidate().catch(() => {});
      showToast('success', 'Added');
    },
    onError: (e) => {
      setPickerError(e.message ?? "Add failed");
      showToast('error', 'Add failed');
    }
  });

  // Movie preview for picker (unconditionally declared hook)
  const pickerOpen = picker.open;
  const pickerInput = pickerOpen ? picker.input : "";
  const { data: previewMovie, isFetching: previewLoading } = api.movie.getById.useQuery(
    { id: pickerInput || "" },
    { enabled: pickerOpen && !!pickerInput }
  );
  // Debounced search for picker
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const h = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(h);
  }, [search]);
  const { data: searchResults = [], isFetching: searchLoading } = api.movie.searchMovies.useQuery(
    { q: debounced, limit: 8 },
    { enabled: pickerOpen && debounced.length > 0 }
  );

  useEffect(() => {
    setCuratedLocal(itemsByCurated);
  }, [itemsByCurated]);

  const toggle = (key: keyof typeof visible) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

  const pill = (key: keyof typeof visible, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => toggle(key)}
      className={`${
        visible[key]
          ? "bg-[#994d51] text-white"
          : "bg-white/80 text-[#6b4a4c] hover:bg-[#f3e7e8]"
      } border border-[#e7d0d1] rounded-full px-3 py-1 text-sm transition-colors`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 px-2 sm:px-4">
        {pill("curated", "Curated")}
        {pill("genre", "Genres")}
        {pill("year", "Years")}
        {pill("rated", "Age Ratings")}
        {pill("country", "Countries")}
        {visible.curated && (
          <button
            type="button"
            onClick={() => setEditCurated((e) => !e)}
            className={`${editCurated ? "bg-[#994d51] text-white" : "bg-white/80 text-[#6b4a4c] hover:bg-[#f3e7e8]"} border border-[#e7d0d1] rounded-full px-3 py-1 text-sm transition-colors ml-auto`}
          >
            {editCurated ? "Done" : "Edit"}
          </button>
        )}
      </div>

      <div className="px-2 sm:px-4">
        {visible.curated &&
          Object.entries(curatedLocal)
            .sort((a, b) => (criteriaLabels[a[0]] ?? a[0]).localeCompare(criteriaLabels[b[0]] ?? b[0]))
            .map(([criteria, arr]) => {
              const items = arr.slice(0, topN);
              const move = (id: string, dir: -1 | 1) => {
                setCuratedLocal((prev) => {
                  const next = { ...prev };
                  const list = [...(next[criteria] ?? [])];
                  const idx = list.findIndex((x) => x.id === id);
                  if (idx < 0) return prev;
                  const j = idx + dir;
                  if (j < 0 || j >= list.length) return prev;
                  const tmp = list[idx]!;
                  list[idx] = list[j]!;
                  list[j] = tmp;
                  next[criteria] = list;
                  // Persist new order (optimistic)
                  const orderedMovieIds = list.map((x) => x.id).slice(0, topN);
                  reorderMut.mutate({ criteriaId: criteria, orderedMovieIds });
                  return next;
                });
              };
              const openReplace = (id: string) => {
                setPickerError(null);
                setPicker({ open: true, mode: "replace", criteriaId: criteria, oldMovieId: id, input: "" });
              };
              const openAdd = () => {
                setPickerError(null);
                setPicker({ open: true, mode: "add", criteriaId: criteria, input: "" });
              };
              const onReorder = (orderedIds: string[]) => {
                setCuratedLocal((prev) => {
                  const next = { ...prev };
                  const list = [...(next[criteria] ?? [])];
                  // reorder locally by mapping ids
                  const map = new Map(list.map((x) => [x.id, x] as const));
                  next[criteria] = orderedIds.map((id) => map.get(id)).filter(Boolean) as CarouselItem[];
                  return next;
                });
                reorderMut.mutate({ criteriaId: criteria, orderedMovieIds: orderedIds.slice(0, topN) });
              };
              return (
                <div key={`curated-wrap-${criteria}`} className="mb-3">
                  {editCurated && items.length < topN ? (
                    <div className="flex justify-end mb-1">
                      <button
                        className="rounded-full px-3 py-1 text-xs border border-[#e7d0d1] bg-white/80 text-[#6b4a4c] hover:bg-[#f3e7e8]"
                        onClick={openAdd}
                      >Add</button>
                    </div>
                  ) : null}
                  <HorizontalCarousel
                    key={`curated-${criteria}`}
                    label={`${criteriaLabels[criteria] ?? criteria}`}
                    items={items}
                    editMode={editCurated}
                    onMoveUp={(id) => move(id, -1)}
                    onMoveDown={(id) => move(id, +1)}
                    onReplace={(id) => openReplace(id)}
                    onReorder={onReorder}
                  />
                </div>
              );
            })}

        {visible.genre &&
          Object.entries(itemsByGenre)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([genre, arr]) => (
              <HorizontalCarousel
                key={`genre-${genre}`}
                label={`Top ${Math.min(topN, arr.length)} in ${genre}`}
                items={arr.slice(0, topN)}
              />
            ))}

        {visible.year &&
          Object.entries(itemsByYear)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([year, arr]) => (
              <HorizontalCarousel
                key={`year-${year}`}
                label={`Top ${Math.min(topN, arr.length)} in ${year}`}
                items={arr.slice(0, topN)}
              />
            ))}

        {visible.rated &&
          Object.entries(itemsByRated)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([rated, arr]) => (
              <HorizontalCarousel
                key={`rated-${rated}`}
                label={`Top ${Math.min(topN, arr.length)} rated ${rated}`}
                items={arr.slice(0, topN)}
              />
            ))}

        {visible.country &&
          Object.entries(itemsByCountry)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([country, arr]) => (
              <HorizontalCarousel
                key={`country-${country}`}
                label={`Top ${Math.min(topN, arr.length)} in ${country}`}
                items={arr.slice(0, topN)}
              />
            ))}
      </div>
      {picker.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-[520px] rounded-2xl bg-white p-5 shadow-xl">
          <h4 className="text-lg font-bold mb-2">{picker.mode === 'replace' ? 'Replace Movie' : 'Add Movie'}</h4>
          <p className="text-sm text-[#1b0e0e] mb-3">Search or enter a movie ID to {picker.mode === 'replace' ? 'replace the current one' : 'add to the list'}.</p>
          <div className="grid grid-cols-1 gap-2 mb-2">
            <input
              className="w-full rounded-xl border border-[#e7d0d1] bg-white/80 backdrop-blur-sm px-3 py-2 text-sm shadow-sm"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <div className="max-h-48 overflow-y-auto border border-[#e7d0d1] rounded-xl">
                {searchLoading ? (
                  <div className="p-2 text-xs text-[#6b4a4c]">Searching…</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-2 text-xs text-[#6b4a4c]">No results</div>
                ) : (
                  searchResults.map((m) => (
                    <button
                      key={m.id}
                      className="w-full flex items-center gap-3 p-2 text-left hover:bg-[#f3e7e8]"
                      onClick={() => {
                        setPicker({ ...picker, input: m.id });
                        setSearch("");
                      }}
                    >
                      {m.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.posterUrl} alt="poster" className="w-8 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-8 h-12 bg-[#f3e7e8] rounded" />
                      )}
                      <div className="text-xs text-[#1b0e0e]">
                        <div className="font-medium">{m.title ?? m.id}</div>
                        {m.year ? <div>{m.year}</div> : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <input
            className="w-full rounded-xl border border-[#e7d0d1] bg-white/80 backdrop-blur-sm px-3 py-2 text-sm shadow-sm"
            placeholder="movie-id"
            value={picker.input}
            onChange={(e) => picker.open && setPicker({ ...picker, input: e.target.value })}
          />
          {/* Preview */}
          {picker.input ? (
            <div className="mt-2 flex items-center gap-3">
              {previewLoading ? (
                <span className="text-xs text-[#6b4a4c]">Loading preview…</span>
              ) : previewMovie ? (
                <>
                  {previewMovie.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewMovie.posterUrl} alt="poster" className="w-10 h-14 object-cover rounded" />
                  ) : null}
                  <div className="text-xs text-[#1b0e0e]">
                    <div className="font-medium">{previewMovie.title ?? previewMovie.id}</div>
                    {previewMovie.year ? <div>{previewMovie.year}</div> : null}
                  </div>
                </>
              ) : (
                <span className="text-xs text-[#994d51]">No movie found for that ID</span>
              )}
            </div>
          ) : null}
          {pickerError ? (
            <div className="mt-2 text-xs text-[#994d51]">{pickerError}</div>
          ) : null}
          <div className="flex justify-end gap-2 mt-3">
            <button className="px-3 py-2 rounded-xl bg-[#f3e7e8] hover:bg-[#e7d0d1] transition-colors" onClick={() => setPicker({ open: false })}>Cancel</button>
            <button
              className="px-3 py-2 rounded-xl bg-[#e92932] hover:bg-[#c61f27] text-white shadow-sm"
              disabled={(() => {
                if (!picker.open) return true;
                const mId = picker.input.trim();
                if (!mId) return true;
                // Must exist for both modes
                if (!previewMovie) return true;
                // Add: disallow duplicate or overflow
                if (picker.mode === 'add') {
                  const list = curatedLocal[picker.criteriaId] ?? [];
                  if (list.length >= topN) return true;
                  if (list.some(x => x.id === mId)) return true;
                }
                // Replace: disallow no-op
                if (picker.mode === 'replace' && picker.oldMovieId === mId) return true;
                return false;
              })()}
              onClick={() => {
                if (!picker.open || !picker.input.trim()) return;
                const movieId = picker.input.trim();
                if (picker.mode === 'replace' && picker.oldMovieId) {
                  // optimistic replace in local state
                  setCuratedLocal((prev) => {
                    const next = { ...prev };
                    const list = [...(next[picker.criteriaId] ?? [])];
                    const idx = list.findIndex((x) => x.id === picker.oldMovieId);
                    if (idx < 0) return prev;
                    list[idx] = { id: movieId, title: previewMovie?.title ?? movieId, href: `/${movieId}`, posterUrl: previewMovie?.posterUrl ?? undefined };
                    next[picker.criteriaId] = list;
                    return next;
                  });
                  replaceMut.mutate({ criteriaId: picker.criteriaId, oldMovieId: picker.oldMovieId, newMovieId: movieId });
                } else if (picker.mode === 'add') {
                  // optimistic add to end if room
                  setCuratedLocal((prev) => {
                    const next = { ...prev };
                    const list = [...(next[picker.criteriaId] ?? [])];
                    if (list.length >= topN) return prev;
                    list.push({ id: movieId, title: previewMovie?.title ?? movieId, href: `/${movieId}`, posterUrl: previewMovie?.posterUrl ?? undefined });
                    next[picker.criteriaId] = list;
                    return next;
                  });
                  addMut.mutate({ criteriaId: picker.criteriaId, movieId });
                }
                setPicker({ open: false });
              }}
            >Confirm</button>
          </div>
        </div>
      </div>
    ) : null}
    {toast ? (
      <div className={`fixed bottom-4 right-4 z-50 rounded-xl px-3 py-2 text-sm shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-[#994d51] text-white'}`}>
        {toast.message}
      </div>
    ) : null}
    </div>
  );
}
