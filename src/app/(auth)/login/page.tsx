import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/auth";
import { getServerI18n } from "@/lib/i18n/server";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const { dict } = await getServerI18n();

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{dict.auth.loginTitle}</h1>
      <LoginForm />
      <p className="text-sm text-foreground/70">
        {dict.auth.noAccount}{" "}
        <Link href="/signup" className="underline">
          {dict.auth.createAccountLink}
        </Link>
      </p>
    </div>
  );
}
