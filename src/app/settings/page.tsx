import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Réglages</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
        <dt className="text-foreground/60">Nom affiché</dt>
        <dd>{user.displayName}</dd>
        <dt className="text-foreground/60">Handle fédéré</dt>
        <dd className="font-mono">{fediverseHandle(user.handle)}</dd>
        <dt className="text-foreground/60">Email</dt>
        <dd>{user.email}</dd>
      </dl>
      <p className="text-foreground/70">
        L’édition du profil et la déclaration de flux RSS arriveront aux sprints
        suivants.
      </p>
    </div>
  );
}
