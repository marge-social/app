import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { posts, users } from "@/db/schema";
import { fediverseHandle } from "@/lib/config";
import { htmlToText } from "@/lib/markdown";

interface NoteParams {
  params: Promise<{ handle: string; id: string }>;
}

async function loadNote(rawHandle: string, id: string) {
  const decoded = decodeURIComponent(rawHandle);
  if (!decoded.startsWith("@")) return null;
  const handle = decoded.slice(1).toLowerCase();

  const author = await db.query.users.findFirst({
    where: eq(users.handle, handle),
  });
  if (!author) return null;

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.authorId, author.id), eq(posts.id, id)),
  });
  if (!post) return null;
  return { author, post };
}

export async function generateMetadata({
  params,
}: NoteParams): Promise<Metadata> {
  const { handle, id } = await params;
  const data = await loadNote(handle, id);
  if (!data) return { title: "Introuvable — Marge" };
  const excerpt = htmlToText(data.post.contentHtml).slice(0, 80);
  return {
    title: `${data.author.displayName} — ${excerpt}…`,
  };
}

export default async function NotePage({ params }: NoteParams) {
  const { handle, id } = await params;
  const data = await loadNote(handle, id);
  if (!data) notFound();
  const { author, post } = data;
  const date = post.publishedAt ?? post.createdAt;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-foreground/70">
          <Link href={`/@${author.handle}`} className="hover:underline">
            {author.displayName}
          </Link>{" "}
          <span className="font-mono">{fediverseHandle(author.handle)}</span>
          {" · "}
          <time dateTime={date.toISOString()}>
            {date.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>
      </header>

      <div
        className="prose-marge"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </article>
  );
}
