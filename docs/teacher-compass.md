# Teacher Compass migration

Reference: [Codex11-v/tsaaasashuvuu](https://github.com/Codex11-v/tsaaasashuvuu),
reviewed at commit `66b9b39d28daeb8e744ea5ec76440e9eb8728c1d`.
The reference BrainHub SVG, Mongolian copy, radial layout and hover states are
adapted directly, with prefixed CSS and host theme tokens.

## Tools

- `/edusmart`: reference brain hub with links to the three tools.
- `/edusmart/voice`: microphone recording (up to two minutes), audio upload,
  Gemini transcription, teacher editing and report generation.
- `/edusmart/lessons`: grade, subject, duration and topic generate an editable
  lesson plan plus slides. Slides can be presented in the plugin and downloaded
  as a standalone HTML document. Markdown export retains the editable plan.
- `/edusmart/ocr`: image recognition produces editable name, score and attendance
  rows, with nullable unreadable scores, average, row addition/deletion and
  UTF-8 CSV export compatible with Excel. Export escapes formula-like cells.
- `/edusmart/settings`: gateway/user and AI configuration status; no client keys.

Exports are **CSV and HTML/Markdown**, not native XLSX/PPTX. This migration does
not port the reference's weighted term grading configuration, term analytics,
standalone authentication, REST/tRPC server or multi-provider fallback.

## Setup

1. Install with the `packageManager` version declared in `package.json`.
2. Copy `.env.example` to `.env`; set tenant Mongo, shared Redis,
   browser-reachable `UI_ENTRY_URL` and server-only `GEMINI_API_KEY`.
   `GEMINI_MODEL` defaults to `gemini-3.8-flash`.
3. Enable `edusmart` in erxes gateway/core API `ENABLED_PLUGINS`.
4. Grant `edusmartAiGenerate`, `edusmartWorkspaceRead` and
   `edusmartWorkspaceWrite` to use and save work.
5. Run `pnpm run dev:api` and `pnpm run dev:ui`; open the erxes host's
   `/edusmart` route. The remote requires the host router, Apollo and shared UI.

The settings status confirms whether a key exists, not provider health or quota.
Files are limited to 4 MB in the UI; ensure the gateway permits GraphQL request
bodies large enough for the base64 payload (approximately 5.4 MB). Mic capture
requires HTTPS or localhost and browser permission. Files and prompts are sent
to Gemini only on explicit tool actions. Uploaded audio/image inputs stay in the
browser. Saved reports, lesson plans and reviewed tables are stored in the
tenant-bound EduSmart workspace and can be reopened from the tool's Saved work
list; they are scoped to the signed-in author.

All application operations enforce the gateway user, tenant and awaited erxes
permissions. Saved work uses tenant-bound models with bounded pagination and
author filters. Provider failures are sanitized.

## Validation

Run `pnpm run codegen`, `pnpm run check`, `pnpm run lint`, `pnpm run build`
and `pnpm run test`. The tests mock AI and tenant models; they do not use real
credentials or services. Live gateway composition, tenant Mongo persistence,
microphone access and provider output require an erxes deployment smoke test.
