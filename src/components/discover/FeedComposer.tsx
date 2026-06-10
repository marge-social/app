"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { LinkPreview } from "@/db/schema";
import { type PostFormState, createPostAction } from "@/app/actions/posts";
import { useActionMessage, useT } from "@/components/I18nProvider";
import { Icons } from "@/components/discover/icons";
import {
  ComposerLinkPreview,
  type LinkCandidate,
  NONE_KEY,
  extractUrlsClient,
  hostnameOf,
} from "@/components/discover/ComposerLinkPreview";

/** Liste blanche des types acceptés à l'upload (cahier médias §3.2). */
const ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,application/pdf,video/mp4,video/webm,audio/mpeg";

/** Longueur max d'une note — doit rester aligné sur `createPostAction`. */
const MAX_LEN = 5000;

/** Clé du brouillon local : le texte survit à une navigation ; la coche
 *  « Brouillon enregistré » reflète une vraie écriture dans localStorage. */
const DRAFT_KEY = "marge:composer-draft";

/** Média en attente d'envoi (un seul par note en V1, cf. table `media`). */
type PendingMedia = { file: File; previewUrl: string | null };

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      type="submit"
      className="composer-action primary"
      disabled={pending || disabled}
    >
      {pending ? t.composer.publishing : t.composer.publish}
      {Icons.arrowRight}
    </button>
  );
}

/**
 * Composer en tête de fil (§Lot 3, design « Home Visiteur ») : un corps de
 * texte (Markdown) + un média optionnel rendu en chip, publication directe en
 * Note fédérée via `createPostAction`. Quand une image est choisie, le champ
 * de texte alternatif apparaît directement (sans étape, §4.1) et devient
 * obligatoire.
 */
