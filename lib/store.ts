"use client";
// One data layer for the whole app. With Supabase configured it reads and writes the
// signed-in user's rows; in demo mode it keeps everything in this browser's localStorage.
import { DEMO_MODE, SUPABASE_READY } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { Brand, Clip, CopyVersion, NewProject, PlanSlot, Platform, Project, ProjectSummary, Rule, StyleCard, StyleFields } from "@/lib/types";

const LOCAL = DEMO_MODE || !SUPABASE_READY;

// Database errors in words a user can act on.
function fail(e: { message: string; code?: string }): Error {
  const m = e.message || "Something went wrong";
  if (/row-level security|jwt|not authenticated|invalid.*token|refresh token/i.test(m))
    return new Error("Your session has expired. Sign out and sign in again, then retry.");
  if (/failed to fetch|network/i.test(m)) return new Error("Couldn't reach the server. Check your connection and try again.");
  return new Error(m);
}
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
  if (error) throw fail(error);
  return (data || []) as ProjectSummary[];
}

export async function getProject(id: string): Promise<Project | null> {
  if (LOCAL) return readLocal().find((p) => p.id === id) || null;
  const supabase = createClient();
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw fail(error);
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
  if (error) throw fail(error);
  return data as Project;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  if (LOCAL) {
    writeLocal(readLocal().map((p) => (p.id === id ? { ...p, ...patch } : p)));
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) throw fail(error);
}

export async function deleteProject(id: string): Promise<void> {
  if (LOCAL) {
    writeLocal(readLocal().filter((p) => p.id !== id));
    const clipIds = readKey<Clip[]>("clipwell:clips", []).filter((c) => c.project_id === id).map((c) => c.id);
    writeKey("clipwell:clips", readKey<Clip[]>("clipwell:clips", []).filter((c) => c.project_id !== id));
    writeKey("clipwell:copy", readKey<CopyVersion[]>("clipwell:copy", []).filter((c) => !clipIds.includes(c.clip_id)));
    writeKey("clipwell:plan", readKey<PlanSlot[]>("clipwell:plan", []).filter((c) => !clipIds.includes(c.clip_id)));
    localStorage.removeItem(`clipwell:projectBrand:${id}`);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw fail(error);
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
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Could not save to this browser", e);
    throw new Error("This browser's storage is full. Delete an old project and try again.");
  }
}

// ---------- Style cards: one brand row per named style card; the default is remembered per browser ----------
const DEFAULT_KEY = "clipwell:defaultBrand";
function readLocalBrands(): Brand[] {
  const many = readKey<Brand[] | null>("clipwell:brands", null);
  if (many) return many;
  const one = readKey<Brand | null>("clipwell:brand", null);
  return one ? [one] : [];
}

export function getDefaultBrandId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEFAULT_KEY);
}
export function setDefaultBrandId(id: string) {
  window.localStorage.setItem(DEFAULT_KEY, id);
}

// Which style card a project uses (falls back to the default card).
export function getProjectBrandId(projectId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`clipwell:projectBrand:${projectId}`);
}
export function setProjectBrandId(projectId: string, brandId: string) {
  window.localStorage.setItem(`clipwell:projectBrand:${projectId}`, brandId);
  if (!LOCAL) {
    const supabase = createClient();
    supabase.from("projects").update({ brand_id: brandId }).eq("id", projectId).then(({ error }) => {
      if (error) console.warn("Couldn't save the project's style card choice", error.message);
    });
  }
}

export async function listBrands(): Promise<Brand[]> {
  if (LOCAL) return readLocalBrands();
  const supabase = createClient();
  const { data, error } = await supabase.from("brands").select("*").order("created_at");
  if (error) throw fail(error);
  return (data || []) as Brand[];
}

// The default style card's brand (falls back to the first one created).
export async function getBrand(): Promise<Brand | null> {
  const all = await listBrands();
  const id = getDefaultBrandId();
  return all.find((b) => b.id === id) || all[0] || null;
}

