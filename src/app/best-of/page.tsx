import { db } from "~/server/db";
import { bestOf, criteria, evaluation, evaluationScore, movie } from "~/server/db/schema";
import Link from "next/link";
import { BestOfCarousels } from "~/app/best-of/_components/BestOfCarousels";
import { computeWeightedScores } from "~/server/score";

export default async function BestOfPage({searchParams}: {searchParams: Promise<{view: string}>}) {
  const all = await db.select().from(bestOf);
  const allCriteria = await db.select().from(criteria);
  const allMovies = await db.select().from(movie);
  const evaluations = await db.select().from(evaluation);
  const scores = await db.select().from(evaluationScore);

  const mainCriteria = allCriteria.filter(c => !c.parentId);
  const subCriteria = allCriteria.filter(c => c.parentId);


  // Centralized weighted score per movie (0-5)
  const { weighted: movieScores } = computeWeightedScores({
    criteria: allCriteria,
    evaluations,
    scores,
    movieIds: allMovies.map(m => m.id),
    includeBreakdown: false,
  });

  const criteriaById = Object.fromEntries(allCriteria.map(c => [c.id, c] as const));
  const movieById = Object.fromEntries(allMovies.map(m => [m.id, m] as const));

  const viewSearch = (await searchParams).view;
  const currentView = (viewSearch === 'gallery' || viewSearch === 'detailed') ? viewSearch : 'gallery';
  
  // Helper to build top groups for different categories
  function buildTopGroups(getKey: (m: typeof allMovies[number]) => string | undefined) {
    const groups: Record<string, { movieId: string; score: number }[]> = {};
    for (const m of allMovies) {
      const key = getKey(m) ?? 'Unknown';
      const score = movieScores[m.id];
      if (score == null) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ movieId: m.id, score });
    }
    Object.keys(groups).forEach((k) => groups[k]?.sort((a, b) => b.score - a.score));
    return groups;
  }

  // Helper to build top groups when a movie can belong to multiple keys (e.g., multiple genres)
  function buildTopGroupsMulti(getKeys: (m: typeof allMovies[number]) => string[] | undefined) {
    const groups: Record<string, { movieId: string; score: number }[]> = {};
    for (const m of allMovies) {
      const keys = getKeys(m)?.filter(Boolean) ?? ['Unknown'];
      const score = movieScores[m.id];
      if (score == null) continue;
      for (const key of keys) {
        if (!groups[key]) groups[key] = [];
        groups[key].push({ movieId: m.id, score });
      }
    }
    Object.keys(groups).forEach((k) => groups[k]?.sort((a, b) => b.score - a.score));
    return groups;
  }

  const TOP_N = 10;
  const byGenre = buildTopGroupsMulti((m) => m.genre ? m.genre.split(',').map((g) => g.trim()) : undefined);
  const byYear = buildTopGroups((m) => (m.year ? String(m.year) : undefined));
  const byRated = buildTopGroups((m) => m.rated ?? undefined);
  const byCountry = buildTopGroups((m) => (m.country ? m.country.split(',')[0]?.trim() : undefined));

  // Build UI-ready items for the client component
  const itemsByGenre = Object.fromEntries(
    Object.entries(byGenre).map(([genre, arr]) => [
      genre,
      arr.map(({ movieId, score }) => {
        const m = movieById[movieId];
        return {
          id: movieId,
          title: m?.title ?? 'Unknown',
          posterUrl: m?.posterUrl,
          href: `/${movieId}`,
          subtitle: `${genre} • Score ${score.toFixed(2)}`,
        };
      }),
    ])
  );

  const itemsByYear = Object.fromEntries(
    Object.entries(byYear).map(([year, arr]) => [
      year,
      arr.map(({ movieId, score }) => {
        const m = movieById[movieId];
        return {
          id: movieId,
          title: m?.title ?? 'Unknown',
          posterUrl: m?.posterUrl,
          href: `/${movieId}`,
          subtitle: `Year ${year} • Score ${score.toFixed(2)}`,
        };
      }),
    ])
  );

  const itemsByRated = Object.fromEntries(
    Object.entries(byRated).map(([rated, arr]) => [
      rated,
      arr.map(({ movieId, score }) => {
        const m = movieById[movieId];
        return {
          id: movieId,
          title: m?.title ?? 'Unknown',
          posterUrl: m?.posterUrl,
          href: `/${movieId}`,
          subtitle: `${rated} • Score ${score.toFixed(2)}`,
        };
      }),
    ])
  );

  const itemsByCountry = Object.fromEntries(
    Object.entries(byCountry).map(([country, arr]) => [
      country,
      arr.map(({ movieId, score }) => {
        const m = movieById[movieId];
        return {
          id: movieId,
          title: m?.title ?? 'Unknown',
          posterUrl: m?.posterUrl,
          href: `/${movieId}`,
          subtitle: `${country} • Score ${score.toFixed(2)}`,
        };
      }),
    ])
  );

  // Curated best-of (manual picks) grouped by criteriaId and labeled by criteria name
  const rawCuratedByCriteriaId = all.reduce<Record<string, { id: string; title: string; posterUrl?: string | null; href: string; subtitle?: string; createdAt?: Date | null; position?: number | null }[]>>(
    (acc, b) => {
      const cid = b.criteriaId ?? undefined;
      const m = b.movieId ? movieById[b.movieId] : undefined;
      if (!cid || !m) return acc;
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push({
        id: m.id,
        title: m.title ?? 'Unknown',
        posterUrl: m.posterUrl,
        href: `/${m.id}`,
        subtitle: undefined,
        createdAt: b.createdAt!,
        position: b.position!,
      });
      return acc;
    },
    {}
  );

  // Sort curated within each criteria by position asc (nulls last), then createdAt desc; keep top N and add ordinal subtitle
  const itemsByCurated = Object.fromEntries(
    Object.entries(rawCuratedByCriteriaId).map(([criteriaId, arr]) => {
      const sorted = [...arr].sort((a, b) => {
        const pa = a.position ?? Number.MAX_SAFE_INTEGER;
        const pb = b.position ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dbt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dbt - da;
      });
      const limited = sorted.slice(0, TOP_N);
      return [
        criteriaId,
        limited.map((item, idx) => ({
          id: item.id,
          title: item.title,
          posterUrl: item.posterUrl,
          href: item.href,
          subtitle: `#${idx + 1}`,
        })),
      ] as const;
    })
  );

  const criteriaLabels: Record<string, string> = Object.fromEntries(
    Object.entries(rawCuratedByCriteriaId).map(([criteriaId]) => [criteriaId, criteriaById[criteriaId]?.name ?? 'Unknown Criteria'])
  );



  return (
    <div className="relative flex size-full min-h-screen flex-col bg-gradient-to-br from-[#fcf8f8] via-[#f9f2f3] to-[#f5e8e9] group/design-root overflow-x-hidden" style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}>
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            <div className="flex items-center justify-between gap-4 px-2 sm:px-4 py-3">
              <h1 className="text-[#1b0e0e] tracking-light text-[28px] font-bold leading-tight">Best Of</h1>
              <Link href="/best/people" className="rounded-xl bg-[#994d51] px-3 py-2 text-sm text-white hover:bg-[#7a3d41] shadow-sm">Explore Best People</Link>
            </div>

              <div className="px-2 sm:px-4 py-4">
                <BestOfCarousels
                  itemsByCurated={itemsByCurated}
                  criteriaLabels={criteriaLabels}
                  itemsByGenre={itemsByGenre}
                  itemsByYear={itemsByYear}
                  itemsByRated={itemsByRated}
                  itemsByCountry={itemsByCountry}
                  topN={TOP_N}
                />
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}

