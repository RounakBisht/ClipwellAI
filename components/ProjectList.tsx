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
    <div className="surface p-6">
      <h2 className="text-lg font-semibold">Your projects</h2>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {!rows && !error && <p className="mt-3 text-sm text-stone-500">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="mt-3 text-sm text-stone-500">No projects yet. Upload a video to start.</p>
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
