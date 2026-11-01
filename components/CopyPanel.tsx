"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { addCopyVersion, addStyleCard, listCopyVersions, listStyleCards } from "@/lib/store";
import { clipWords } from "@/lib/captions";
import { LANGUAGE_LABEL } from "@/lib/format";
import type { Brand, Clip, CopyLanguage, CopyVersion, Platform, Project, ReelsCopy, ShortsCopy, StyleCard } from "@/lib/types";

const PLATFORM_LABEL: Record<Platform, string> = { shorts: "YouTube Shorts", reels: "Instagram Reels" };

// Older or odd replies may carry a string or nothing where a list is expected: render them safely.
const txt = (x: unknown) => (typeof x === "string" ? x : x == null ? "" : String(x));
const tags = (x: unknown) => (Array.isArray(x) ? x.map(txt).join(" ") : txt(x));
const UNDO = /^Undo to v(\d+)/;

function styleFor(brand: Brand | null, card: StyleCard | null, platform: Platform) {
  return {
    brand: brand?.name,
    sells: brand?.sells,
    audience: brand?.audience,
    tone: card?.fields.tone,
    hookStyle: card?.fields.hookStyle,
    emojisHashtags: card?.fields.emojisHashtags,
    rules: (card?.rules || []).filter((r) => r.active && (r.platform === "all" || r.platform === platform)).map((r) => r.text),
  };
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
  return json as T;
}

