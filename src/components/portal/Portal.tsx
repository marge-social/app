import Link from "next/link";
import { Fragment } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { AuthCard } from "@/components/portal/AuthCard";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getServerI18n } from "@/lib/i18n/server";

/**
 * Portail visiteur (home déconnectée) : manifeste à gauche, carte
 * d'authentification à onglets à droite. Écran plein autonome — en-tête
 * (logo seul) et pied (liens + langue) dédiés, sans le chrome global.
 */
export async function Portal() {
  const { locale, dict } = await getServerI18n();
  const p = dict.portal;
  const signatureItems = p.signature.split("·").map((s) => s.trim());

  return (
    <div className="portal">
      <header className="portal-header">
        <Wordmark href="/" size={22} homeLabel={dict.nav.brandHome} />
      </header>

      <a href="#portal-panel" className="skip-link">
        {p.skipToCard}
      </a>

      <main id="main-content" tabIndex={-1} className="portal-main">
        <div className="portal-grid">
          <section className="portal-manifesto" aria-label={p.manifestoTitle}>
            <h1 className="portal-title">{p.manifestoTitle}</h1>
            <p className="portal-lede">{p.manifestoP1}</p>
            <p className="portal-lede">{p.manifestoP2}</p>

            <div className="portal-beta">
              <span className="portal-beta-tag">{p.betaTag}</span>
              <span className="portal-beta-text">{p.betaText}</span>
            </div>

            <div className="portal-signature">
              {signatureItems.map((item, i) => (
                <Fragment key={item}>
                  {i > 0 && <span className="portal-sig-dot" aria-hidden="true" />}
                  <span>{item}</span>
                </Fragment>
              ))}
            </div>
          </section>

          <div className="portal-auth">
            <AuthCard />
          </div>
        </div>
      </main>

      <footer className="portal-footer">
        <div className="portal-footer-left">
          <Wordmark size={15} />
          <nav className="portal-footer-links" aria-label={dict.nav.mainLabel}>
            <Link href="/a-propos">À propos</Link>
            <Link href="/charte">Charte</Link>
            <Link href="/confidentialite">Confidentialité</Link>
            <Link href="/federation">Fédération</Link>
          </nav>
        </div>
        <LocaleSwitcher current={locale} label={dict.common.language} />
      </footer>
    </div>
  );
}
