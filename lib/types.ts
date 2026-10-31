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
