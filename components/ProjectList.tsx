"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteProject, listProjects } from "@/lib/store";
import { fmtTime, LANGUAGE_LABEL } from "@/lib/format";
import type { ProjectSummary } from "@/lib/types";

export default function ProjectList() {
  const [rows, setRows] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listProjects().then(setRows).catch((e) => setError(e.message));
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this project? The transcript and clips will be removed.")) return;
    await deleteProject(id);
    setRows((r) => (r || []).filter((p) => p.id !== id));
  }

  return (
    <div className="surface p-6 sm:p-8">
      <h2 className="text-center text-xl font-bold sm:text-2xl">Your projects</h2>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {!rows && !error && <p className="mt-3 text-sm text-stone-500">Loading…</p>}
      {rows && rows.length === 0 && (
        <>
          <p className="mt-2 text-center text-sm text-stone-600">No projects yet. Here&apos;s what happens after your first one:</p>
          <ol className="mt-5 grid gap-4 text-sm sm:grid-cols-5 sm:gap-3">
            {[
              ["Transcript in", "Word-level timings, Hinglish or English."],
              ["Style card", "Set your brand voice once, inside the project."],
              ["Speak a brief", "AI picks clips and says why each one works."],
              ["Export + copy", "9:16 MP4s with captions, Shorts and Reels copy."],
              ["Plan + learn", "Calendar for the week; results tune the next picks."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3 sm:flex-col sm:items-center sm:text-center">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marigold-soft text-sm font-bold text-marigold-deep">{i + 1}</span>
                <span>
                  <span className="font-semibold text-ink">{t}</span>
                  <span className="block text-stone-600">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      <ul className="mt-3 divide-y divide-stone-100">
        {rows?.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3">
            <Link href={`/studio/p/${p.id}`} className="min-w-0 flex-1 hover:text-teal-700">
              <span className="block truncate font-medium">{p.title}</span>
              <span className="text-xs text-stone-500">
                {fmtTime(p.duration_s)} · {LANGUAGE_LABEL[p.language] || p.language} ·{" "}
                {new Date(p.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </span>
            </Link>
            <button onClick={() => remove(p.id)} className="ml-3 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-red-50 hover:text-red-700">
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
