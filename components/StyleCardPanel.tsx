"use client";
import { useEffect, useState } from "react";
import { addStyleCard, getBrand, listStyleCards, saveBrand } from "@/lib/store";
import { DEFAULT_CAPTION_STYLE } from "@/lib/captions";
import { LANGUAGE_LABEL } from "@/lib/format";
import type { Brand, CopyLanguage, Rule, StyleCard } from "@/lib/types";

const PRESETS = ["Practical and warm", "Bold and playful", "Premium and calm", "Desi and friendly"];

export async function loadStyle(): Promise<{ brand: Brand | null; cards: StyleCard[] }> {
  const brand = await getBrand();
  const cards = brand ? await listStyleCards(brand.id) : [];
  return { brand, cards };
}

export default function StyleCardPanel({ compact = false, refreshKey = 0 }: { compact?: boolean; refreshKey?: number }) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [cards, setCards] = useState<StyleCard[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({ name: "", sells: "", audience: "", tonePreset: PRESETS[0], seedCaptions: "", language: "hinglish" as CopyLanguage });

  useEffect(() => {
    loadStyle()
      .then(({ brand, cards }) => {
        setBrand(brand);
        setCards(cards);
      })
      .catch((e) => setError(e.message));
  }, [refreshKey]);

  async function create() {
    if (!form.name.trim()) return setError("Add your brand name first.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/style-card", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Couldn't build the style card (${res.status}).`);
      const b = await saveBrand({ name: form.name.trim(), sells: form.sells.trim(), audience: form.audience.trim() });
      const card = await addStyleCard(
        b.id,
        {
          tone: json.tone,
          hookStyle: json.hookStyle,
          emojisHashtags: json.emojisHashtags,
          language: form.language,
          captionLook: { ...DEFAULT_CAPTION_STYLE, highlightColor: json.highlightColor },
        },
        [],
        form.seedCaptions.trim() ? "Created from your past captions" : `Created from the "${form.tonePreset}" preset`,
      );
      setBrand(b);
      setCards([card]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(rule: Rule) {
    if (!brand || !cards?.[0]) return;
    const cur = cards[0];
    const rules = cur.rules.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r));
    const card = await addStyleCard(brand.id, cur.fields, rules, `${rule.active ? "Turned off" : "Turned on"}: ${rule.text}`);
    setCards([card, ...cards]);
  }

  const shell = "surface p-6";
  if (cards === null) return <div className={shell}><p className="text-sm text-stone-500">{error || "Loading style card…"}</p></div>;

  const card = cards[0];
  if (!card) {
    return (
      <div className={shell}>
        <h2 className="text-lg font-semibold">Set up your style card</h2>
        <p className="mt-1 text-sm text-stone-600">One minute, once. Every clip and caption follows it, and it learns from your edits.</p>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block text-sm"><span className="mb-1 block font-medium">Brand name</span><input className="field w-full px-3.5 py-2.5" placeholder="e.g. IFFCO Urban Gardens" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">What you sell</span><input className="field w-full px-3.5 py-2.5" placeholder="e.g. potting mix and plant food" value={form.sells} onChange={(e) => setForm({ ...form, sells: e.target.value })} /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">Audience</span><input className="field w-full px-3.5 py-2.5" placeholder="e.g. new plant parents in metros" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block font-medium">Tone</span>
              <select className="field w-full px-3.5 py-2.5" value={form.tonePreset} onChange={(e) => setForm({ ...form, tonePreset: e.target.value })}>
                {PRESETS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block font-medium">Language</span>
              <select className="field w-full px-3.5 py-2.5" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as CopyLanguage })}>
                {(["hinglish", "en", "hi"] as CopyLanguage[]).map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block font-medium">Optional: paste 1 to 3 captions from past Reels you liked</span>
            <textarea rows={3} className="field w-full px-3.5 py-2.5" placeholder="The AI reads these to match your voice from day one." value={form.seedCaptions} onChange={(e) => setForm({ ...form, seedCaptions: e.target.value })} />
          </label>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button onClick={create} disabled={busy} className="btn-press mt-4 w-full rounded-full bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
          {busy ? "Building your style card…" : "Create style card"}
        </button>
      </div>
    );
  }

  const f = card.fields;
  const prev = cards[1];
  const changed = (k: keyof typeof f) => prev && JSON.stringify(prev.fields[k]) !== JSON.stringify(f[k]);
  const rows: [keyof typeof f, string, string][] = [
    ["tone", "Tone", f.tone],
    ["hookStyle", "Hook style", f.hookStyle],
    ["emojisHashtags", "Emojis and hashtags", f.emojisHashtags],
    ["language", "Language", LANGUAGE_LABEL[f.language] || f.language],
  ];
  return (
    <div className={shell}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Style card</h2>
        <button onClick={() => setShowHistory(!showHistory)} className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 hover:bg-teal-100">
          v{card.version} {cards.length > 1 ? `· ${showHistory ? "hide" : "history"}` : ""}
        </button>
      </div>
      <p className="mt-0.5 text-xs text-stone-500">{brand?.name}</p>
      <dl className="mt-3 divide-y divide-ink/8 text-sm">
        {rows.map(([k, label, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2">
            <dt className="shrink-0 text-stone-500">{label}</dt>
            <dd className={`text-right font-medium ${changed(k) ? "rounded-md bg-marigold-soft px-1.5 text-marigold-deep" : ""}`}>{v}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="text-stone-500">Caption look</dt>
          <dd className="rounded-md bg-ink px-2 py-0.5 font-caption text-sm font-extrabold text-white">
            word <span style={{ color: f.captionLook.highlightColor }}>by</span> word
          </dd>
        </div>
      </dl>
      {(!compact || card.rules.length > 0) && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Learned rules</h3>
          {card.rules.length === 0 ? (
            <p className="mt-1 text-xs text-stone-500">None yet. When you edit copy by voice and tick &ldquo;Make this a rule&rdquo;, it lands here.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {card.rules.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className={`${r.active ? "" : "text-stone-400 line-through"} ${prev && !prev.rules.some((p) => p.id === r.id) ? "animate-pop rounded-md bg-marigold-soft px-1.5 text-marigold-deep" : ""}`}>
                    {r.text}
                    {r.platform !== "all" && <span className="ml-1 text-xs text-stone-500">({r.platform === "shorts" ? "Shorts" : "Reels"})</span>}
                  </span>
                  <button onClick={() => toggleRule(r)} className="shrink-0 text-xs text-teal-700 hover:underline">{r.active ? "Turn off" : "Turn on"}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {showHistory && (
        <ol className="mt-4 space-y-1 border-t border-ink/8 pt-3 text-xs text-stone-600">
          {cards.map((c) => (
            <li key={c.id}>
              <span className="font-semibold">v{c.version}</span> · {c.change_note || "Updated"}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
