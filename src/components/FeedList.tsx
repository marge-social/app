import Link from "next/link";
import type { FeedEntry } from "@/lib/feed";

function EntryMeta({ e }: { e: FeedEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
      <span>{e.authorLabel}</span>
      <span aria-hidden>·</span>
      <time dateTime={e.date.toISOString()}>
        {e.date.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </time>
      <span aria-hidden>·</span>
      <span>{e.source}</span>
      {e.readingMinutes && (
        <>
          <span aria-hidden>·</span>
          <span>{e.readingMinutes} min</span>
        </>
      )}
    </div>
  );
}

/**
 * Rendu du fil unifié (§Lot 3). Les notes natives sont affichées **en entier** ;
 * les billets, contenus distants et items RSS en **aperçu + lien**. Aucun
 * compteur d'engagement n'est rendu.
 */
export function FeedList({ entries }: { entries: FeedEntry[] }) {
  return (
    <ul className="flex flex-col gap-6">
      {entries.map((e) => (
        <li
          key={e.key}
          className="flex flex-col gap-2 border-b border-black/5 pb-5 dark:border-white/10"
        >
          <EntryMeta e={e} />
          {e.kind === "note" ? (
            <>
              <div
                className="prose-marge text-sm"
                dangerouslySetInnerHTML={{ __html: e.contentHtml ?? "" }}
              />
              <Link
                href={e.href}
                className="text-xs text-foreground/55 hover:underline"
              >
                Permalien
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold">
                {e.internal ? (
                  <Link href={e.href} className="hover:underline">
                    {e.title || "(sans titre)"}
                  </Link>
                ) : (
                  <a
                    href={e.href}
                    className="hover:underline"
                    rel="noopener noreferrer nofollow"
                  >
                    {e.title || "(sans titre)"}
                  </a>
                )}
              </h3>
              {e.summary && (
                <p className="text-sm text-foreground/80">{e.summary}</p>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
