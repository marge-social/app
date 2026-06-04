import type { MediaView } from "@/lib/media";

/**
 * Rendu des pièces jointes selon leur nature (cahier médias §4.1) : image inline
 * (avec son texte alternatif), lecteur vidéo/audio, PDF en lien de
 * téléchargement (servi depuis l'origine média séparée). Aucune pièce → rien.
 */
export function Attachments({ media }: { media: MediaView[] }) {
  if (media.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {media.map((m, i) => {
        if (m.kind === "image") {
          return (
            <a
              key={i}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.thumbnailUrl ?? m.url}
                alt={m.alt ?? ""}
                width={m.width ?? undefined}
                height={m.height ?? undefined}
                className="max-h-96 w-auto rounded-lg border border-black/10 object-contain dark:border-white/15"
              />
            </a>
          );
        }
        if (m.kind === "video") {
          return (
            <video
              key={i}
              src={m.url}
              controls
              className="max-h-96 w-full rounded-lg border border-black/10 dark:border-white/15"
            />
          );
        }
        if (m.kind === "audio") {
          return <audio key={i} src={m.url} controls className="w-full" />;
        }
        // PDF : lien de téléchargement (origine média séparée).
        return (
          <a
            key={i}
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 rounded border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            <span aria-hidden>📄</span>
            {m.alt || "Document PDF"}
          </a>
        );
      })}
    </div>
  );
}
