"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";

/**
 * Module d'image d'illustration (cover). Le fichier choisi vit dans le
 * `<input type="file" name="media">` (soumis tel quel à `saveArticleAction`,
 * upload S3 réel) ; la légende sert de texte alternatif (`name="alt"`, requis
 * pour une image). Le crédit est illustratif (non persisté — pas de champ
 * backend). Disponible à la création uniquement (média create-only côté serveur).
 */
export function CoverImage() {
  const { t } = useT();
  const c = t.editor.cover;
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");

  const readPreview = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreview((e.target?.result as string) ?? null);
    reader.readAsDataURL(file);
  };

  const clear = () => {
    setPreview(null);
    setCaption("");
    setCredit("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <figure
      className={
        "cover" +
        (preview ? " filled" : " empty") +
        (dragOver ? " dragover" : "")
      }
      style={{ margin: "0 0 28px" }}
      onClick={preview ? undefined : () => inputRef.current?.click()}
      onDragOver={
        preview
          ? undefined
          : (e) => {
              e.preventDefault();
              setDragOver(true);
            }
      }
      onDragLeave={preview ? undefined : () => setDragOver(false)}
      onDrop={
        preview
          ? undefined
          : (e) => {
              e.preventDefault();
              setDragOver(false);
              const files = e.dataTransfer.files;
              if (files && files[0] && inputRef.current) {
                inputRef.current.files = files;
                readPreview(files[0]);
              }
            }
      }
      role={preview ? undefined : "button"}
      tabIndex={preview ? undefined : 0}
      aria-label={preview ? undefined : c.addTitle}
    >
      {/* Champ fichier réel — toujours présent dans le DOM (soumis au form). */}
      <input
        ref={inputRef}
        type="file"
        name="media"
        accept="image/*"
        className="sr"
        onChange={(e) => readPreview(e.target.files?.[0])}
      />

      {!preview ? (
        <>
          <span className="empty-glyph" aria-hidden="true">
            Aa
          </span>
          <div className="empty-ttl">{c.addTitle}</div>
          <div className="empty-sub">{c.addSub}</div>
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={caption || c.addTitle} />
          <div className="cover-actions">
            <button
              type="button"
              className="cover-btn"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              {c.replace}
            </button>
            <button
              type="button"
              className="cover-btn"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
            >
              {c.remove}
            </button>
          </div>
          <input
            type="text"
            name="alt"
            required
            maxLength={1500}
            className="cover-caption"
            placeholder={c.captionPlaceholder}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            aria-label={c.captionPlaceholder}
          />
          <input
            type="text"
            className="cover-credit"
            placeholder={c.creditPlaceholder}
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            aria-label={c.creditPlaceholder}
          />
        </>
      )}
    </figure>
  );
}
