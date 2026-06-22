"use client";

import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  checkHandleAvailabilityAction,
  finishOnboardingAction,
  type HandleAvailability,
  type LocalAccountSuggestion,
  type OnboardingState,
  searchLocalAccountsAction,
} from "@/app/actions/onboarding";
import { useActionMessage, useT } from "@/components/I18nProvider";
import type { OnboardingItemType, PackView } from "@/lib/onboarding-packs";

// ─── Types ────────────────────────────────────────────────────────
type Level = "debutant" | "initie";
type AddrUi = HandleAvailability | "checking";
interface SelectedSource {
  id: string;
  type: OnboardingItemType;
  label: string;
  ref: string;
}

const DOT_COLORS = [
  "#7c3a4b",
  "#3F6F8F",
  "#406B4A",
  "#7E5C8E",
  "#6b6b6b",
  "#632e3b",
  "#5A7A3A",
];
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DOT_COLORS[h % DOT_COLORS.length];
}
function initialOf(n: string): string {
  return (
    n
      .trim()
      .split(/\s+/)
      .map((p) => p[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// ─── Icônes ───────────────────────────────────────────────────────
const ArrowR = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h10" /><path d="M9 4l4 4-4 4" />
  </svg>
);
const ArrowL = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 8H3" /><path d="M7 4 3 8l4 4" />
  </svg>
);
const CheckMini = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8.5 6.5 12 13 4.5" />
  </svg>
);
const CrossMini = () => (
  <svg viewBox="0 0 16 16" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
const CameraMini = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 5.5h2l1-1.5h6l1 1.5h2v8H2z" /><circle cx="8" cy="9" r="2.4" />
  </svg>
);

function SourceGlyph({ type, size = 11 }: { type: OnboardingItemType; size?: number }) {
  const c = { marge: "#7c3a4b", fediverse: "#6b5a6b", rss: "#6b6b6b", youtube: "#632e3b" }[type];
  if (type === "rss")
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="3.5" cy="12.5" r="1.8" fill={c} />
        <path d="M2 7.5a6.5 6.5 0 0 1 6.5 6.5" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M2 3a11 11 0 0 1 11 11" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  if (type === "youtube")
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="3" width="14" height="10" rx="3" fill={c} />
        <path d="M6.7 5.8 10.5 8l-3.8 2.2z" fill="#fff" />
      </svg>
    );
  if (type === "fediverse")
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.4" stroke={c} strokeWidth="1.6" fill="none" />
        <circle cx="8" cy="3.4" r="1.5" fill={c} />
        <circle cx="3.8" cy="10.6" r="1.5" fill={c} />
        <circle cx="12.2" cy="10.6" r="1.5" fill={c} />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" stroke={c} strokeWidth="1.6" fill="none" />
      <circle cx="8" cy="8" r="2.6" fill={c} />
    </svg>
  );
}

// ─── Détection d'une source ajoutée manuellement ──────────────────
function detectManualSource(
  raw: string,
  instanceDomain: string,
): SelectedSource | null {
  const v = raw.trim();
  if (!v) return null;
  const low = v.toLowerCase();
  let type: OnboardingItemType = "rss";
  let label = v;
  let ref = v;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (/^@[^@\s]+@[^@\s]+/.test(v)) {
    const inst = v.split("@")[2] || "";
    type = inst.toLowerCase() === instanceDomain.toLowerCase() ? "marge" : "fediverse";
    label = cap(v.split("@")[1]);
    ref = v;
  } else if (/youtu\.?be|youtube\.com/.test(low)) {
    type = "youtube";
    ref = v;
    label = cap((v.match(/@([\w.-]+)/) || [, "YouTube"])[1] as string);
  } else if (/^@[^@\s]+$/.test(v)) {
    type = "marge";
    label = cap(v.slice(1));
    ref = `${v}@${instanceDomain}`;
  } else {
    type = "rss";
    const host = v.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    label = cap(host.split(".")[0] || host);
    ref = v;
  }
  return { id: `manual-${ref}`, type, label, ref };
}

// ─── Briques partagées ────────────────────────────────────────────
function WhyCard({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <aside className="wz-why" role="note">
      <span className="wz-why-tag">{t.onboarding.whyTag}</span>
      <p className="wz-why-txt">{children}</p>
    </aside>
  );
}

