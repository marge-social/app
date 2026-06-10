"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  type PostFormState,
  deletePostAction,
  updatePostAction,
} from "@/app/actions/posts";
import { useActionMessage, useT } from "@/components/I18nProvider";

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
 * Corps d'une note (HTML sanitisé en amont) avec, pour son auteur, l'édition
 * en place et la suppression (confirmation native). L'édition ré-applique le
 * pipeline Markdown côté serveur et fédère `Update(Note)` ; la suppression
 * fédère `Delete(Tombstone)`.
 */
export function NoteBody({
  html,
  className = "entry-note",
  postId,
  contentMarkdown,
  canEdit = false,
}: {
  html: string;
  className?: string;
  postId?: string;
  contentMarkdown?: string;
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

  // Sort du mode édition après un envoi réussi (ajustement d'état pendant le
  // rendu) ; le HTML ré-rendu arrive par les props via la revalidation.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (!state.error) setEditing(false);
  }

  // contentHtml est déjà sanitisé en amont (lib/feed, actions/posts).
  const rendered = (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );

  if (!canEdit || !postId) return rendered;

  if (editing) {
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
