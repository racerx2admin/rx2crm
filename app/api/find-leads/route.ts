import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { discover } from "@/lib/discover";
import { domainOf, nameKey } from "@/lib/dedupe";
import { SOURCES, type Source } from "@/lib/types";

// A run makes many search and model calls; give it up to 5 minutes.
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { source?: string; seed?: string };
  const source = body.source as Source;
  if (!(source in SOURCES)) return NextResponse.json({ error: "Pick a source" }, { status: 400 });
  const seed = body.seed?.trim().slice(0, 120) || null;

  const { deepseekKey, tavilyKey } = { deepseekKey: process.env.DEEPSEEK_API_KEY, tavilyKey: process.env.TAVILY_API_KEY };
  if (!deepseekKey || !tavilyKey) {
    return NextResponse.json({ error: "DEEPSEEK_API_KEY and TAVILY_API_KEY must be set" }, { status: 500 });
  }

  const supabase = db();
  const { data: run, error: runErr } = await supabase.from("runs").insert({ source, seed }).select().single();
  if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 });

  try {
    // Everything already in the list, skipped leads included, so nothing comes back twice.
    const { data: existing, error } = await supabase.from("leads").select("company, domain, name_key");
    if (error) throw new Error(error.message);
    const known = {
      domains: new Set(existing.map((l) => l.domain).filter(Boolean) as string[]),
      names: new Set(existing.map((l) => l.name_key)),
    };

    const result = await discover({ source, seed }, known, existing.map((l) => l.company), {
      deepseekKey,
      tavilyKey,
      deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
    });

    const rows = result.leads.map((l) => ({
      ...l,
      domain: domainOf(l.website),
      name_key: nameKey(l.company),
      source,
      seed,
      run_id: run.id,
    }));
    // Insert one at a time: a lead another run saved meanwhile hits a unique key and is skipped.
    let savedCount = 0;
    for (const row of rows) {
      const { error: saveErr } = await supabase.from("leads").insert(row);
      if (!saveErr) savedCount++;
      else if (saveErr.code !== "23505") throw new Error(saveErr.message);
    }

    await supabase
      .from("runs")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        leads_found: result.found,
        leads_saved: savedCount,
        searches: result.searches,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
      })
      .eq("id", run.id);
    return NextResponse.json({ found: result.found, saved: savedCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