// `level` change → remontage via `key` (cf. appels), pas de setState en effet.
function Tip({ level, label, children }: { level: Level; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(level === "debutant");
  return (
    <div className={"wz-tip" + (open ? " is-open" : "")}>
      <button type="button" className="wz-tip-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="wz-tip-q" aria-hidden="true">?</span>
        <span className="wz-tip-label">{label}</span>
        <span className="wz-tip-chev" aria-hidden="true">▾</span>
      </button>
      {open && <p className="wz-tip-body">{children}</p>}
    </div>
  );
}

function PreviewFrame({ label, sub, scroll, children }: { label: string; sub?: string; scroll?: boolean; children: React.ReactNode }) {
  return (
    <section className="wz-preview" aria-label={label}>
      <header className="wz-preview-hd">
        <span className="wz-preview-tag">{label}</span>
        {sub && <span className="wz-preview-sub">{sub}</span>}
      </header>
      <div className={"wz-preview-body" + (scroll ? " is-scroll" : "")}>{children}</div>
    </section>
  );
}

function SourceTag({ type }: { type: OnboardingItemType }) {
  const { t } = useT();
  const o = t.onboarding;
  const lbl = { marge: o.sourceMarge, fediverse: o.sourceFediverse, rss: o.sourceRss, youtube: o.sourceYoutube }[type];
  return (
    <span className="src-tag" title={lbl}>
      <SourceGlyph type={type} />
      <span className="src-tag-lbl">{lbl}</span>
    </span>
  );
}

function FeedRow({ item, justAdded }: { item: SelectedSource; justAdded?: boolean }) {
  return (
    <article className={"fi" + (justAdded ? " fi-new" : "")}>
      <div className="fi-head">
        <span className="fi-dot" style={{ background: colorFor(item.ref) }}>{initialOf(item.label)}</span>
        <div className="fi-id">
          <span className="fi-name">{item.label}</span>
          <span className="fi-addr">{item.ref}</span>
        </div>
        <SourceTag type={item.type} />
      </div>
    </article>
  );
}

function AvatarPreview({ photo, color, init, hasAvatar, onClick }: { photo: string | null; color: string; init: string; hasAvatar: boolean; onClick?: () => void }) {
  const { t } = useT();
  const bg = photo ? "#fff" : hasAvatar ? color : "var(--bg-soft)";
  const inner = photo ? (
    // Aperçu local (data URL) — next/image inadapté pour une vignette éphémère.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="av-prev-img" src={photo} alt="" />
  ) : hasAvatar ? (
    <span className="av-prev-init">{init}</span>
  ) : (
    <span className="av-prev-ph" aria-hidden="true">+</span>
  );
  if (onClick)
    return (
      <button type="button" className="av-prev av-prev-btn" style={{ background: bg }} onClick={onClick} aria-label={photo ? t.onboarding.avatarChangeAria : t.onboarding.avatarAddAria}>
        {inner}
        <span className="av-prev-edit" aria-hidden="true"><CameraMini /></span>
      </button>
    );
  return <span className="av-prev" style={{ background: bg }}>{inner}</span>;
}

function ExternalProfileCard({ name, address, bio, avatarColor, avatarPhoto, hasAvatar }: { name: string; address: string; bio: string; avatarColor: string; avatarPhoto: string | null; hasAvatar: boolean }) {
  const { t } = useT();
  const o = t.onboarding;
  const display = name.trim() || o.nameFallback;
  return (
    <div className="ext-card">
      <div className="ext-chrome">
        <span className="ext-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="ext-host">mastodon.social</span>
        <span className="ext-fed">{o.s2PreviewSub}</span>
      </div>
      <div className="ext-banner" aria-hidden="true" />
      <div className="ext-body">
        <div className="ext-avatar" style={{ background: avatarPhoto ? "#fff" : hasAvatar ? avatarColor : "var(--bg-soft)" }}>
          {avatarPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarPhoto} alt="" />
          ) : hasAvatar ? (
            <span className="ext-avatar-init">{initialOf(display)}</span>
          ) : (
            <span className="ext-avatar-ph" aria-hidden="true">◌</span>
          )}
        </div>
        <button type="button" className="ext-follow" disabled>{o.extFollow}</button>
        <div className="ext-name">{display}</div>
        <div className="ext-addr">{address}</div>
        {bio.trim() ? <p className="ext-bio">{bio.trim()}</p> : <p className="ext-bio ext-bio-empty">{o.extNoBio}</p>}
        <div className="ext-stats">
          <span><b>0</b> {o.extFollowing}</span>
          <span><b>0</b> {o.extFollowers}</span>
          <span className="ext-stats-note">{o.extNew}</span>
        </div>
      </div>
    </div>
  );
}

