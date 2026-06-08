import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";

/** Home pour visiteur **non connecté** : présentation + invitation à
 *  rejoindre. Pas de fil personnel (il n'existe pas de fil public côté
 *  backend ; `buildFeed` exige un utilisateur). */
export async function DiscoverLanding() {
  const { dict } = await getServerI18n();
  const h = dict.home;
  return (
    <section
      className="mx-auto flex max-w-2xl flex-col gap-6"
      style={{ padding: "72px 24px 100px" }}
      aria-label={h.landingTitle}
    >
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontSize: 40,
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: "-0.015em",
          color: "var(--ink)",
        }}
      >
        {h.landingTitle}
      </h1>
      <p style={{ fontFamily: "var(--serif)", fontSize: 19, lineHeight: 1.55, color: "var(--ink-2)" }}>
        {h.landingP1}
      </p>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--ink-2)" }}>{h.landingP2}</p>
      <div className="flex gap-3">
        <Link href="/signup" className="btn btn-ink">
          {dict.nav.signup}
        </Link>
        <Link href="/login" className="btn btn-ghost">
          {dict.nav.login}
        </Link>
      </div>
    </section>
  );
}
