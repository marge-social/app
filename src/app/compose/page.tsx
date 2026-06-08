import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { EditorForm } from "@/components/EditorForm";
import { getCurrentUser } from "@/lib/auth";
import { humanObjectUrl } from "@/lib/config";
import { resolveInteractionTarget } from "@/lib/interactions";
import { interpolate } from "@/lib/i18n/config";
import { getServerI18n } from "@/lib/i18n/server";
import { formatShortDate } from "@/lib/relative-time";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ replyTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Réponse-billet (§2.3) : on ne propage `replyTo` que s'il désigne un objet
  // réellement connu (anti-IRI arbitraire), comme pour like/commentaire.
  const { replyTo } = await searchParams;
  const replyTarget = replyTo
    ? await resolveInteractionTarget(replyTo.trim())
    : null;

  const drafts = await db.query.articles.findMany({
    where: and(eq(articles.authorId, user.id), eq(articles.status, "draft")),
    orderBy: [desc(articles.updatedAt)],
    columns: { id: true, title: true, updatedAt: true },
  });

  const { locale, dict } = await getServerI18n();
  const t = dict.compose;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t.writeTitle}</h1>
        <p className="text-sm text-foreground/70">{t.writeIntro}</p>
      </div>

      <EditorForm
        inReplyTo={replyTarget?.objectIri}
        replyToHref={
          replyTarget ? humanObjectUrl(replyTarget.objectIri) : undefined
        }
      />

      {drafts.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-black/10 pt-6 dark:border-white/15">
          <h2 className="text-lg font-semibold">{t.drafts}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/compose/${d.id}`} className="underline">
                  {d.title || dict.feed.untitled}
                </Link>{" "}
                <span className="text-foreground/50">
                  {"— "}
                  {interpolate(t.modifiedOn, {
                    date: formatShortDate(d.updatedAt, locale),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