export async function createBrand(input: { name: string; sells: string; audience: string }): Promise<Brand> {
  if (LOCAL) {
    const row: Brand = { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    writeKey("clipwell:brands", [...readLocalBrands(), row]);
    return row;
  }
  const supabase = createClient();
  const { data, error } = await supabase.from("brands").insert(input).select("*").single();
  if (error) throw fail(error);
  return data as Brand;
}

export async function updateBrand(id: string, patch: Partial<Pick<Brand, "name" | "sells" | "audience">>): Promise<Brand> {
  if (LOCAL) {
    const rows = readLocalBrands().map((b) => (b.id === id ? { ...b, ...patch } : b));
    writeKey("clipwell:brands", rows);
    return rows.find((b) => b.id === id)!;
  }
  const supabase = createClient();
  const { data, error } = await supabase.from("brands").update(patch).eq("id", id).select("*").single();
  if (error) throw fail(error);
  return data as Brand;
}

export async function saveBrand(input: { name: string; sells: string; audience: string }): Promise<Brand> {
  const existing = await getBrand();
  return existing ? updateBrand(existing.id, input) : createBrand(input);
}

export async function listStyleCards(brandId: string): Promise<StyleCard[]> {
  if (LOCAL) return readKey<StyleCard[]>("clipwell:stylecards", []).filter((c) => c.brand_id === brandId).sort((a, b) => b.version - a.version);
  const supabase = createClient();
  const { data, error } = await supabase.from("style_cards").select("*").eq("brand_id", brandId).order("version", { ascending: false });
  if (error) throw fail(error);
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
  let v = version;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("style_cards")
      .insert({ brand_id: brandId, version: v, fields, rules, change_note: changeNote })
      .select("*")
      .single();
    if (!error) return data as StyleCard;
    if (error.code !== "23505") throw fail(error);
    v = ((await listStyleCards(brandId))[0]?.version || v) + 1;
  }
  throw new Error("Couldn't save the style card. Please try again.");
}

// ---------- M4: clips ----------
export async function listClips(projectId: string): Promise<Clip[]> {
  if (LOCAL) return readKey<Clip[]>("clipwell:clips", []).filter((c) => c.project_id === projectId).sort((a, b) => a.idx - b.idx);
  const supabase = createClient();
  const { data, error } = await supabase.from("clips").select("*").eq("project_id", projectId).order("idx");
  if (error) throw fail(error);
  return (data || []) as Clip[];
}

// "Find clips again": a clip with the same range keeps its id, so its copy, calendar posts and results survive.
// New clips are saved before old ones are removed, so a failure never leaves the project empty.
export async function replaceClips(projectId: string, clips: Omit<Clip, "id" | "project_id">[]): Promise<Clip[]> {
  const old = await listClips(projectId);
  const same = (a: { start_s: number; end_s: number }, b: { start_s: number; end_s: number }) => Math.abs(a.start_s - b.start_s) < 0.5 && Math.abs(a.end_s - b.end_s) < 0.5;
  const kept = new Set<string>();
  const plan = clips.map((c) => {
    const match = old.find((o) => !kept.has(o.id) && same(o, c));
    if (match) kept.add(match.id);
    return { c, match };
  });
  const removed = old.filter((o) => !kept.has(o.id)).map((o) => o.id);
  if (LOCAL) {
    const others = readKey<Clip[]>("clipwell:clips", []).filter((c) => c.project_id !== projectId);
    const rows: Clip[] = plan.map(({ c, match }) =>
      match ? { ...match, ...c, id: match.id, project_id: projectId } : { ...c, id: crypto.randomUUID(), project_id: projectId, created_at: new Date().toISOString() },
    );
    writeKey("clipwell:clips", [...others, ...rows]);
    writeKey("clipwell:copy", readKey<CopyVersion[]>("clipwell:copy", []).filter((v) => !removed.includes(v.clip_id)));
    writeKey("clipwell:plan", readKey<PlanSlot[]>("clipwell:plan", []).filter((v) => !removed.includes(v.clip_id)));
    return rows.sort((a, b) => a.idx - b.idx);
  }
  const supabase = createClient();
  const fresh = plan.filter((x) => !x.match).map(({ c }) => ({ ...c, project_id: projectId }));
  let inserted: Clip[] = [];
  if (fresh.length) {
    const { data, error } = await supabase.from("clips").insert(fresh).select("*");
    if (error) throw fail(error);
    inserted = (data || []) as Clip[];
  }
  for (const { c, match } of plan) {
    if (!match) continue;
    const { error } = await supabase.from("clips").update({ idx: c.idx, title: c.title, hook: c.hook, reason: c.reason, score: c.score }).eq("id", match.id);
    if (error) throw fail(error);
  }
  if (removed.length) {
    const del = await supabase.from("clips").delete().in("id", removed);
    if (del.error) throw fail(del.error);
  }
  return [...plan.filter((x) => x.match).map(({ c, match }) => ({ ...match!, ...c, id: match!.id })), ...inserted].sort((a, b) => a.idx - b.idx);
}

