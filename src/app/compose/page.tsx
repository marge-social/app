import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { EditorForm } from "@/components/EditorForm";
import { getCurrentUser } from "@/lib/auth";
import { humanObjectUrl } from "@/lib/config";
import { resolveInteractionTarget } from "@/lib/interactions";

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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Écrire un texte</h1>
        <p className="text-sm text-foreground/70">
          Markdown, prévisualisation, brouillon ou publication.
        </p>
      </div>

      <EditorForm
        inReplyTo={replyTarget?.objectIri}
        replyToHref={
          replyTarget ? humanObjectUrl(replyTarget.objectIri) : undefined
        }
      />

      {drafts.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-black/10 pt-6 dark:border-white/15">
          <h2 className="text-lg font-semibold">Brouillons</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/compose/${d.id}`} className="underline">
                  {d.title || "(sans titre)"}
                </Link>{" "}
                <span className="text-foreground/50">
                  — modifié le{" "}
                  {d.updatedAt.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
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
