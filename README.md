# CineCritique

CineCritique is a movie evaluation app with weighted criteria, rich analytics, and presets to quickly switch scoring philosophies.

## Domain Model

- __Movies__: core items being evaluated. Key fields include `id`, `title`, `year`, `genre` (comma-separated), `awards`, `boxOffice`.
- __Criteria__: hierarchical evaluation criteria. Main criteria have `parentId = null`; sub-criteria point to a main via `parentId`. Each has a `weight` and `position`.
- __Evaluations__: a set of user scores per movie. `evaluationScore` rows store `evaluationId`, `criteriaId`, and `score`.
- __Presets__: named sets of criteria weights. You can save current weights into a preset and later apply it to switch the app’s scoring weights.

Weighted scoring is computed server-side via `src/server/score.ts` (`computeWeightedScores()`), aggregating sub-criteria under main groups and weighting mains for the overall score.

## Local Development

Requirements:
- Node 20+
- PostgreSQL (local) or a connection URL

Install deps:

```bash
npm ci
npx playwright install
```

Environment setup: copy `.env.example` to `.env` and fill values.

Database (Drizzle):

```bash
# Generate and apply migrations
npm run db:generate
npm run db:migrate

# Optional: open Drizzle Studio
npm run db:studio
```

Start dev server:

```bash
npm run dev
```

## Environment Variables

See `.env.example` for the complete list. Common values:
- `DATABASE_URL` – Postgres connection
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` – Auth

## Testing

Unit tests (Vitest):

```bash
npm run test          # run once
npm run test:watch    # watch mode
npm run test:coverage # coverage
```

End-to-end (Playwright): ensure the app is running at `http://localhost:3000` (or set `PLAYWRIGHT_BASE_URL`), then:

```bash
npm run e2e
# or headed
npm run e2e:headed
```

Playwright config lives in `playwright.config.ts` and tests in `tests/`.

## Analytics Dashboard

The `/dashboard` route provides:
- __Trends over time__: yearly average overall scores.
- __Genre strengths__: top genres by count.
- __Per-criteria distributions__: min/avg/max for each main criterion.
- __Criteria × Genre heatmap__: average main criterion score across top genres.
- __Preset comparison__: compare different presets’ weights side-by-side.

Key code:
- `src/app/dashboard/page.tsx` – data loading, aggregation, charts.
- `src/app/_components/PresetCompare.tsx` – client component to compare presets.
- `src/app/api/presets/*` – preset CRUD and weight retrieval (`/api/presets/weights`).

## Linting & Formatting

- ESLint with `react-hooks` (incl. `exhaustive-deps`) and `jsx-a11y` enabled. Run `npm run check` or `npm run lint`.
- Prettier (with Tailwind plugin). Run `npm run format:write`.

## Styling

- Tailwind CSS with a soft, glassmorphism aesthetic.
- Brand color: `#994d51` (burgundy/wine); see `MEMORY` for palette.

## Scripts

- `dev` – Next.js dev server
- `build`, `start`, `preview` – build/start flows
- `db:*` – Drizzle
- `test*` – Vitest
- `e2e*` – Playwright

## Notes

- The dashboard uses simple SVG/Tailwind charts for portability. Consider swapping to a charting lib if needs grow.
