import type { Metadata } from "next";
import { getLegalPage } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales — Marge" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function MentionsLegalesPage() {
  const page = await getLegalPage();

  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
      <div
        className="prose-marge"
        dangerouslySetInnerHTML={{ __html: page.contentHtml }}
      />
      {page.updatedAt && (
        <p className="text-sm text-black/55 dark:text-white/55">
          Dernière mise à jour le {dateFormat.format(page.updatedAt)}.
        </p>
      )}
    </article>
  );
}
