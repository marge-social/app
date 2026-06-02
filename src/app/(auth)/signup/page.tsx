import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/auth";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/feed");

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Créer un compte</h1>
      <SignupForm />
      <p className="text-sm text-foreground/70">
        Déjà inscrit·e ?{" "}
        <Link href="/login" className="underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
