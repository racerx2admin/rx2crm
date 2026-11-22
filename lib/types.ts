export const SOURCES = {
  similar: "Similar to a past sponsor",
  local: "Local businesses near Temple City",
  giving: "Corporate giving programs",
} as const;
export type Source = keyof typeof SOURCES;

export const CATEGORIES = [
  "fabrication",
  "engineering/EV",
  "automotive/off-road",
  "solar/energy",
  "aerospace",
  "other",
] as const;

export const STATUSES = ["new", "approved", "skipped", "contacted"] as const;
export type Status = (typeof STATUSES)[number];

/** Last year's sponsors, used as seeds for the "similar" source. */
export const PAST_SPONSORS = [
  "LA STEM",
  "Biltmore Metal Fabricators",
  "Mission Solar Energy",
  "Transtech",
  "Highlands",
  "Sherfab",
  "RPM Offroad Garage",
  "Motivo",
];

/** A lead as the model reports it, before checks. */
export interface FoundLead {
  company: string;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  what_they_do?: string | null;
  category?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_url?: string | null;
  contact_name?: string | null;
  why_fit?: string | null;
  score: number;
  source_links?: string[];
}

export interface Lead extends FoundLead {
  id: string;
  created_at: string;
  domain: string | null;
  name_key: string;
  source: Source;
  seed: string | null;
  status: Status;
  notes: string | null;
  run_id: string | null;
}
