// Compact transcript formats keep a 45-minute transcript well under 1 MB.
export type Word = [text: string, start: number, end: number];
export type Segment = [text: string, start: number, end: number];

export type TranscriptLanguage = "auto" | "en" | "hinglish" | "hi";

export interface ProjectSummary {
  id: string;
  title: string;
  duration_s: number;
  language: TranscriptLanguage;
  created_at: string;
}

export interface Project extends ProjectSummary {
  words: Word[];
  segments: Segment[];
  brief?: string | null;
  source_name?: string | null;
  source_size?: number | null;
}

export type NewProject = Omit<Project, "id" | "created_at">;

// ---- M3: brand + style card ----
export interface Brand {
  id: string;
  name: string;
  sells: string | null;
  audience: string | null;
  created_at: string;
}

export type CopyLanguage = "en" | "hinglish" | "hi";

export interface CaptionLook {
  fontSize: number;
  textColor: string;
  highlightColor: string;
  position: "lower" | "middle";
  wordsPerLine: number;
  uppercase: boolean;
}

export interface StyleFields {
  tone: string;
  hookStyle: string;
  emojisHashtags: string;
  language: CopyLanguage;
  captionLook: CaptionLook;
}

export interface Rule {
  id: string;
  text: string;
  platform: "all" | "shorts" | "reels";
  active: boolean;
  source?: string;
}

export interface StyleCard {
  id: string;
  brand_id: string;
  version: number;
  fields: StyleFields;
  rules: Rule[];
  change_note: string | null;
  created_at: string;
}

// ---- M4: AI clip picks ----
export interface Clip {
  id: string;
  project_id: string;
  idx: number;
  start_s: number;
  end_s: number;
  title: string;
  hook: string;
  reason: string;
  score: number;
  outcome?: "great" | "ok" | "poor" | null;
  created_at?: string;
}

// ---- M5/M6: platform copy with versions ----
export type Platform = "shorts" | "reels";
export interface ShortsCopy {
  title: string;
  description: string;
  hashtags: string[];
}
export interface ReelsCopy {
  caption: string;
  hashtags: string[];
  coverText: string;
}
export interface CopyVersion {
  id: string;
  clip_id: string;
  platform: Platform;
  version: number;
  content: ShortsCopy | ReelsCopy;
  language: string | null;
  instruction: string | null;
  made_rule: boolean;
  created_at: string;
}
