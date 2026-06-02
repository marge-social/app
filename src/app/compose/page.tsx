import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function ComposePage() {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Écrire</h1>
      <p className="text-foreground/70">
        L’éditeur Markdown arrive au sprint S1.
      </p>
    </div>
  );
}
