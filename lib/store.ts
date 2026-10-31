"use client";
// One data layer for the whole app. With Supabase configured it reads and writes the
// signed-in user's rows; in demo mode it keeps everything in this browser's localStorage.
import { DEMO_MODE, SUPABASE_READY } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { NewProject, Project, ProjectSummary } from "@/lib/types";

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
  const { data, error } = await supabase
    .from("projects")
    .insert({
      title: input.title,
      duration_s: input.duration_s,
      language: input.language,
      words: input.words,
      segments: input.segments,
      brief: input.brief ?? null,
      source_name: input.source_name ?? null,
      source_size: input.source_size ?? null,
    })
    .select("*")
    .single();
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
