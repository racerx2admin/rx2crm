import { db } from "@/lib/supabase";
import type { Lead } from "@/lib/types";
import FindLeads from "./FindLeads";
import LeadList from "./LeadList";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data, error } = await db()
    .from("leads")
    .select("*")
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  return (
    <main>
      <header>
        <h1>RX2 Sponsors</h1>
        <p className="muted">Find leads, then approve the ones worth emailing.</p>
      </header>
      <FindLeads />
      {error ? <p className="error">Could not load leads: {error.message}</p> : <LeadList leads={(data ?? []) as Lead[]} />}
    </main>
  );
}