export default function CopyPanel({
  clip,
  project,
  brand,
  card,
  onLearned,
}: {
  clip: Clip;
  project: Project;
  brand: Brand | null;
  card: StyleCard | null;
  onLearned: (card: StyleCard) => void;
}) {
  const [versions, setVersions] = useState<CopyVersion[]>([]);
  const [platform, setPlatform] = useState<Platform>("reels");
  const [language, setLanguage] = useState<CopyLanguage>(card?.fields.language || "hinglish");
  const [viewing, setViewing] = useState<Record<Platform, number | null>>({ shorts: null, reels: null });
  const [edit, setEdit] = useState("");
  const [makeRule, setMakeRule] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setVersions([]);
    setViewing({ shorts: null, reels: null });
    listCopyVersions(clip.id).then(setVersions).catch((e) => setError(e.message));
  }, [clip.id]);

  const list = versions.filter((v) => v.platform === platform);
  const latest = list[list.length - 1];
  const shown = list.find((v) => v.version === viewing[platform]) || latest;
  // Undo walks back through real edits: an "Undo to vN" entry counts as being at vN.
  const undoTarget = useMemo(() => {
    if (!latest) return null;
    const m = (latest.instruction || "").match(UNDO);
    const base = m ? list.find((v) => v.version === Number(m[1])) || latest : latest;
    const earlier = list.filter((v) => v.version < base.version && !UNDO.test(v.instruction || ""));
    return earlier[earlier.length - 1] || null;
  }, [list, latest]);
  const text = useMemo(() => clipWords(project.words, clip.start_s, clip.end_s).map((w) => w[0]).join(" "), [project.words, clip]);

  function friendly(e: unknown): string {
    const m = (e as Error).message || "Something went wrong";
    if (m.includes("copy_versions_clip_id_fkey")) return "This clip was replaced when you clicked \u201cFind clips again\u201d. Open a clip from the list above and try again.";
    return m;
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  }

  async function write() {
    setBusy("write");
    setError("");
    try {
      // Each platform is saved on its own, so one failing doesn't hide the other's draft.
      const results = await Promise.allSettled(
        (["shorts", "reels"] as Platform[]).map(async (p) => {
          const { content } = await post<{ content: ShortsCopy | ReelsCopy }>("/api/copy", {
            platform: p,
            language,
            clip: { title: clip.title, hook: clip.hook, reason: clip.reason, text },
            style: styleFor(brand, card, p),
          });
          return addCopyVersion({ clip_id: clip.id, platform: p, content, language, instruction: `First draft in ${LANGUAGE_LABEL[language]}`, made_rule: false });
        }),
      );
      const made = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      setVersions((v) => [...v, ...made]);
      setViewing({ shorts: null, reels: null });
      const failed = results.findIndex((r) => r.status === "rejected");
      if (failed >= 0) {
        const name = failed === 0 ? "YouTube Shorts" : "Instagram Reels";
        setError(`${made.length ? `Only half done: the ${name} copy didn't come back. ` : ""}${friendly((results[failed] as PromiseRejectedResult).reason)}`);
      }
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy("");
    }
  }

  async function applyEdit() {
    if (!shown || !edit.trim()) return;
    setBusy("edit");
    setError("");
    try {
      const out = await post<{ content: ShortsCopy | ReelsCopy; rule: { text: string; platform: "all" | Platform } | null }>("/api/edit", {
        platform,
        language,
        content: shown.content,
        instruction: edit.trim(),
        makeRule: makeRule && Boolean(brand && card),
        style: styleFor(brand, card, platform),
      });
      const v = await addCopyVersion({ clip_id: clip.id, platform, content: out.content, language, instruction: edit.trim(), made_rule: Boolean(out.rule) });
      setVersions((all) => [...all, v]);
      setViewing((s) => ({ ...s, [platform]: null }));
      if (out.rule && brand && card) {
        // Build on the newest card version so rules switched off elsewhere stay off.
        const base = (await listStyleCards(brand.id))[0] || card;
        const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, " ").trim();
        if (base.rules.some((r) => r.active && norm(r.text) === norm(out.rule!.text))) {
          flash(`Already on your style card: ${out.rule.text}`);
          setEdit("");
          return;
        }
        const next = await addStyleCard(
          brand.id,
          base.fields,
          [...base.rules, { id: crypto.randomUUID(), text: out.rule.text, platform: out.rule.platform, active: true, source: `Edit on "${clip.title}"` }],
          `Learned: ${out.rule.text}`,
        );
        onLearned(next);
        flash(`Learned: ${out.rule.text} · style card v${next.version}`);
      }
      setEdit("");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy("");
    }
  }

  async function undo() {
    if (!undoTarget || busy) return;
    const prev = undoTarget;
    setBusy("undo");
    setError("");
    try {
      const v = await addCopyVersion({ clip_id: clip.id, platform, content: prev.content, language: prev.language, instruction: `Undo to v${prev.version}`, made_rule: false });
      setVersions((all) => [...all, v]);
      setViewing((s) => ({ ...s, [platform]: null }));
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy("");
    }
  }

  function asText(v: CopyVersion): string {
    if (v.platform === "shorts") {
      const c = v.content as ShortsCopy;
      return `${txt(c.title)}\n\n${txt(c.description)}\n\n${tags(c.hashtags)}`;
    }
    const c = v.content as ReelsCopy;
    return `${txt(c.caption)}\n\n${tags(c.hashtags)}`;
  }

  async function copy() {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(asText(shown));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy to the clipboard here. Select the text and copy it instead.");
    }
  }

  return (
    <div className="mt-8 border-t border-ink/8 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-ink">Copy for this clip</h3>
        <div className="flex items-center gap-2">
          <select value={language} onChange={(e) => setLanguage(e.target.value as CopyLanguage)} aria-label="Copy language" className="field px-3 py-2 text-sm">
            {(["hinglish", "en", "hi"] as CopyLanguage[]).map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
          </select>
          <button onClick={write} disabled={Boolean(busy)} className="btn-press rounded-full bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
            {busy === "write" ? "Writing…" : latest ? `Rewrite in ${LANGUAGE_LABEL[language].split(" ")[0]}` : "Write Shorts + Reels copy"}
          </button>
        </div>
      </div>

      <div className="mt-4 seg inline-flex" role="tablist">
        {(["reels", "shorts"] as Platform[]).map((p) => (
          <button key={p} role="tab" aria-selected={platform === p} onClick={() => setPlatform(p)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${platform === p ? "seg-on text-teal-800" : "text-stone-600"}`}>
            {PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>

      {shown ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {list.map((v) => (
              <button
                key={v.id}
                onClick={() => setViewing((s) => ({ ...s, [platform]: v.version }))}
                title={v.instruction || ""}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${v.id === shown.id ? "bg-ink text-white" : "chip-soft text-stone-600 hover:bg-cream"}`}
              >
                v{v.version}
                {v.made_rule ? " ★" : ""}
              </button>
            ))}
            {undoTarget && (
              <button onClick={undo} disabled={Boolean(busy)} className="ml-2 text-xs font-semibold text-teal-700 hover:underline disabled:opacity-50">
                {busy === "undo" ? "Undoing…" : `Undo to v${undoTarget.version}`}
              </button>
            )}
          </div>
          {shown.instruction && <p className="mt-2 text-xs text-stone-500">v{shown.version}: {shown.instruction}</p>}
          <div className="relative mt-2 surface-tint p-4 text-sm">
            {shown.platform === "shorts" ? (
              <>
                <p className="font-bold text-ink">{txt((shown.content as ShortsCopy)?.title)}</p>
                <p className="mt-2 whitespace-pre-line text-stone-700">{txt((shown.content as ShortsCopy)?.description)}</p>
                <p className="mt-2 text-teal-700">{tags((shown.content as ShortsCopy)?.hashtags)}</p>
              </>
            ) : (
              <>
                {txt((shown.content as ReelsCopy)?.coverText) && (
                  <p className="mb-2 inline-block rounded-md bg-ink px-2 py-0.5 text-xs font-bold text-white">Cover: {txt((shown.content as ReelsCopy)?.coverText)}</p>
                )}
                <p className="whitespace-pre-line text-stone-800">{txt((shown.content as ReelsCopy)?.caption)}</p>
                <p className="mt-2 text-teal-700">{tags((shown.content as ReelsCopy)?.hashtags)}</p>
              </>
            )}
            <button onClick={copy} className="absolute top-3 right-3 rounded-full chip-soft px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-white">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-4 surface-tint p-4">
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-2 font-medium">
                Tell it what to change
                <span className="rounded-full bg-marigold-soft px-2.5 py-0.5 text-xs font-medium text-marigold-deep">Speak it with Wispr</span>
              </span>
              <textarea rows={2} value={edit} onChange={(e) => setEdit(e.target.value)} placeholder="e.g. Too salesy, drop the emojis, uh, max two hashtags" className="field w-full px-3.5 py-2.5" />
            </label>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={makeRule} onChange={(e) => setMakeRule(e.target.checked)} className="h-4 w-4 accent-teal-700" disabled={!card} />
                Make this a rule for all future copy
                {!card && <span className="text-xs text-stone-500">(set up a style card first)</span>}
              </label>
              <button onClick={applyEdit} disabled={Boolean(busy) || !edit.trim()} className="btn-press rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                {busy === "edit" ? "Applying…" : "Apply edit"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-600">
          No copy yet. Click &ldquo;Write Shorts + Reels copy&rdquo; and it will draft both in your brand&apos;s voice, following your style card.
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {toast &&
        typeof document !== "undefined" &&
        // Rendered on <body> so frosted-glass panels don't trap the fixed position.
        createPortal(
          <div role="status" className="animate-pop fixed right-6 bottom-24 z-50 flex max-w-[calc(100vw-3rem)] items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-2xl">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-marigold" aria-hidden="true" />
            {toast}
          </div>,
          document.body,
        )}
    </div>
  );
}
