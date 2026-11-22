"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAST_SPONSORS, SOURCES, type Source } from "@/lib/types";

export default function FindLeads() {
  const router = useRouter();
  const [source, setSource] = useState<Source>("similar");
  const [seed, setSeed] = useState(PAST_SPONSORS[0]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage("Searching. This takes a few minutes, keep this page open.");
    try {
      const res = await fetch("/api/find-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, seed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setMessage(`Done: ${data.saved} new lead${data.saved === 1 ? "" : "s"} added (${data.found} found).`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="finder">
      <label>
        Source
        <select
          value={source}
          onChange={(e) => {
            const s = e.target.value as Source;
            setSource(s);
            setSeed(s === "similar" ? PAST_SPONSORS[0] : s === "local" ? "Temple City, CA" : "");
          }}
        >
          {Object.entries(SOURCES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        {source === "similar" ? "Past sponsor" : source === "local" ? "Town" : "Focus (optional)"}
        <input
          list={source === "similar" ? "sponsors" : undefined}
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder={source === "giving" ? "e.g. aerospace, utilities" : ""}
        />
        <datalist id="sponsors">
          {PAST_SPONSORS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <button onClick={run} disabled={busy}>
        {busy ? "Searching…" : "Find leads"}
      </button>
      {message && <p className="muted">{message}</p>}
    </section>
  );
}