function AddrStatus({ state, handle }: { state: AddrUi; handle: string }) {
  const { t, interpolate } = useT();
  const o = t.onboarding;
  if (state === "empty") return <div className="wz-addr-status" aria-live="polite" />;
  if (state === "checking")
    return (
      <p className="wz-addr-status is-checking" aria-live="polite">
        <span className="wz-addr-ico"><span className="wz-addr-spin" aria-hidden="true" /></span>
        {o.addrChecking}
      </p>
    );
  if (state === "available")
    return (
      <p className="wz-addr-status is-available" aria-live="polite">
        <span className="wz-addr-ico"><span className="wz-addr-dot-ok" aria-hidden="true"><CheckMini /></span></span>
        <span>{interpolate(o.addrAvailable, { handle: `@${handle}` })}</span>
      </p>
    );
  if (state === "taken" || state === "reserved")
    return (
      <p className="wz-addr-status is-taken" role="alert">
        <span className="wz-addr-ico"><span className="wz-addr-dot-no" aria-hidden="true"><CrossMini /></span></span>
        <span>{interpolate(o.addrTaken, { handle: `@${handle}` })}</span>
      </p>
    );
  return (
    <p className="wz-addr-status is-invalid" role="alert">
      <span className="wz-addr-ico"><span className="wz-addr-dot-no" aria-hidden="true"><CrossMini /></span></span>
      {o.addrInvalid}
    </p>
  );
}

function NavRow({ step, onBack, onNext, primaryLabel, disabled, hint }: { step: number; onBack: () => void; onNext: () => void; primaryLabel: string; disabled?: boolean; hint?: string }) {
  const { t } = useT();
  return (
    <div className="wz-nav">
      {step > 1 ? (
        <button type="button" className="wz-btn wz-btn-ghost" onClick={onBack}><ArrowL /> {t.onboarding.back}</button>
      ) : (
        <span />
      )}
      <div className="wz-nav-right">
        {disabled && hint && <span className="wz-nav-hint">{hint}</span>}
        <button type="button" className="wz-btn wz-btn-primary" onClick={onNext} disabled={disabled} aria-disabled={disabled}>
          {primaryLabel} <ArrowR />
        </button>
      </div>
    </div>
  );
}

function PackCard({ pack, selected, onToggle }: { pack: PackView; selected: boolean; onToggle: () => void }) {
  const { t, interpolate } = useT();
  const o = t.onboarding;
  return (
    <button type="button" className={"pack" + (selected ? " is-on" : "")} aria-pressed={selected} onClick={onToggle}>
      <div className="pack-hd">
        <span className="pack-name">{pack.name}</span>
        <span className="pack-check" aria-hidden="true">{selected ? <CheckMini /> : "+"}</span>
      </div>
      {pack.tag && <span className="pack-tag">{pack.tag}</span>}
      <ul className="pack-items">
        {pack.items.slice(0, 4).map((it) => {
          const lbl = { marge: o.sourceMarge, fediverse: o.sourceFediverse, rss: o.sourceRss, youtube: o.sourceYoutube }[it.type];
          return (
            <li key={it.id} className="pack-item">
              <SourceGlyph type={it.type} size={12} />
              <span className="pack-item-name">{it.label}</span>
              <span className="pack-item-type">{lbl}</span>
            </li>
          );
        })}
      </ul>
      <span className="pack-cta">{selected ? interpolate(o.packFollowed, { n: pack.items.length }) : o.packFollow}</span>
    </button>
  );
}

