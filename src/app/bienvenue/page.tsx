import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { getCurrentUser } from "@/lib/auth";
import { INSTANCE_DOMAIN } from "@/lib/config";
import { getServerI18n } from "@/lib/i18n/server";
import { listEnabledPacks } from "@/lib/onboarding-packs";
import { findPendingByToken, markPendingVerified } from "@/lib/signups";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.onboarding.metaTitle };
}

/** Écran d'activation invalide / expiré. */
async function InvalidLink() {
  const { dict } = await getServerI18n();
  const o = dict.onboarding;
  return (
    <div className="wz-stage">
      <div className="wz-shell wz-shell-narrow">
        <header className="wz-top">
          <Link href="/" className="wz-brand">
            marge<span className="wz-dot">.</span>
          </Link>
        </header>
        <div className="wz-card">
          <div className="wz-invalid">
            <h1 className="wz-h1">{o.invalidTitle}</h1>
            <p className="wz-roadmap">{o.invalidBody}</p>
            <Link href="/" className="wz-btn wz-btn-primary">
              {o.invalidBack}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Onboarding tokenisé (cf. ADR 0006). Le lien d'activation (`?token=`) ouvre cet
 * écran : on valide le jeton, on marque l'inscription comme vérifiée (preuve de
 * contrôle de l'email) puis on déroule le wizard. Aucune session n'est ouverte
 * tant que l'onboarding n'est pas finalisé.
 */
export default async function BienvenuePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  // Un compte déjà connecté n'a rien à faire ici.
  if (await getCurrentUser()) redirect("/");

  const { token: raw } = await searchParams;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const pending = token ? await findPendingByToken(token) : null;
  if (!token || !pending) return <InvalidLink />;

  // Premier clic = preuve de contrôle de l'email → l'inscription échappe à la
  // suppression à 96 h et le lien reste rejouable pour reprendre l'onboarding.
  await markPendingVerified(pending.id);

  const packs = await listEnabledPacks();

  return (
    <OnboardingWizard
      token={token}
      instanceDomain={INSTANCE_DOMAIN}
      packs={packs}
    />
  );
}