export function FeedComposer() {
  const [state, action] = useActionState<PostFormState, FormData>(
    createPostAction,
    {},
  );
  const { t } = useT();
  const msg = useActionMessage();
  const c = t.composer;

  const [body, setBody] = useState("");
  const [media, setMedia] = useState<PendingMedia | null>(null);
  const [draft, setDraft] = useState<"idle" | "writing" | "saved">("idle");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Vignette de lien : URL détectées (débouncées), aperçus OG résolus via
  // /api/og, choix de l'utilisateur (url | NONE_KEY | null = auto).
  const [urls, setUrls] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Record<string, LinkPreview>>({});
  const [pick, setPick] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => autosize(bodyRef.current), [body]);

  // Restaure le brouillon local au montage (localStorage est indisponible au
  // rendu serveur : un initialiseur d'état provoquerait un mismatch
  // d'hydratation). setState différé en callback — pas de setState synchrone
  // dans l'effet (cf. react-hooks/set-state-in-effect) ; les mises à jour
  // fonctionnelles ne touchent pas une saisie déjà commencée.
  useEffect(() => {
    const saved = window.localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    const id = setTimeout(() => {
      setBody((prev) => (prev ? prev : saved));
      setDraft((prev) => (prev === "idle" ? "saved" : prev));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Auto-save débouncée : chaque frappe repasse en « writing » (handler), la
  // pause écrit réellement le texte et affiche la coche.
  useEffect(() => {
    if (draft !== "writing") return;
    const id = setTimeout(() => {
      if (body.trim()) window.localStorage.setItem(DRAFT_KEY, body);
      else window.localStorage.removeItem(DRAFT_KEY);
      setDraft(body.trim() ? "saved" : "idle");
    }, 600);
    return () => clearTimeout(id);
  }, [draft, body]);

  // Détection des liens, débouncée : on attend une courte pause de saisie
  // avant d'extraire (évite de résoudre des URL incomplètes en cours de frappe).
  useEffect(() => {
    const id = setTimeout(() => {
      setUrls((prev) => {
        const next = extractUrlsClient(body);
        return prev.length === next.length && prev.every((u, i) => u === next[i])
          ? prev
          : next;
      });
    }, 450);
    return () => clearTimeout(id);
  }, [body]);

  // Résolution OG des liens nouvellement vus (une seule requête par URL ; en
  // cas d'échec, repli minimal côté client pour que le candidat reste choisissable).
  useEffect(() => {
    for (const u of urls) {
      if (requestedRef.current.has(u)) continue;
      requestedRef.current.add(u);
      fetch(`/api/og?url=${encodeURIComponent(u)}`)
        .then((r) => (r.ok ? (r.json() as Promise<LinkPreview>) : null))
        .catch(() => null)
        .then((p) => {
          const fallback: LinkPreview = {
            url: u,
            domain: hostnameOf(u),
            title: hostnameOf(u),
          };
          setPreviews((prev) => ({ ...prev, [u]: p ?? fallback }));
        });
    }
  }, [urls]);

  // Révoque l'URL de prévisualisation devenue obsolète (remplacement, retrait,
  // publication ou démontage).
  useEffect(() => {
    const url = media?.previewUrl ?? null;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [media]);

  // Maintient le champ fichier caché aligné sur l'état : React réinitialise
  // les champs non contrôlés après une action de formulaire — sans cela, un
  // envoi rejeté (média invalide…) perdrait silencieusement le fichier alors
  // que la chip resterait affichée.
  useEffect(() => {
    const input = fileRef.current;
    if (!input) return;
    if (!media) {
      input.value = "";
      return;
    }
    if (input.files?.[0] !== media.file) {
      const dt = new DataTransfer();
      dt.items.add(media.file);
      input.files = dt.files;
    }
  }, [media, state]);

  // Réinitialise l'état après un envoi réussi — ajustement d'état pendant le
  // rendu (recommandé par React plutôt qu'un setState synchrone en effet)…
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (!state.error) {
      setBody("");
      setMedia(null);
      setDraft("idle");
      setUrls([]);
      setPick(null);
      setRailOpen(false);
    }
  }

  // Ajustements pendant le rendu : un choix qui ne correspond plus à aucun
  // lien du texte revient en auto ; le sélecteur se referme à ≤ 1 lien.
  if (pick && pick !== NONE_KEY && !urls.includes(pick)) setPick(null);
  if (railOpen && urls.length <= 1) setRailOpen(false);
  // …et purge le brouillon local (effet : impur), uniquement sur transition —
  // l'état initial `{}` est lui aussi sans erreur.
  const lastPurgedState = useRef(state);
  useEffect(() => {
    if (lastPurgedState.current === state) return;
    lastPurgedState.current = state;
    if (!state.error) window.localStorage.removeItem(DRAFT_KEY);
  }, [state]);

  const hasContent = body.trim().length > 0 || media !== null;
  const isImage = media?.file.type.startsWith("image/") ?? false;

  // Vignette par défaut : le lien le plus riche (avec image) déjà résolu,
  // sinon le premier. Le choix explicite de l'utilisateur prime.
  const links: LinkCandidate[] = urls.map((url) => ({
    url,
    preview: previews[url],
  }));
  const autoKey = links.length
    ? (links.find((l) => l.preview?.imageUrl) ?? links[0]).url
    : null;
  const selectedKey = pick ?? autoKey;
  const featuredUrl =
    selectedKey && selectedKey !== NONE_KEY ? selectedKey : "";

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMedia({
      file,
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
    });
  };

  return (
    <form action={action} className="composer" aria-label={c.ariaLabel}>
      <div className="composer-meta">
        <span>{c.lead}</span>
        {body.trim().length > 0 && draft !== "idle" && (
          <span className="save">
            {draft === "saved" ? (
              <>
                <b>✓</b> {c.draftSaved}
              </>
            ) : (
              c.writing
            )}
          </span>
        )}
      </div>

      <label htmlFor="composer-body" className="sr-only">
        {c.bodyLabel}
      </label>
      <textarea
        id="composer-body"
        ref={bodyRef}
        name="body"
        className="composer-body"
        rows={2}
        maxLength={MAX_LEN}
        placeholder={c.placeholder}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setDraft("writing");
        }}
      />

      {media && (
        <div className="composer-media">
          <div className={"media-chip" + (media.previewUrl ? " has-thumb" : "")}>
            {media.previewUrl ? (
              <span
                className="media-thumb"
                style={{ backgroundImage: `url(${media.previewUrl})` }}
                aria-hidden
              />
            ) : (
              <span className="media-ic" aria-hidden>
                {media.file.type.startsWith("video/") ? "▶" : "◆"}
              </span>
            )}
            <span className="media-name">{media.file.name}</span>
            <button
              type="button"
              className="media-x"
              onClick={() => setMedia(null)}
              aria-label={c.removeMedia}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {isImage && (
        <div className="composer-alt">
          <label htmlFor="composer-alt">
            {c.altLabel} <span>{c.altHint}</span>
          </label>
          <input
            id="composer-alt"
            name="alt"
            type="text"
            required
            maxLength={1500}
            placeholder={c.altPlaceholder}
          />
        </div>
      )}

      {links.length > 0 && (
        <ComposerLinkPreview
          links={links}
          selectedKey={selectedKey}
          onPick={(u) => {
            setPick(u);
            setRailOpen(false);
          }}
          onNone={() => setPick(NONE_KEY)}
          onRestore={() => setPick(null)}
          railOpen={railOpen}
          setRailOpen={setRailOpen}
        />
      )}

      <input type="hidden" name="linkUrl" value={featuredUrl} />
      <input
        ref={fileRef}
        name="media"
        type="file"
        accept={ACCEPT}
        hidden
        onChange={onFileChosen}
      />

      <div className="composer-bar">
        <button
          type="button"
          className="composer-action"
          onClick={() => fileRef.current?.click()}
          title={`${c.attachMedia} ${c.attachMediaHint}`}
        >
          {Icons.image}
          {c.attachMedia}
        </button>
        <div className="composer-actions">
          <SubmitButton disabled={!hasContent} />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="composer-error">
          {msg(state.error, state.errorParams)}
        </p>
      )}
    </form>
  );
}