// How much would "Find clips again" throw away? (copy, calendar posts or logged results on clips that may change)
export async function clipWorkExists(projectId: string): Promise<boolean> {
  const clips = await listClips(projectId);
  if (!clips.length) return false;
  if (clips.some((c) => c.outcome)) return true;
  if ((await listPlanSlots(clips.map((c) => c.id))).length) return true;
  for (const c of clips) if ((await listCopyVersions(c.id)).length) return true;
  return false;
}

export async function updateClip(id: string, patch: Partial<Clip>): Promise<void> {
  if (LOCAL) {
    writeKey("clipwell:clips", readKey<Clip[]>("clipwell:clips", []).map((c) => (c.id === id ? { ...c, ...patch } : c)));
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("clips").update(patch).eq("id", id);
  if (error) throw fail(error);
}

// ---------- M5/M6: copy versions ----------
export async function listCopyVersions(clipId: string): Promise<CopyVersion[]> {
  if (LOCAL) return readKey<CopyVersion[]>("clipwell:copy", []).filter((c) => c.clip_id === clipId).sort((a, b) => a.version - b.version);
  const supabase = createClient();
  const { data, error } = await supabase.from("copy_versions").select("*").eq("clip_id", clipId).order("version");
  if (error) throw fail(error);
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
  if (error) throw fail(error);
  return data as CopyVersion;
}

// ---------- M7: content calendar ----------
export async function listPlanSlots(clipIds: string[]): Promise<PlanSlot[]> {
  if (!clipIds.length) return [];
  if (LOCAL) return readKey<PlanSlot[]>("clipwell:plan", []).filter((s) => clipIds.includes(s.clip_id)).sort((a, b) => a.day.localeCompare(b.day));
  const supabase = createClient();
  const { data, error } = await supabase.from("plan_slots").select("*").in("clip_id", clipIds).order("day");
  if (error) throw fail(error);
  return (data || []) as PlanSlot[];
}

export async function replacePlanSlots(clipIds: string[], rows: Omit<PlanSlot, "id">[]): Promise<PlanSlot[]> {
  if (LOCAL) {
    const others = readKey<PlanSlot[]>("clipwell:plan", []).filter((s) => !clipIds.includes(s.clip_id));
    const made = rows.map((r) => ({ ...r, id: crypto.randomUUID() }));
    writeKey("clipwell:plan", [...others, ...made]);
    return made;
  }
  const supabase = createClient();
  if (clipIds.length) {
    const del = await supabase.from("plan_slots").delete().in("clip_id", clipIds);
    if (del.error) throw fail(del.error);
  }
  if (!rows.length) return [];
  const { data, error } = await supabase.from("plan_slots").insert(rows).select("*");
  if (error) throw fail(error);
  return ((data || []) as PlanSlot[]).sort((a, b) => a.day.localeCompare(b.day));
}

export type { Platform };
