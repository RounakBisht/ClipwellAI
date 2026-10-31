"use client";
// One data layer for the whole app. With Supabase configured it reads and writes the
// signed-in user's rows; in demo mode it keeps everything in this browser's localStorage.
import { DEMO_MODE, SUPABASE_READY } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { Brand, Clip, CopyVersion, NewProject, Platform, Project, ProjectSummary, Rule, StyleCard, StyleFields } from "@/lib/types";

const LOCAL = DEMO_MODE || !SUPABASE_READY;
const KEY = "clipwell:projects";

function readLocal(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function writeLocal(rows: Project[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch (e) {
    console.error("Could not save to this browser", e);
    throw new Error("This browser's storage is full. Delete an old project and try again.");
  }
}

function summary(p: Project): ProjectSummary {
  return { id: p.id, title: p.title, duration_s: p.duration_s, language: p.language, created_at: p.created_at };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (LOCAL) return readLocal().map(summary).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id,title,duration_s,language,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as ProjectSummary[];
}

export async function getProject(id: string): Promise<Project | null> {
  if (LOCAL) return readLocal().find((p) => p.id === id) || null;
  const supabase = createClient();
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Project) || null;
}

export async function createProject(input: NewProject): Promise<Project> {
  if (LOCAL) {
    const row: Project = { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    writeLocal([row, ...readLocal()]);
    return row;
  }
  const supabase = createClient();
  const base = {
    title: input.title,
    duration_s: input.duration_s,
    language: input.language,
    words: input.words,
    segments: input.segments,
    brief: input.brief ?? null,
  };
  let { data, error } = await supabase
    .from("projects")
    .insert({ ...base, source_name: input.source_name ?? null, source_size: input.source_size ?? null })
    .select("*")
    .single();
  // If the database hasn't got the newer columns yet, save without them rather than lose the transcript.
  if (error && /source_(name|size)|schema cache/i.test(error.message)) {
    ({ data, error } = await supabase.from("projects").insert(base).select("*").single());
  }
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  if (LOCAL) {
    writeLocal(readLocal().map((p) => (p.id === id ? { ...p, ...patch } : p)));
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string): Promise<void> {
  if (LOCAL) {
    writeLocal(readLocal().filter((p) => p.id !== id));
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- M3: brand and style cards ----------

function readKey<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function writeKey(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function getBrand(): Promise<Brand | null> {
  if (LOCAL) return readKey<Brand | null>("clipwell:brand", null);
  const supabase = createClient();
  const { data, error } = await supabase.from("brands").select("*").order("created_at").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Brand) || null;
}

export async function saveBrand(input: { name: string; sells: string; audience: string }): Promise<Brand> {
  const existing = await getBrand();
  if (LOCAL) {
    const row: Brand = existing ? { ...existing, ...input } : { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    writeKey("clipwell:brand", row);
    return row;
  }
  const supabase = createClient();
  const q = existing
    ? supabase.from("brands").update(input).eq("id", existing.id).select("*").single()
    : supabase.from("brands").insert(input).select("*").single();
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as Brand;
}

export async function listStyleCards(brandId: string): Promise<StyleCard[]> {
  if (LOCAL) return readKey<StyleCard[]>("clipwell:stylecards", []).filter((c) => c.brand_id === brandId).sort((a, b) => b.version - a.version);
  const supabase = createClient();
  const { data, error } = await supabase.from("style_cards").select("*").eq("brand_id", brandId).order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as StyleCard[];
}

export async function addStyleCard(brandId: string, fields: StyleFields, rules: Rule[], changeNote: string): Promise<StyleCard> {
  const latest = (await listStyleCards(brandId))[0];
  const version = (latest?.version || 0) + 1;
  if (LOCAL) {
    const row: StyleCard = { id: crypto.randomUUID(), brand_id: brandId, version, fields, rules, change_note: changeNote, created_at: new Date().toISOString() };
    writeKey("clipwell:stylecards", [row, ...readKey<StyleCard[]>("clipwell:stylecards", [])]);
    return row;
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("style_cards")
    .insert({ brand_id: brandId, version, fields, rules, change_note: changeNote })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as StyleCard;
}

// ---------- M4: clips ----------
export async function listClips(projectId: string): Promise<Clip[]> {
  if (LOCAL) return readKey<Clip[]>("clipwell:clips", []).filter((c) => c.project_id === projectId).sort((a, b) => a.idx - b.idx);
  const supabase = createClient();
  const { data, error } = await supabase.from("clips").select("*").eq("project_id", projectId).order("idx");
  if (error) throw new Error(error.message);
  return (data || []) as Clip[];
}

export async function replaceClips(projectId: string, clips: Omit<Clip, "id" | "project_id">[]): Promise<Clip[]> {
  if (LOCAL) {
    const others = readKey<Clip[]>("clipwell:clips", []).filter((c) => c.project_id !== projectId);
    const rows: Clip[] = clips.map((c) => ({ ...c, id: crypto.randomUUID(), project_id: projectId, created_at: new Date().toISOString() }));
    writeKey("clipwell:clips", [...others, ...rows]);
    return rows;
  }
  const supabase = createClient();
  const del = await supabase.from("clips").delete().eq("project_id", projectId);
  if (del.error) throw new Error(del.error.message);
  const { data, error } = await supabase
    .from("clips")
    .insert(clips.map((c) => ({ ...c, project_id: projectId })))
    .select("*");
  if (error) throw new Error(error.message);
  return ((data || []) as Clip[]).sort((a, b) => a.idx - b.idx);
}

export async function updateClip(id: string, patch: Partial<Clip>): Promise<void> {
  if (LOCAL) {
    writeKey("clipwell:clips", readKey<Clip[]>("clipwell:clips", []).map((c) => (c.id === id ? { ...c, ...patch } : c)));
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("clips").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- M5/M6: copy versions ----------
export async function listCopyVersions(clipId: string): Promise<CopyVersion[]> {
  if (LOCAL) return readKey<CopyVersion[]>("clipwell:copy", []).filter((c) => c.clip_id === clipId).sort((a, b) => a.version - b.version);
  const supabase = createClient();
  const { data, error } = await supabase.from("copy_versions").select("*").eq("clip_id", clipId).order("version");
  if (error) throw new Error(error.message);
  return (data || []) as CopyVersion[];
}

export async function addCopyVersion(input: Omit<CopyVersion, "id" | "version" | "created_at">): Promise<CopyVersion> {
  const existing = (await listCopyVersions(input.clip_id)).filter((v) => v.platform === input.platform);
  const version = (existing[existing.length - 1]?.version || 0) + 1;
  if (LOCAL) {
    const row: CopyVersion = { ...input, id: crypto.randomUUID(), version, created_at: new Date().toISOString() };
    writeKey("clipwell:copy", [...readKey<CopyVersion[]>("clipwell:copy", []), row]);
    return row;
  }
  const supabase = createClient();
  const { data, error } = await supabase.from("copy_versions").insert({ ...input, version }).select("*").single();
  if (error) throw new Error(error.message);
  return data as CopyVersion;
}

export type { Platform };
