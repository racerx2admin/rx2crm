import { describe, expect, it } from "vitest";
import { checkLead, discover } from "../lib/discover";

type Call = { url: string; body: any };

/** A fake DeepSeek + Tavily: DeepSeek searches once, reads a page, then submits. */
function fakeFetch(submit: unknown[]) {
  const calls: Call[] = [];
  let turn = 0;
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
  const f = async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ url: String(url), body });
    if (String(url).includes("tavily.com/search")) {
      return json({ results: [{ title: "Acme Fab", url: "https://acmefab.com", content: "Sheet metal shop" }] });
    }
    if (String(url).includes("tavily.com/extract")) {
      return json({ results: [{ url: body.urls[0], raw_content: "Acme Fab sponsors robotics teams. Call 555-0100." }] });
    }
    turn++;
    const call = (name: string, args: unknown) => ({
      choices: [{ message: { content: null, tool_calls: [{ id: `c${turn}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }],
      usage: { prompt_tokens: 1000, completion_tokens: 100 },
    });
    if (turn === 1) return json(call("web_search", { query: "sheet metal fabrication sponsor students California" }));
    if (turn === 2) return json(call("read_page", { url: "https://acmefab.com" }));
    return json(call("submit_leads", { leads: submit }));
  };
  return { f: f as typeof fetch, calls };
}

const env = (f: typeof fetch) => ({ deepseekKey: "k", deepseekModel: "deepseek-v4-pro", tavilyKey: "t", fetch: f });

describe("discover", () => {
  it("runs the tool loop and returns checked, deduped leads", async () => {
    const { f, calls } = fakeFetch([
      { company: "Acme Fab", website: "acmefab.com", city: "El Monte", state: "ca", why_fit: "Local fab shop", score: 5, category: "fabrication", source_links: ["https://acmefab.com", "javascript:bad"] },
      { company: "Acme Fab Inc", website: "https://www.acmefab.com", why_fit: "dup", score: 4 }, // duplicate in same run
      { company: "Sherfab", website: "sherfab.com", why_fit: "past sponsor", score: 5 }, // past sponsor
      { company: "Known Co", website: "known.com", why_fit: "already in list", score: 4 }, // already in CRM
      { company: "Weak Co", website: "weak.com", why_fit: "meh", score: 1 }, // score too low
      { company: "No Site Co", why_fit: "no website", score: 4 }, // no website
    ]);
    const known = { domains: new Set(["known.com"]), names: new Set<string>() };
    const result = await discover({ source: "similar", seed: "Sherfab" }, known, ["Known Co"], env(f));

    expect(result.found).toBe(6);
    expect(result.leads.map((l) => l.company)).toEqual(["Acme Fab"]);
    const lead = result.leads[0];
    expect(lead.website).toBe("https://acmefab.com");
    expect(lead.state).toBe("CA");
    expect(lead.source_links).toEqual(["https://acmefab.com"]);
    expect(result.searches).toBe(2);
    expect(result.tokensIn).toBe(3000);

    const deepseek = calls.filter((c) => c.url.includes("deepseek"));
    expect(deepseek[0].body.model).toBe("deepseek-v4-pro");
    expect(deepseek[0].body.messages[1].content).toContain("Known Co");
    expect(deepseek[0].body.messages[1].content).toContain("Sherfab");
    // tool results are passed back to the model
    expect(JSON.stringify(deepseek[2].body.messages)).toContain("sponsors robotics teams");
  });

  it("stops searching at the cap", async () => {
    let n = 0;
    const f = (async (url: string) => {
      if (String(url).includes("tavily")) return new Response(JSON.stringify({ results: [] }));
      n++;
      const name = n > 5 ? "submit_leads" : "web_search";
      const args = name === "submit_leads" ? { leads: [] } : { query: "x" };
      return new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: `c${n}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] }));
    }) as unknown as typeof fetch;
    const result = await discover({ source: "local" }, { domains: new Set(), names: new Set() }, [], { ...env(f), maxSearches: 2 });
    expect(result.searches).toBe(2);
    expect(result.leads).toEqual([]);
  });

  it("rejects bad leads", () => {
    expect(checkLead({ company: "X", website: "nope", score: 5 })).toBeNull();
    expect(checkLead({ company: "X", website: "x.com", score: 9 })?.score).toBe(5);
    expect(checkLead({ company: "X", website: "x.com", score: 3, category: "bakery" })?.category).toBe("other");
  });
});
