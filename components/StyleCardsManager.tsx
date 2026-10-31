"use client";
// Studio: all your style cards. Default card sits first; click one to see and edit it; add as many as you like.
import { useEffect, useState } from "react";
import { IconCheck, IconPencil, IconPlus, IconStar, IconStarFilled, IconX } from "@tabler/icons-react";
import { addStyleCard, createBrand, getDefaultBrandId, listBrands, listStyleCards, setDefaultBrandId, updateBrand } from "@/lib/store";
import { DEFAULT_CAPTION_STYLE } from "@/lib/captions";
import { LANGUAGE_LABEL } from "@/lib/format";
import type { Brand, CopyLanguage, Rule, StyleCard, StyleFields } from "@/lib/types";

const PRESETS = ["Practical and warm", "Bold and playful", "Premium and calm", "Desi and friendly"];
type Entry = { brand: Brand; cards: StyleCard[] };

export default function StyleCardsManager({
  initialOpen = null,
  initialCreate = false,
  currentId = null,
  onChanged,
  onUse,
}: {
  initialOpen?: string | null;
  initialCreate?: boolean;
  currentId?: string | null;
  onChanged?: () => void;
  onUse?: (brandId: string) => void;
} = {}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialCreate ? null : initialOpen);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(initialCreate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", sells: "", audience: "", tonePreset: PRESETS[0], seedCaptions: "", language: "hinglish" as CopyLanguage });
  const [draft, setDraft] = useState<{ name: string; fields: StyleFields } | null>(null);

  async function load() {
    const brands = await listBrands();
    const list = await Promise.all(brands.map(async (brand) => ({ brand, cards: await listStyleCards(brand.id) })));
    const d = getDefaultBrandId() || list[0]?.brand.id || null;
    setDefaultId(d);
    setEntries(list.filter((e) => e.cards.length));
    onChanged?.();
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const sorted = entries ? [...entries].sort((a, b) => (a.brand.id === defaultId ? -1 : b.brand.id === defaultId ? 1 : a.brand.created_at.localeCompare(b.brand.created_at))) : [];
  const open = sorted.find((e) => e.brand.id === openId) || null;

  function makeDefault(id: string) {
    setDefaultBrandId(id);
    setDefaultId(id);
  }

  async function create() {
    if (!form.name.trim()) return setError("Give this style card a name first.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/style-card", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Couldn't build the style card (${res.status}).`);
      const b = await createBrand({ name: form.name.trim(), sells: form.sells.trim(), audience: form.audience.trim() });
      await addStyleCard(
        b.id,
        { tone: json.tone, hookStyle: json.hookStyle, emojisHashtags: json.emojisHashtags, language: form.language, captionLook: { ...DEFAULT_CAPTION_STYLE, highlightColor: json.highlightColor } },
        [],
        form.seedCaptions.trim() ? "Created from your past captions" : `Created from the "${form.tonePreset}" preset`,
      );
      if (!sorted.length || !getDefaultBrandId()) makeDefault(b.id);
      setCreating(false);
      setForm({ ...form, name: "", sells: "", audience: "", seedCaptions: "" });
      await load();
      setOpenId(b.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!open || !draft) return;
    setBusy(true);
    setError("");
    try {
      if (draft.name.trim() && draft.name.trim() !== open.brand.name) await updateBrand(open.brand.id, { name: draft.name.trim() });
      await addStyleCard(open.brand.id, draft.fields, open.cards[0].rules, "Edited by hand");
      setEditing(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(r: Rule) {
    if (!open) return;
    const cur = open.cards[0];
    await addStyleCard(open.brand.id, cur.fields, cur.rules.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)), `${r.active ? "Turned off" : "Turned on"}: ${r.text}`);
    await load();
  }

  return (
    <section id="style-cards" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink">Style cards</h2>
          <p className="text-sm text-stone-600">One per brand or client. Projects use the default card unless you pick another.</p>
        </div>
        <button
          onClick={() => {
            setCreating(true);
            setOpenId(null);
            setEditing(false);
          }}
          className="btn-press inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" /> New style card
        </button>
      </div>

      {entries === null && <p className="mt-4 text-sm text-stone-600">{error || "Loading style cards…"}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map(({ brand, cards }) => {
          const c = cards[0];
          const isDefault = brand.id === defaultId;
          const isOpen = brand.id === openId;
          return (
            <button
              key={brand.id}
              onClick={() => {
                setOpenId(isOpen ? null : brand.id);
                setEditing(false);
                setCreating(false);
              }}
              aria-expanded={isOpen}
              className={`lift surface p-5 text-left transition ${isOpen ? "shadow-[0_0_0_2.5px_#0f766e,0_26px_50px_-30px_rgba(16,60,56,.38)]" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-base font-semibold text-ink">{brand.name}</span>
                {isDefault ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-marigold px-2 py-0.5 text-[11px] font-bold text-ink">
                    <IconStarFilled size={11} aria-hidden="true" /> Default
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-stone-600">v{c.version}</span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-stone-600">{c.fields.tone}</p>
              <p className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-800">{LANGUAGE_LABEL[c.fields.language] || c.fields.language}</span>
                <span className="rounded-full bg-marigold-soft px-2 py-0.5 text-marigold-deep">{c.rules.filter((r) => r.active).length} rules</span>
                {isDefault && <span className="rounded-full bg-ink/5 px-2 py-0.5 text-stone-600">v{c.version}</span>}
              </p>
            </button>
          );
        })}
        {entries !== null && !sorted.length && !creating && (
          <button onClick={() => setCreating(true)} className="surface flex min-h-[132px] items-center justify-center gap-2 p-5 font-semibold text-teal-800 hover:bg-white">
            <IconPlus size={18} aria-hidden="true" /> Create your first style card
          </button>
        )}
      </div>

      {error && entries !== null && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {creating && (
        <div className="animate-pop surface mt-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">New style card</h3>
            <button aria-label="Close" onClick={() => setCreating(false)} className="rounded-full p-1.5 text-stone-500 hover:bg-ink/5"><IconX size={18} /></button>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <label className="block"><span className="mb-1 block font-medium">Style card name</span><input className="field w-full px-3.5 py-2.5" placeholder="e.g. IFFCO Urban Gardens" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block font-medium">What you sell</span><input className="field w-full px-3.5 py-2.5" placeholder="e.g. potting mix and plant food" value={form.sells} onChange={(e) => setForm({ ...form, sells: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block font-medium">Audience</span><input className="field w-full px-3.5 py-2.5" placeholder="e.g. new plant parents in metros" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block font-medium">Tone</span>
              <select className="field w-full px-3.5 py-2.5" value={form.tonePreset} onChange={(e) => setForm({ ...form, tonePreset: e.target.value })}>{PRESETS.map((p) => <option key={p}>{p}</option>)}</select>
            </label>
            <label className="block"><span className="mb-1 block font-medium">Language</span>
              <select className="field w-full px-3.5 py-2.5" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as CopyLanguage })}>
                {(["hinglish", "en", "hi"] as CopyLanguage[]).map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-3"><span className="mb-1 block font-medium">Optional: paste 1 to 3 captions from past Reels you liked</span>
              <textarea rows={2} className="field w-full px-3.5 py-2.5" placeholder="The AI reads these to match your voice from day one." value={form.seedCaptions} onChange={(e) => setForm({ ...form, seedCaptions: e.target.value })} />
            </label>
          </div>
          <button onClick={create} disabled={busy} className="btn-press mt-4 rounded-full bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
            {busy ? "Building your style card…" : "Create style card"}
          </button>
        </div>
      )}

      {open && !creating && (
        <div className="animate-pop surface mt-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold">{open.brand.name}</h3>
              <p className="text-xs text-stone-600">v{open.cards[0].version} · {open.cards[0].change_note || "Updated"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onUse && open.brand.id !== currentId && (
                <button onClick={() => onUse(open.brand.id)} className="btn-press rounded-full bg-teal-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-teal-800">
                  Use for this project
                </button>
              )}
              {open.brand.id !== defaultId ? (
                <button onClick={() => makeDefault(open.brand.id)} className="btn-press inline-flex items-center gap-1.5 rounded-full bg-marigold-soft px-3.5 py-1.5 text-sm font-semibold text-marigold-deep hover:bg-marigold/30">
                  <IconStar size={15} aria-hidden="true" /> Set as default
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-marigold px-3.5 py-1.5 text-sm font-bold text-ink"><IconStarFilled size={14} aria-hidden="true" /> Default</span>
              )}
              {!editing ? (
                <button
                  onClick={() => {
                    setDraft({ name: open.brand.name, fields: { ...open.cards[0].fields, captionLook: { ...open.cards[0].fields.captionLook } } });
                    setEditing(true);
                  }}
                  className="btn-press inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  <IconPencil size={15} aria-hidden="true" /> Edit
                </button>
              ) : (
                <>
                  <button onClick={() => setEditing(false)} className="rounded-full bg-ink/5 px-3.5 py-1.5 text-sm font-semibold hover:bg-ink/10">Cancel</button>
                  <button onClick={saveEdit} disabled={busy} className="btn-press inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                    <IconCheck size={15} aria-hidden="true" /> {busy ? "Saving…" : "Save as new version"}
                  </button>
                </>
              )}
            </div>
          </div>

          {!editing || !draft ? (
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <dl className="divide-y divide-ink/8 text-sm">
                {(
                  [
                    ["Tone", open.cards[0].fields.tone],
                    ["Hook style", open.cards[0].fields.hookStyle],
                    ["Emojis and hashtags", open.cards[0].fields.emojisHashtags],
                    ["Language", LANGUAGE_LABEL[open.cards[0].fields.language] || open.cards[0].fields.language],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="shrink-0 text-stone-600">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-stone-600">Caption look</dt>
                  <dd className="rounded-md bg-ink px-2 py-0.5 font-caption text-sm font-extrabold text-white" style={{ textTransform: open.cards[0].fields.captionLook.uppercase ? "uppercase" : "none" }}>
                    word <span style={{ color: open.cards[0].fields.captionLook.highlightColor }}>by</span> word · {open.cards[0].fields.captionLook.wordsPerLine}/line
                  </dd>
                </div>
              </dl>
              <div>
                <h4 className="text-sm font-semibold">Learned rules</h4>
                {open.cards[0].rules.length === 0 ? (
                  <p className="mt-1 text-sm text-stone-600">None yet. Edit copy by voice with &ldquo;Make this a rule&rdquo; ticked and they land here.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {open.cards[0].rules.map((r) => (
                      <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                        <span className={r.active ? "" : "text-stone-500 line-through"}>
                          {r.text}
                          {r.platform !== "all" && <span className="ml-1 text-xs text-stone-500">({r.platform === "shorts" ? "Shorts" : "Reels"})</span>}
                        </span>
                        <button onClick={() => toggleRule(r)} className="shrink-0 text-xs font-semibold text-teal-800 hover:underline">{r.active ? "Turn off" : "Turn on"}</button>
                      </li>
                    ))}
                  </ul>
                )}
                {(open.cards[0].fields.learnings || []).length > 0 && (
                  <>
                    <h4 className="mt-4 text-sm font-semibold">From your results</h4>
                    <ul className="mt-1 space-y-1 text-sm text-stone-700">
                      {open.cards[0].fields.learnings!.slice(-4).map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <label className="block"><span className="mb-1 block font-medium">Name</span><input className="field w-full px-3.5 py-2.5" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block font-medium">Language</span>
                <select className="field w-full px-3.5 py-2.5" value={draft.fields.language} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, language: e.target.value as CopyLanguage } })}>
                  {(["hinglish", "en", "hi"] as CopyLanguage[]).map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
                </select>
              </label>
              <label className="block sm:col-span-2"><span className="mb-1 block font-medium">Tone</span><input className="field w-full px-3.5 py-2.5" value={draft.fields.tone} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, tone: e.target.value } })} /></label>
              <label className="block sm:col-span-2"><span className="mb-1 block font-medium">Hook style</span><input className="field w-full px-3.5 py-2.5" value={draft.fields.hookStyle} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, hookStyle: e.target.value } })} /></label>
              <label className="block sm:col-span-2"><span className="mb-1 block font-medium">Emojis and hashtags</span><input className="field w-full px-3.5 py-2.5" value={draft.fields.emojisHashtags} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, emojisHashtags: e.target.value } })} /></label>
              <label className="block"><span className="mb-1 block font-medium">Caption words per line</span>
                <select className="field w-full px-3.5 py-2.5" value={draft.fields.captionLook.wordsPerLine} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, captionLook: { ...draft.fields.captionLook, wordsPerLine: Number(e.target.value) } } })}>
                  {[2, 3, 4].map((n) => <option key={n} value={n}>{n} words</option>)}
                </select>
              </label>
              <div className="flex items-end gap-4">
                <label className="block"><span className="mb-1 block font-medium">Highlight</span>
                  <input type="color" className="h-[42px] w-16 cursor-pointer rounded-xl bg-transparent" value={draft.fields.captionLook.highlightColor} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, captionLook: { ...draft.fields.captionLook, highlightColor: e.target.value } } })} />
                </label>
                <label className="mb-3 inline-flex items-center gap-2 font-medium">
                  <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={draft.fields.captionLook.uppercase} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, captionLook: { ...draft.fields.captionLook, uppercase: e.target.checked } } })} />
                  UPPERCASE captions
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
