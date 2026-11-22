import { CATEGORIES, PAST_SPONSORS, SOURCES, type FoundLead, type Source } from "./types";
import { domainOf, isDuplicate, nameKey, remember, type Known } from "./dedupe";

/**
 * One discovery run: DeepSeek researches the web through two tools (Tavily search
 * and page reading) and hands back leads through a third tool, submit_leads.
 * Everything here is plain fetch so it can be tested with a fake fetch.
 */

export interface RunInput {
  source: Source;
  seed?: string | null; // a past sponsor for "similar", a town for "local"
  count?: number;
}

export interface Env {
  deepseekKey: string;
  deepseekModel: string;
  tavilyKey: string;
  fetch?: typeof fetch;
  maxSearches?: number;
  maxTurns?: number;
}

export interface RunResult {
  leads: FoundLead[]; // new, checked leads ready to save
  found: number; // what the model returned before checks
  searches: number;
  tokensIn: number;
  tokensOut: number;
}

const TEAM = `RX2 (Racer X 2) is an all-girls high school solar race car team at Temple City High School in Temple City, California (San Gabriel Valley, Los Angeles County). The students design, build, and race a solar car in the national Solar Car Challenge. Team site: https://racerxtemplecity.org/. They need sponsors: cash, materials, machining or fabrication help, parts, and mentoring.`;

const RUBRIC = `Fit score, 1 to 5 (start at 0, cap at 5, minimum 1):
+2 the company already sponsors or supports student, STEM, robotics, racing, or school programs (you found a page showing it)
+1 same line of work as a past RX2 sponsor (metal fabrication, machining, EV or product engineering, off-road/automotive, solar)
+1 based in California or Texas
+1 publishes a way to reach them (email, contact form, or phone)`;

function sourceBrief(input: RunInput): string {
  const seed = input.seed?.trim();
  switch (input.source) {
    case "similar":
      return `Source: companies similar to RX2's past sponsor ${seed || "(pick from the list below)"}. First learn what that sponsor does and where it is, then find companies in the same line of work, its competitors and suppliers, and companies that sponsor other student solar car, Formula SAE, electric vehicle, or robotics teams. Past sponsors: ${PAST_SPONSORS.join(", ")}.`;
    case "local":
      return `Source: local businesses near ${seed || "Temple City, CA"} (within about 15 miles: Temple City, Arcadia, El Monte, South El Monte, Monrovia, Rosemead, San Gabriel, Pasadena, Irwindale, Azusa, City of Industry, Alhambra). Focus on fabrication and machine shops, manufacturers, engineering firms, automotive and off-road shops, solar companies, and businesses known for sponsoring local schools or youth teams.`;
    case "giving":
      return `Source: companies with a published corporate giving, STEM education, or community sponsorship program that a high school team can apply to or contact${seed ? ` (focus: ${seed})` : ""}. Prefer programs open to California or Texas schools. Put the program or application page in contact_url.`;
  }
}

export function buildPrompt(input: RunInput, existing: string[]): string {
  const count = input.count ?? 15;
  return `${TEAM}

${sourceBrief(input)}

Find up to ${count} US companies that could sponsor RX2. Prefer California and Texas, then the rest of the US.

Rules:
- Use web_search and read_page to check every lead. Open the company's own site; do not guess.
- Only use contact details the company publishes (general email, contact form, phone, or a person named on their own site). Never guess an email address.
- Every lead needs its real website.
- why_fit is one sentence a student could use in an email.
- category is one of: ${CATEGORIES.join(", ")}.
- source_links are the pages your facts came from.
- Skip these companies, they are already in the list: ${existing.length ? existing.join("; ") : "(none yet)"}.

${RUBRIC}

When done, call submit_leads once with all leads. Quality over quantity: fewer solid leads beat many weak ones.`;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web. Returns titles, URLs and short snippets.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page",
      description: "Read the text of one web page, such as a company's About or Contact page.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_leads",
      description: "Submit the final list of leads. Call once, at the end.",
      parameters: {
        type: "object",
        properties: {
          leads: {
            type: "array",
            items: {
              type: "object",
              properties: {
                company: { type: "string" },
                website: { type: "string" },
                city: { type: "string" },
                state: { type: "string", description: "Two-letter US state" },
                what_they_do: { type: "string" },
                category: { type: "string", enum: [...CATEGORIES] },
                contact_email: { type: "string" },
                contact_phone: { type: "string" },
                contact_url: { type: "string" },
                contact_name: { type: "string" },
                why_fit: { type: "string" },
                score: { type: "integer", minimum: 1, maximum: 5 },
                source_links: { type: "array", items: { type: "string" } },
              },
              required: ["company", "website", "why_fit", "score"],
            },
          },
        },
        required: ["leads"],
      },
    },
  },
];

type Msg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string }
  | { role: "tool"; tool_call_id: string; content: string };

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + " …[cut]" : s);

