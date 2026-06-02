import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Mon fil</h1>
        <p className="text-sm text-foreground/70">
          Connecté·e en tant que{" "}
          <span className="font-mono">{fediverseHandle(user.handle)}</span>
        </p>
      </header>

      <p className="rounded border border-black/10 bg-black/[0.03] px-4 py-6 text-foreground/70 dark:border-white/15 dark:bg-white/[0.03]">
        La surface de lecture unifiée (articles des comptes suivis, contenus
        fédérés, items des flux RSS) arrivera au sprint S6. Pour l’instant, tu
        peux <Link href="/compose" className="underline">écrire un texte</Link>{" "}
        ou visiter <Link href={`/@${user.handle}`} className="underline">ton profil</Link>.
      </p>
    </div>
  );
}
