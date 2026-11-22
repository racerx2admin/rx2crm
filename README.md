# RX2 CRM

Sponsor lead finder for RX2, the Temple City High School solar car team.

A student picks a source (similar to a past sponsor, local businesses, or corporate giving) and presses **Find leads**. DeepSeek researches the web through Tavily search, returns scored leads with sources, duplicates are dropped, and new leads show up in the list to approve or skip.

## Setup

1. **Supabase:** create a project, open the SQL editor, and run `supabase/schema.sql`.
2. **Keys:** copy `.env.example` to `.env.local` and fill it in:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase, Project settings > API)
   - `DEEPSEEK_API_KEY` (platform.deepseek.com; set a monthly spending limit there)
   - `TAVILY_API_KEY` (tavily.com, free tier is 1,000 searches a month)
   - `APP_PASSWORD` (the shared team password)
3. **Run locally:** `npm install`, then `npm run dev`.
4. **Deploy:** import the repo in Vercel and add the same variables under Settings > Environment Variables.

## How a run works

`app/api/find-leads` calls `lib/discover.ts`, which gives DeepSeek three tools: `web_search`, `read_page` (both Tavily), and `submit_leads`. Each submitted lead is checked (real website, score 2 or higher), deduped against everything already in the table by domain and cleaned company name (skipped leads included), and saved. Each run is logged in the `runs` table with search and token counts, for tracking cost.

Fit score, 1 to 5: +2 already sponsors student or STEM programs, +1 same line of work as a past sponsor, +1 based in California or Texas, +1 public contact path.

## Checks

`npm test` (dedupe and the search loop, with a fake DeepSeek and Tavily), `npm run typecheck`, `npm run build`.
