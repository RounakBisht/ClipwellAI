"use client";
import { useEffect, useState } from "react";

const SEEN_KEY = "clipwell:counted";

// Small "N visitors" pill for the footer. Counts each browser once; hides itself if the counter can't be reached.
export default function VisitorCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocked: treat as a new visit */
    }
    fetch("/api/visits", { method: seen ? "GET" : "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { value?: number } | null) => {
        if (!j || typeof j.value !== "number") return;
        if (!seen) {
          try {
            window.localStorage.setItem(SEEN_KEY, "1");
          } catch {
            /* ignore */
          }
        }
        if (live && j.value > 0) setCount(j.value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="mt-4 flex h-7 justify-center">
      {count !== null && (
        <span
          className="visitor-pill inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/75 px-3 py-1 text-xs font-medium text-stone-600 shadow-[0_6px_16px_-10px_rgba(23,38,42,.35)]"
          title="Counted once per browser"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-teal-600" aria-hidden="true" />
          <span className="tabular-nums font-semibold text-ink">{count.toLocaleString("en-IN")}</span>
          {count === 1 ? "visitor" : "visitors"}
        </span>
      )}
    </div>
  );
}
