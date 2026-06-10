"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { LinkPreview } from "@/db/schema";
import {
  type PostFormState,
  deletePostAction,
  updatePostAction,
} from "@/app/actions/posts";
import { useActionMessage, useT } from "@/components/I18nProvider";
import { LinkCard } from "@/components/LinkCard";
import {
  ComposerLinkPreview,
  NONE_KEY,
  useLinkCandidates,
} from "@/components/discover/ComposerLinkPreview";

function SaveButton() {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button type="submit" className="composer-action primary" disabled={pending}>
      {pending ? t.editor.pending : t.feed.savePost}
    </button>
  );
}

/**
 * Corps d'une note (HTML sanitisé en amont) + vignette de lien éventuelle,
 * avec, pour son auteur, l'édition en place (texte ET choix de la vignette,
 * même sélecteur que le composer) et la suppression (confirmation native).
 * L'édition ré-applique le pipeline Markdown côté serveur et fédère
 * `Update(Note)` ; la suppression fédère `Delete(Tombstone)`.
 */
export function NoteBody({
  html,
  className = "entry-note",
  postId,
  contentMarkdown,
  linkPreview = null,
  canEdit = false,
}: {
  html: string;
  className?: string;
  postId?: string;
  contentMarkdown?: string;
  linkPreview?: LinkPreview | null;
  canEdit?: boolean;
}) {
  const { t } = useT();
  const msg = useActionMessage();
  const [state, action] = useActionState<PostFormState, FormData>(
    updatePostAction,
    {},
  );
  const [editing, setEditing] = useState(false);
  // Contrôlé : React 19 réinitialise les champs non contrôlés après une action
  // de formulaire — un envoi rejeté perdrait la saisie en cours.
  const [body, setBody] = useState("");

  // Vignette de lien pendant l'édition : mêmes candidats/sélecteur que le
  // composer. Le choix existant de la note est respecté au départ (son URL,
  // sinon « Aucune » — on n'ajoute jamais de vignette à l'insu de l'auteur).
  const links = useLinkCandidates(editing ? body : "");
  const [pick, setPick] = useState<string | null>(NONE_KEY);
  const [railOpen, setRailOpen] = useState(false);

  // Sort du mode édition après un envoi réussi (ajustement d'état pendant le
  // rendu) ; le HTML ré-rendu arrive par les props via la revalidation.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (!state.error) setEditing(false);
  }

  // Un choix qui ne correspond plus à aucun lien du texte revient en auto ;
  // le sélecteur se referme à ≤ 1 lien.
  if (
    editing &&
    pick &&
    pick !== NONE_KEY &&
    links.length > 0 &&
    !links.some((l) => l.url === pick)
  ) {
    setPick(null);
  }
  if (railOpen && links.length <= 1) setRailOpen(false);

  // contentHtml est déjà sanitisé en amont (lib/feed, actions/posts).
  const rendered = (
    <>
      <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
      {linkPreview && <LinkCard p={linkPreview} />}
    </>
  );

  if (!canEdit || !postId) return rendered;

  if (editing) {
    const autoKey = links.length
      ? (links.find((l) => l.preview?.imageUrl) ?? links[0]).url
      : null;
    const selectedKey = pick ?? autoKey;
    const featuredUrl =
      selectedKey && selectedKey !== NONE_KEY ? selectedKey : "";

    return (
      <form action={action} className="note-edit">
        <input type="hidden" name="id" value={postId} />
        <label htmlFor={`note-edit-${postId}`} className="sr-only">
          {t.composer.bodyLabel}
        </label>
        <textarea
          id={`note-edit-${postId}`}
          name="body"
          rows={3}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
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
        {state.error && (
          <p role="alert" className="composer-error">
            {msg(state.error, state.errorParams)}
          </p>
        )}
        <div className="row">
          <button
            type="button"
            className="composer-action"
            onClick={() => setEditing(false)}
          >
            {t.feed.cancelEdit}
          </button>
          <SaveButton />
        </div>
      </form>
    );
  }

  return (
    <>
      {rendered}
      <div className="entry-own-actions">
        <button
          type="button"
          onClick={() => {
            setBody(contentMarkdown ?? "");
            setPick(linkPreview?.url ?? NONE_KEY);
            setRailOpen(false);
            setEditing(true);
          }}
        >
          {t.feed.editPost}
        </button>
        <form
          action={deletePostAction}
          onSubmit={(e) => {
            if (!window.confirm(t.feed.confirmDeletePost)) e.preventDefault();
          }}
          className="contents"
        >
          <input type="hidden" name="id" value={postId} />
          <button type="submit">{t.feed.deletePost}</button>
        </form>
      </div>
    </>
  );
}