function ProgressBar({ step, maxReached, onGo }: { step: number; maxReached: number; onGo: (n: number) => void }) {
  const { t, interpolate } = useT();
  const o = t.onboarding;
  const labels = [o.steps.welcome, o.steps.profile, o.steps.feed, o.steps.settings, o.steps.ready];
  return (
    <nav className="wz-progress" aria-label={o.progressLabel}>
      <ol>
        {labels.map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          const reachable = n <= maxReached;
          return (
            <li key={n} className={"wz-step is-" + state} aria-current={n === step ? "step" : undefined}>
              <button type="button" className="wz-step-btn" disabled={!reachable || n === step} onClick={() => reachable && onGo(n)} aria-label={interpolate(o.stepAria, { n, label }) + (state === "done" ? " " + o.stepDone : "")}>
                <span className="wz-dot">{state === "done" ? <CheckMini /> : n}</span>
                <span className="wz-step-label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="wz-progress-track" aria-hidden="true">
        <span className="wz-progress-fill" style={{ width: `${((step - 1) / 4) * 100}%` }} />
      </div>
    </nav>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────
export function OnboardingWizard({
  token,
  instanceDomain,
  packs,
}: {
  token: string;
  instanceDomain: string;
  packs: PackView[];
}) {
  const { t, interpolate } = useT();
  const o = t.onboarding;
  const msg = useActionMessage();
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(finishOnboardingAction, {});

  const [step, setStep] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [choice, setChoice] = useState<string | null>(null);
  const level: Level = choice === "fedi" ? "initie" : "debutant";

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [addr, setAddr] = useState<AddrUi>("empty");
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPhoto, setAvatarPhoto] = useState<string | null>(null);
  const [avatarOn, setAvatarOn] = useState(false);
  const [avatarColor, setAvatarColor] = useState("#7c3a4b");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<SelectedSource[]>([]);
  const [recent, setRecent] = useState<Set<string>>(new Set());
  const recentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manual, setManual] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<LocalAccountSuggestion[]>([]);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [notify, setNotify] = useState<"résumé" | "direct" | "aucune">("résumé");
  const [introText, setIntroText] = useState("");

  const address = handle.trim() ? `@${handle.trim().toLowerCase()}@${instanceDomain}` : `@…@${instanceDomain}`;
  const avatarInit = initialOf(name.trim() || o.nameFallback);

  useEffect(() => () => {
    if (addrTimer.current) clearTimeout(addrTimer.current);
    if (recentTimer.current) clearTimeout(recentTimer.current);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
  }, []);

  // Un compte local (marge) saisi en clair, p. ex. `@hubert` ou
  // `@hubert@marge.social`, sans `/` ni point de domaine résiduel.
  const localHandleQuery = (raw: string): string | null => {
    const v = raw.trim();
    if (!v || v.includes("/")) return null;
    if (/^@?[^@\s]+@/.test(v)) {
      const inst = v.split("@")[2] || "";
      if (inst && inst.toLowerCase() !== instanceDomain.toLowerCase()) return null;
    } else if (!/^@?[a-z0-9_-]+$/i.test(v)) {
      return null; // ressemble à une URL / un domaine → pas un compte local
    }
    return v.replace(/^@+/, "").split("@")[0].toLowerCase();
  };

  function onHandleChange(raw: string) {
    const v = raw.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    setHandle(v);
    if (addrTimer.current) clearTimeout(addrTimer.current);
    if (!v) {
      setAddr("empty");
      return;
    }
    setAddr("checking");
    addrTimer.current = setTimeout(() => {
      checkHandleAvailabilityAction(v).then(setAddr).catch(() => setAddr("invalid"));
    }, 450);
  }

  function markRecent(ids: string[]) {
    setRecent(new Set(ids));
    if (recentTimer.current) clearTimeout(recentTimer.current);
    recentTimer.current = setTimeout(() => setRecent(new Set()), 1500);
  }

  function togglePack(pack: PackView) {
    const items: SelectedSource[] = pack.items.map((i) => ({ id: `pack-${pack.id}-${i.id}`, type: i.type, label: i.label, ref: i.ref }));
    if (selectedPackIds.has(pack.id)) {
      const refs = new Set(items.map((i) => i.ref));
      setSources((s) => s.filter((x) => !(x.id.startsWith(`pack-${pack.id}-`) || refs.has(x.ref))));
      setSelectedPackIds((p) => {
        const n = new Set(p);
        n.delete(pack.id);
        return n;
      });
    } else {
      setSources((s) => [...items.filter((it) => !s.some((x) => x.ref === it.ref)), ...s]);
      setSelectedPackIds((p) => new Set(p).add(pack.id));
      markRecent(items.map((i) => i.ref));
    }
  }

  function pushSource(it: SelectedSource) {
    setSources((s) => (s.some((x) => x.ref === it.ref) ? s : [it, ...s]));
    markRecent([it.ref]);
  }

  // Saisie de la barre : suggère les comptes locaux correspondants (débounce) et
  // efface l'éventuel message d'erreur précédent.
  function onManualChange(raw: string) {
    setManual(raw);
    setAddError(null);
    const q = localHandleQuery(raw);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(() => {
      searchLocalAccountsAction(q)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 250);
  }

  function addSuggestion(s: LocalAccountSuggestion) {
    const ref = `@${s.handle}@${instanceDomain}`;
    pushSource({ id: `manual-${ref}`, type: "marge", label: s.displayName || s.handle, ref });
    setManual("");
    setSuggestions([]);
    setAddError(null);
  }

  // Ajout manuel : pour un compte marge, contrôle de réalité (le compte doit
  // exister sur l'instance) avant de l'ajouter au fil.
  async function addManual(raw: string) {
    const it = detectManualSource(raw, instanceDomain);
    if (!it) return;
    setSuggestions([]);
    if (it.type === "marge") {
      const q = localHandleQuery(raw);
      if (!q) return;
      setAddBusy(true);
      try {
        const matches = await searchLocalAccountsAction(q);
        const hit = matches.find((m) => m.handle === q);
        if (!hit) {
          setAddError(interpolate(o.s3AccountNotFound, { handle: `@${q}` }));
          return;
        }
        it.label = hit.displayName || it.label;
      } catch {
        setAddError(interpolate(o.s3AccountNotFound, { handle: `@${q}` }));
        return;
      } finally {
        setAddBusy(false);
      }
    }
    pushSource(it);
    setManual("");
  }

  function readImage(file: File | undefined) {
    if (!file) return;
    setAvatarFile(file);
    const r = new FileReader();
    r.onload = () => setAvatarPhoto(typeof r.result === "string" ? r.result : null);
    r.readAsDataURL(file);
  }

  const go = (n: number) => {
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => go(Math.min(5, step + 1));
  const back = () => go(Math.max(1, step - 1));

  function submitFinalize() {
    const fd = new FormData();
    fd.set("token", token);
    fd.set("displayName", name);
    fd.set("handle", handle);
    fd.set("bio", bio);
    fd.set("notify", notify);
    fd.set("intro", introText);
    fd.set("sources", JSON.stringify(sources.map((s) => ({ type: s.type, ref: s.ref, label: s.label }))));
    if (avatarFile) fd.set("avatar", avatarFile);
    // `formAction` (dispatch de useActionState) DOIT être appelé dans une
    // transition, sinon React n'enclenche pas la navigation de la server action :
    // le `redirect("/")` et le cookie de session étaient perdus, et l'utilisateur
    // (pourtant créé en base) se retrouvait renvoyé au début de l'onboarding.
    startTransition(() => {
      formAction(fd);
    });
  }

  const nameOk = name.trim().length > 0;
  const addrOk = addr === "available";
  const step2Hint = !nameOk ? o.s2HintName : addr === "checking" ? o.s2HintChecking : o.s2HintAddr;

  return (
    <div className="wz-stage">
      <div className="wz-shell">
        <header className="wz-top">
          <Link href="/" className="wz-brand">marge<span className="wz-brand-dot">.</span></Link>
        </header>

        <ProgressBar step={step} maxReached={maxReached} onGo={go} />

        <div className="wz-card">
          <div className="wz-card-grid" key={step}>
            {state.error && (
              <p role="alert" className="portal-error wz-form-error">{msg(state.error)}</p>
            )}

            {/* ── Écran 1 ── */}
            {step === 1 && (
              <>
                <div className="wz-col-main">
                  <p className="wz-overline"><span className="wz-overline-dot" />{o.s1Overline}</p>
                  <h1 className="wz-h1">{o.s1Title}</h1>
                  <p className="wz-roadmap">{o.s1Roadmap}</p>
                  <div className="wz-field">
                    <p className="wz-q">{o.s1Question}</p>
                    <div className="wz-choices" role="radiogroup" aria-label={o.s1Question}>
                      {[
                        { id: "neophyte", label: o.choiceNeophyte },
                        { id: "mainstream", label: o.choiceMainstream },
                        { id: "fedi", label: o.choiceFedi },
                      ].map((ch) => (
                        <button key={ch.id} type="button" role="radio" aria-checked={choice === ch.id} className={"wz-choice" + (choice === ch.id ? " is-on" : "")} onClick={() => setChoice(ch.id)}>
                          <span className="wz-choice-mark" aria-hidden="true" />
                          <span className="wz-choice-lbl">{ch.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <WhyCard>{o.why1}</WhyCard>
                  <NavRow step={step} onBack={back} onNext={next} primaryLabel={o.s1Primary} />
                </div>
                <div className="wz-col-side">
                  <PreviewFrame label={o.s1PreviewLabel} sub={o.s1PreviewSub}>
                    <div className="wz-empty">
                      <div className="wz-empty-lines" aria-hidden="true"><span /><span /><span /></div>
                      <p className="wz-empty-txt">{o.s1EmptyTxt}</p>
                    </div>
                  </PreviewFrame>
                </div>
              </>
            )}

            {/* ── Écran 2 ── */}
            {step === 2 && (
              <>
                <div className="wz-col-main">
                  <p className="wz-overline"><span className="wz-overline-dot" />{o.s2Overline}</p>
                  <h1 className="wz-h1">{o.s2Title}</h1>

                  <div className="wz-field">
                    <label className="wz-label" htmlFor="wz-name">{o.nameLabel}</label>
                    <input id="wz-name" className="wz-input" type="text" value={name} placeholder={o.namePlaceholder} maxLength={80} onChange={(e) => setName(e.target.value)} />
                    <Tip key={`name-${level}`} level={level} label={o.nameTipLabel}>{o.nameTip}</Tip>
                  </div>

                  <div className="wz-field">
                    <label className="wz-label" htmlFor="wz-addr">{o.addrLabel}</label>
                    <div className={"wz-addr-group is-" + addr}>
                      <span className="wz-addr-affix" aria-hidden="true">@</span>
                      <input id="wz-addr" className="wz-addr-handle" type="text" value={handle} placeholder={o.addrPlaceholder} spellCheck={false} autoCapitalize="none" autoCorrect="off" maxLength={32} onChange={(e) => onHandleChange(e.target.value)} />
                      <span className="wz-addr-affix wz-addr-affix-suffix" aria-hidden="true">@{instanceDomain}</span>
                    </div>
                    <AddrStatus state={addr} handle={handle} />
                    <Tip key={`addr-${level}`} level={level} label={o.addrTipLabel}>{o.addrTip}</Tip>
                  </div>

                  <div className="wz-field">
                    <span className="wz-label">{o.photoLabel} <span className="wz-facultatif">{o.facultatif}</span></span>
                    <div className="wz-avatar-row">
                      <AvatarPreview photo={avatarPhoto} color={avatarColor} init={avatarInit} hasAvatar={avatarOn || !!avatarPhoto} onClick={() => fileRef.current?.click()} />
                      <div className="wz-avatar-pick">
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => readImage(e.target.files?.[0])} />
                        {avatarPhoto ? (
                          <button type="button" className="wz-upload-remove" onClick={() => { setAvatarPhoto(null); setAvatarFile(null); }}>{o.avatarRemove}</button>
                        ) : (
                          <>
                            <span className="wz-avatar-hint">{o.avatarHint}</span>
                            <div className="wz-swatches">
                              {["#7c3a4b", "#3F6F8F", "#406B4A", "#7E5C8E", "#6b6b6b"].map((col) => (
                                <button key={col} type="button" className={"wz-swatch" + (avatarOn && avatarColor === col ? " is-on" : "")} style={{ background: col }} aria-label={col} onClick={() => { setAvatarOn(true); setAvatarColor(col); }} />
                              ))}
                              {avatarOn && <button type="button" className="wz-swatch-clear" onClick={() => setAvatarOn(false)} aria-label="✕">✕</button>}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="wz-field">
                    <label className="wz-label" htmlFor="wz-bio">{o.bioLabel} <span className="wz-facultatif">{o.facultatif}</span></label>
                    <textarea id="wz-bio" className="wz-textarea" rows={2} value={bio} placeholder={o.bioPlaceholder} maxLength={500} onChange={(e) => setBio(e.target.value)} />
                  </div>

                  <NavRow step={step} onBack={back} onNext={next} primaryLabel={o.continue} disabled={!(nameOk && addrOk)} hint={step2Hint} />
                </div>
                <div className="wz-col-side">
                  <PreviewFrame label={o.s2PreviewLabel} sub={o.s2PreviewSub}>
                    <ExternalProfileCard name={name} address={address} bio={bio} avatarColor={avatarColor} avatarPhoto={avatarPhoto} hasAvatar={avatarOn || !!avatarPhoto} />
                    <p className="wz-preview-note">{o.s2PreviewNote}</p>
                  </PreviewFrame>
                </div>
              </>
            )}

            {/* ── Écran 3 ── */}
            {step === 3 && (
              <>
                <div className="wz-col-main wz-col-wide">
                  <p className="wz-overline"><span className="wz-overline-dot" />{o.s3Overline}</p>
                  <h1 className="wz-h1">{o.s3Title}</h1>
                  <p className="wz-roadmap">{o.s3Roadmap}</p>

                  <div className="wz-sub-h">{o.s3PacksLabel} <span className="wz-sub-h-note">{o.s3PacksNote}</span></div>
                  {packs.length === 0 ? (
                    <p className="wz-roadmap" style={{ fontSize: 14 }}>{o.s3PacksEmpty}</p>
                  ) : (
                    <div className="pack-grid">
                      {packs.map((p) => (
                        <PackCard key={p.id} pack={p} selected={selectedPackIds.has(p.id)} onToggle={() => togglePack(p)} />
                      ))}
                    </div>
                  )}

                  <div className="wz-sub-h">{o.s3AddLabel}</div>
                  <div className="add-wrap">
                    <form className="add-bar" onSubmit={(e) => { e.preventDefault(); void addManual(manual); }}>
                      <input className="add-input" type="text" value={manual} placeholder={o.s3AddPlaceholder} spellCheck={false} autoComplete="off" onChange={(e) => onManualChange(e.target.value)} />
                      <button type="submit" className="add-btn" disabled={addBusy}>{addBusy ? o.s3Checking : o.s3AddBtn}</button>
                    </form>
                    {suggestions.length > 0 && (
                      <ul className="add-suggest" aria-label={o.s3SuggestLabel}>
                        {suggestions.map((s) => (
                          <li key={s.handle}>
                            <button type="button" className="add-suggest-item" onClick={() => addSuggestion(s)}>
                              <span className="add-suggest-av" style={{ background: s.avatarSrc ? "#fff" : colorFor(s.handle) }}>
                                {s.avatarSrc ? (
                                  // Vignette éphémère servie par l'API : next/image inutile ici.
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={s.avatarSrc} alt="" />
                                ) : (
                                  initialOf(s.displayName || s.handle)
                                )}
                              </span>
                              <span className="add-suggest-id">
                                <span className="add-suggest-name">{s.displayName || s.handle}</span>
                                <span className="add-suggest-addr">@{s.handle}@{instanceDomain}</span>
                              </span>
                              <SourceTag type="marge" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {addError && <p className="add-error" role="alert">{addError}</p>}
                  <div className="add-chips">
                    <span className="add-chips-lbl">{o.s3ExamplesLabel}</span>
                    {[
                      { ex: o.s3ExampleAccount, fill: "@hubert@marge.social" },
                      { ex: o.s3ExampleRss, fill: "monblog.fr/rss" },
                      { ex: o.s3ExampleYoutube, fill: "youtube.com/@archipel" },
                    ].map((e) => (
                      <button key={e.ex} type="button" className="add-chip" onClick={() => onManualChange(e.fill)}>{e.ex}</button>
                    ))}
                  </div>

                  <WhyCard>{o.why3}</WhyCard>
                  <NavRow step={step} onBack={back} onNext={next} primaryLabel={o.continue} />
                </div>
                <div className="wz-col-side">
                  <PreviewFrame label={o.s3PreviewLabel} sub={sources.length ? interpolate(o.s3PreviewSub, { n: sources.length }) : o.s3PreviewEmptySub} scroll>
                    {sources.length === 0 ? (
                      <div className="wz-empty wz-empty-sm"><p className="wz-empty-txt">{o.s3PreviewEmpty}</p></div>
                    ) : (
                      <div className="wz-feed">{sources.map((it) => <FeedRow key={it.id} item={it} justAdded={recent.has(it.ref)} />)}</div>
                    )}
                  </PreviewFrame>
                </div>
              </>
            )}

            {/* ── Écran 4 ── */}
            {step === 4 && (
              <>
                <div className="wz-col-main">
                  <p className="wz-overline"><span className="wz-overline-dot" />{o.s4Overline}</p>
                  <h1 className="wz-h1">{o.s4Title}</h1>
                  <p className="wz-roadmap">{o.s4Roadmap}</p>

                  <div className="wz-field">
                    <span className="wz-label">{o.notifLabel}</span>
                    <div className="seg" role="radiogroup" aria-label={o.notifLabel}>
                      <button type="button" role="radio" aria-checked={notify === "résumé"} className={"seg-btn" + (notify === "résumé" ? " is-on" : "")} onClick={() => setNotify("résumé")}>{o.notifDigest}</button>
                      <button type="button" role="radio" aria-checked={notify === "direct"} className={"seg-btn" + (notify === "direct" ? " is-on" : "")} onClick={() => setNotify("direct")}>{o.notifRealtime}</button>
                      <button type="button" role="radio" aria-checked={notify === "aucune"} className={"seg-btn" + (notify === "aucune" ? " is-on" : "")} onClick={() => setNotify("aucune")}>{o.notifNone}</button>
                    </div>
                    <p className="wz-seg-hint">{notify === "résumé" ? o.notifDigestHint : notify === "direct" ? o.notifRealtimeHint : o.notifNoneHint}</p>
                  </div>

                  <NavRow step={step} onBack={back} onNext={next} primaryLabel={o.continue} />
                </div>
                <div className="wz-col-side">
                  <PreviewFrame label={o.s4PreviewLabel} scroll>
                    {sources.length === 0 ? (
                      <div className="wz-empty wz-empty-sm"><p className="wz-empty-txt">{o.s4PreviewEmpty}</p></div>
                    ) : (
                      <div className="wz-feed">{sources.map((it) => <FeedRow key={it.id} item={it} />)}</div>
                    )}
                  </PreviewFrame>
                </div>
              </>
            )}

            {/* ── Écran 5 ── */}
            {step === 5 && (
              <>
                <div className="wz-col-main">
                  <p className="wz-overline"><span className="wz-overline-dot" />{o.s5Overline}</p>
                  <h1 className="wz-h1">{o.s5Title}</h1>
                  <p className="wz-roadmap">{o.s5Roadmap}</p>

                  <div className="intro-composer">
                    <div className="intro-hd">
                      <AvatarPreview photo={avatarPhoto} color={avatarColor} init={avatarInit} hasAvatar={avatarOn || !!avatarPhoto} />
                      <div className="intro-id">
                        <span className="intro-name">{name.trim() || o.tipFallbackName}</span>
                        <span className="intro-addr">{address}</span>
                      </div>
                    </div>
                    <textarea className="intro-text" rows={4} value={introText} placeholder={o.introPlaceholder} onChange={(e) => setIntroText(e.target.value)} />
                    <div className="intro-foot">
                      <span className="intro-tag">{o.introTag}</span>
                      <span className="intro-count">{interpolate(introText.trim().length > 1 ? o.introChars.other : o.introChars.one, { n: introText.trim().length })}</span>
                    </div>
                  </div>

                  <div className="wz-nav wz-nav-final">
                    <button type="button" className="wz-btn wz-btn-ghost" onClick={back}><ArrowL /> {o.back}</button>
                    <button type="button" className="wz-btn wz-btn-primary wz-btn-cta" onClick={submitFinalize} disabled={pending}>
                      {pending ? o.s5Finishing : introText.trim() ? o.s5PublishEnter : o.s5Enter} <ArrowR />
                    </button>
                  </div>
                </div>
                <div className="wz-col-side">
                  <PreviewFrame label={o.s5PreviewLabel} sub={introText.trim() ? o.s5PreviewIntro : sources.length ? o.s5PreviewLive : o.s5PreviewEmptySub} scroll>
                    {sources.length === 0 && !introText.trim() ? (
                      <div className="wz-empty wz-empty-sm"><p className="wz-empty-txt">{o.s5PreviewEmpty}</p></div>
                    ) : (
                      <div className="wz-feed">
                        {introText.trim() && (
                          <FeedRow item={{ id: "intro", type: "marge", label: name.trim() || o.tipFallbackName, ref: `${introText.trim()} #introduction` }} justAdded />
                        )}
                        {sources.map((it) => <FeedRow key={it.id} item={it} />)}
                      </div>
                    )}
                  </PreviewFrame>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