async function tavilySearch(env: Env, query: string): Promise<string> {
  const f = env.fetch ?? fetch;
  const res = await f("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.tavilyKey}` },
    body: JSON.stringify({ query, max_results: 8, search_depth: "basic" }),
  });
  if (!res.ok) return `Search failed (${res.status}).`;
  const data = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
  const results = data.results ?? [];
  if (!results.length) return "No results.";
  return results.map((r) => `- ${r.title}\n  ${r.url}\n  ${clip(r.content ?? "", 300)}`).join("\n");
}

async function tavilyRead(env: Env, url: string): Promise<string> {
  const f = env.fetch ?? fetch;
  const res = await f("https://api.tavily.com/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.tavilyKey}` },
    body: JSON.stringify({ urls: [url] }),
  });
  if (!res.ok) return `Could not read page (${res.status}).`;
  const data = (await res.json()) as { results?: { url: string; raw_content: string }[] };
  const page = data.results?.[0];
  return page?.raw_content ? clip(page.raw_content, 8000) : "Could not read page.";
}

async function chat(env: Env, messages: Msg[]) {
  const f = env.fetch ?? fetch;
  const res = await f("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.deepseekKey}` },
    body: JSON.stringify({ model: env.deepseekModel, messages, tools: TOOLS, tool_choice: "auto" }),
  });
  if (!res.ok) throw new Error(`DeepSeek error ${res.status}: ${clip(await res.text(), 300)}`);
  return (await res.json()) as {
    choices: { message: { content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
}

const str = (v: unknown, max = 300): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** Cleans one lead from the model. Returns null when it fails the checks. */
export function checkLead(raw: unknown): FoundLead | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const company = str(r.company, 120);
  const website = str(r.website, 300);
  if (!company || !website || !domainOf(website)) return null;
  const score = Math.max(1, Math.min(5, Math.round(Number(r.score) || 0)));
  if (score < 2) return null;
  const category = (CATEGORIES as readonly string[]).includes(String(r.category)) ? String(r.category) : "other";
  const links = Array.isArray(r.source_links)
    ? r.source_links.filter((l): l is string => typeof l === "string" && /^https?:\/\//.test(l)).slice(0, 5)
    : [];
  return {
    company,
    website: /^https?:\/\//i.test(website) ? website : `https://${website}`,
    city: str(r.city, 80),
    state: str(r.state, 20)?.toUpperCase() ?? null,
    what_they_do: str(r.what_they_do, 200),
    category,
    contact_email: str(r.contact_email, 120),
    contact_phone: str(r.contact_phone, 40),
    contact_url: str(r.contact_url, 300),
    contact_name: str(r.contact_name, 120),
    why_fit: str(r.why_fit, 400),
    score,
    source_links: links,
  };
}

export async function discover(input: RunInput, known: Known, existingNames: string[], env: Env): Promise<RunResult> {
  const maxSearches = env.maxSearches ?? 30;
  const maxTurns = env.maxTurns ?? 40;
  // Past sponsors are never leads.
  for (const s of PAST_SPONSORS) known.names.add(nameKey(s));

  const messages: Msg[] = [
    { role: "system", content: "You are a careful research assistant. Use the tools; report only what you verified." },
    { role: "user", content: buildPrompt(input, existingNames) },
  ];
  let searches = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let submitted: unknown[] | null = null;

  for (let turn = 0; turn < maxTurns && !submitted; turn++) {
    const data = await chat(env, messages);
    tokensIn += data.usage?.prompt_tokens ?? 0;
    tokensOut += data.usage?.completion_tokens ?? 0;
    const msg = data.choices[0]?.message;
    if (!msg) throw new Error("DeepSeek returned no message");
    // reasoning_content is not sent back: DeepSeek rejects it in the input.
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });

    if (!msg.tool_calls?.length) {
      messages.push({ role: "user", content: "Call submit_leads now with the leads you have verified." });
      continue;
    }
    for (const call of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        messages.push({ role: "tool", tool_call_id: call.id, content: "Invalid JSON arguments." });
        continue;
      }
      let out: string;
      if (call.function.name === "submit_leads") {
        submitted = Array.isArray(args.leads) ? args.leads : [];
        out = "Received.";
      } else if (searches >= maxSearches) {
        out = "Search limit reached. Call submit_leads now with what you have.";
      } else if (call.function.name === "web_search") {
        searches++;
        out = await tavilySearch(env, String(args.query ?? ""));
      } else if (call.function.name === "read_page") {
        searches++;
        out = await tavilyRead(env, String(args.url ?? ""));
      } else {
        out = `Unknown tool ${call.function.name}.`;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: out });
    }
  }

  const raw = submitted ?? [];
  const leads: FoundLead[] = [];
  for (const r of raw) {
    const lead = checkLead(r);
    if (!lead || isDuplicate(known, lead.company, lead.website)) continue;
    remember(known, lead.company, lead.website);
    leads.push(lead);
  }
  return { leads, found: raw.length, searches, tokensIn, tokensOut };
}

export const sourceLabel = (s: Source) => SOURCES[s];
