# Graph Report - ig-command-center  (2026-07-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 403 nodes · 1039 edges · 15 communities (12 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.57)
- Token cost: 36,335 input · 904 output

## Community Hubs (Navigation)
- Admin Auth Route Guards
- Account Sync and Encryption
- Account and Metrics UI Modals
- Content Pieces Dashboard
- Auth Pages and Busy State
- Charts and Overview UI
- Project Dependencies
- Database Setup and Seeding
- Content Plan and Summary Views
- TypeScript Configuration
- Security and Rate Limiting
- Next.js Security Headers
- Root App Layout
- Proxy Configuration
- Vercel Cron Jobs

## God Nodes (most connected - your core abstractions)
1. `adminClient()` - 38 edges
2. `useStore()` - 33 edges
3. `accountGate()` - 25 edges
4. `fail()` - 24 edges
5. `syncAccount()` - 23 edges
6. `getSessionProfile()` - 16 edges
7. `Piece` - 16 edges
8. `compilerOptions` - 16 edges
9. `AdminGate` - 13 edges
10. `GET()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `buildSeed()`  [EXTRACTED]
  scripts/setup.ts → src/lib/seed.ts
- `main()` --calls--> `defaultMetrics()`  [EXTRACTED]
  scripts/setup.ts → src/lib/seed.ts
- `main()` --calls--> `emptyMetrics()`  [EXTRACTED]
  scripts/setup.ts → src/lib/seed.ts
- `Props` --references--> `AccountMetrics`  [EXTRACTED]
  src/components/MetricsEditor.tsx → src/lib/types.ts
- `Props` --references--> `Piece`  [EXTRACTED]
  src/components/PostCard.tsx → src/lib/types.ts

## Import Cycles
- None detected.

## Communities (15 total, 3 thin omitted)

### Community 0 - "Admin Auth Route Guards"
Cohesion: 0.06
Nodes (75): DELETE(), Params, PATCH(), GET(), DELETE(), Params, DELETE(), Params (+67 more)

### Community 1 - "Account Sync and Encryption"
Cohesion: 0.07
Nodes (52): GET(), Params, Params, POST(), back(), GET(), canManageAccount(), getKey() (+44 more)

### Community 2 - "Account and Metrics UI Modals"
Cohesion: 0.07
Nodes (35): AccountModal(), COLORS, Props, format(), isFormatted(), MetricsEditor(), Props, sanitize() (+27 more)

### Community 3 - "Content Pieces Dashboard"
Cohesion: 0.12
Nodes (29): cleanDate(), POST(), Dashboard(), nextSyncLabel(), syncStamp(), EMPTY, PieceDraft, PieceModal() (+21 more)

### Community 4 - "Auth Pages and Busy State"
Cohesion: 0.12
Nodes (22): LoginPage(), ResetPage(), TopLoader(), emit(), Listener, listeners, onBusy(), trackBusy() (+14 more)

### Community 5 - "Charts and Overview UI"
Cohesion: 0.13
Nodes (23): Donut(), fmtDate(), fmtNum(), LineChart(), ICONS, KpiIcon(), PostCard(), Props (+15 more)

### Community 6 - "Project Dependencies"
Cohesion: 0.09
Nodes (21): dependencies, lucide-react, next, react, react-dom, @supabase/ssr, @supabase/supabase-js, devDependencies (+13 more)

### Community 7 - "Database Setup and Seeding"
Cohesion: 0.19
Nodes (16): adminEmail, db, ensureAdminUser(), main(), upsertMetrics(), POST(), POST(), insertAccount() (+8 more)

### Community 8 - "Content Plan and Summary Views"
Cohesion: 0.20
Nodes (14): FORMAT_META, DAY_NAMES, longDate(), MONTHS, PlanView(), DAY_NAMES, PLAIN, SummaryView() (+6 more)

### Community 9 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "Security and Rate Limiting"
Cohesion: 0.29
Nodes (12): POST(), POST(), buckets, clientIp(), COMMON, crossOriginResponse(), Hit, passwordProblem() (+4 more)

### Community 11 - "Next.js Security Headers"
Cohesion: 0.40
Nodes (4): csp, nextConfig, securityHeaders, supabaseOrigin

## Knowledge Gaps
- **111 isolated node(s):** `supabaseOrigin`, `csp`, `securityHeaders`, `nextConfig`, `name` (+106 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useStore()` connect `Account and Metrics UI Modals` to `Content Plan and Summary Views`, `Content Pieces Dashboard`, `Auth Pages and Busy State`, `Charts and Overview UI`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Piece` connect `Content Pieces Dashboard` to `Admin Auth Route Guards`, `Auth Pages and Busy State`, `Charts and Overview UI`, `Database Setup and Seeding`, `Content Plan and Summary Views`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `adminClient()` connect `Admin Auth Route Guards` to `Account Sync and Encryption`, `Security and Rate Limiting`, `Content Pieces Dashboard`, `Database Setup and Seeding`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `supabaseOrigin`, `csp`, `securityHeaders` to the rest of the system?**
  _111 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Auth Route Guards` be split into smaller, more focused modules?**
  _Cohesion score 0.06400208986415883 - nodes in this community are weakly interconnected._
- **Should `Account Sync and Encryption` be split into smaller, more focused modules?**
  _Cohesion score 0.07380520266182698 - nodes in this community are weakly interconnected._
- **Should `Account and Metrics UI Modals` be split into smaller, more focused modules?**
  _Cohesion score 0.07123034227567067 - nodes in this community are weakly interconnected._