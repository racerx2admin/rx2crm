"use client";

import { useState } from "react";
import { SOURCES, type Lead, type Status } from "@/lib/types";

const TABS: { key: Status; label: string }[] = [
  { key: "new", label: "New" },
  { key: "approved", label: "Approved" },
  { key: "contacted", label: "Contacted" },
  { key: "skipped", label: "Skipped" },
];

export default function LeadList({ leads: initial }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initial);
  const [tab, setTab] = useState<Status>("new");
  const [error, setError] = useState<string | null>(null);

  // Keep in sync when the server list refreshes after a run.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setLeads(initial);
  }

  async function setStatus(id: string, status: Status) {
    const before = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setLeads(before);
      setError("Could not save that change. Try again.");
    } else setError(null);
  }

  const shown = leads.filter((l) => l.status === tab);
  return (
    <section>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === tab ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label} ({leads.filter((l) => l.status === t.key).length})
          </button>
        ))}
      </nav>
      {error && <p className="error">{error}</p>}
      {shown.length === 0 && <p className="muted">Nothing here yet.</p>}
      <ul className="leads">
        {shown.map((l) => (
          <li key={l.id}>
            <div className="top">
              <span className={`score s${l.score}`} title="Fit score, 1 to 5">
                {l.score}
              </span>
              <div className="main">
                <a href={l.website ?? undefined} target="_blank" rel="noreferrer" className="company">
                  {l.company}
                </a>
                <span className="muted">
                  {[l.city, l.state].filter(Boolean).join(", ")}
                  {l.category ? ` · ${l.category}` : ""}
                </span>
                {l.what_they_do && <p>{l.what_they_do}</p>}
                {l.why_fit && <p className="why">{l.why_fit}</p>}
                <p className="contact">
                  {l.contact_name && <span>{l.contact_name}</span>}
                  {l.contact_email && <a href={`mailto:${l.contact_email}`}>{l.contact_email}</a>}
                  {l.contact_phone && <span>{l.contact_phone}</span>}
                  {l.contact_url && (
                    <a href={l.contact_url} target="_blank" rel="noreferrer">
                      contact page
                    </a>
                  )}
                </p>
                <p className="muted small">
                  {SOURCES[l.source]}
                  {l.seed ? `: ${l.seed}` : ""}
                  {(l.source_links ?? []).map((u, i) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer">
                      {" "}
                      [{i + 1}]
                    </a>
                  ))}
                </p>
              </div>
              <div className="actions">
                {l.status !== "approved" && <button onClick={() => setStatus(l.id, "approved")}>Approve</button>}
                {l.status !== "skipped" && (
                  <button className="secondary" onClick={() => setStatus(l.id, "skipped")}>
                    Skip
                  </button>
                )}
                {l.status !== "new" && (
                  <button className="secondary" onClick={() => setStatus(l.id, "new")}>
                    Back to new
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
