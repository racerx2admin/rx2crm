/** "https://www.IntegralFab.com/about" -> "integralfab.com" */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const withScheme = /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
    const host = new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

const SUFFIXES = /\b(incorporated|inc|llc|l\.l\.c|ltd|co|corp|corporation|company|the)\b/g;

/** "The Gill Corporation, Inc." -> "gill" */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,'’]/g, "")
    .replace(SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export interface Known {
  domains: Set<string>;
  names: Set<string>;
}

/** True when the lead matches anything already known (by domain or cleaned name). */
export function isDuplicate(known: Known, company: string, website?: string | null): boolean {
  const d = domainOf(website);
  if (d && known.domains.has(d)) return true;
  return known.names.has(nameKey(company));
}

/** Adds a lead to the known set, so duplicates inside one run are caught too. */
export function remember(known: Known, company: string, website?: string | null) {
  const d = domainOf(website);
  if (d) known.domains.add(d);
  known.names.add(nameKey(company));
}
