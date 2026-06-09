import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Garde d'accès aux espaces `/admin/*` (§3.2), appliquée **côté serveur**.
 * - non connecté → renvoyé au login ;
 * - connecté sans rôle `admin` → renvoyé à l'accueil (équivalent 403).
 *
 * À appeler dans le layout `/admin` ET dans chaque page admin (défense en
 * profondeur : on ne se repose pas sur le simple masquage d'un lien d'UI).
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "admin") redirect("/");
  return user;
}
