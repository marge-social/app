import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { MatomoAnalytics } from "@/components/MatomoAnalytics";
import { getServerI18n } from "@/lib/i18n/server";

// Typographie du design : Newsreader (sérif éditoriale — titres, chapôs, notes),
// Inter Tight (sans — UI), JetBrains Mono (mono — légendes techniques).
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerI18n();
  return {
    title: dict.meta.title,
    description: dict.meta.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Mesure d'audience Matomo : activée uniquement si l'instance est configurée
  // (env runtime, lue côté serveur). Absente en dev = aucun suivi.
  const matomoUrl = process.env.MATOMO_URL;
  const matomoSiteId = process.env.MATOMO_SITE_ID;

  const { locale, dict } = await getServerI18n();

  return (
    <html
      lang={locale}
      className={`${newsreader.variable} ${interTight.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} dict={dict}>
          {matomoUrl && matomoSiteId && (
            <MatomoAnalytics url={matomoUrl} siteId={matomoSiteId} />
          )}
          {/* Le chrome global (en-tête + pied) vit dans le layout du groupe
              `(shell)` ; le portail visiteur (home déconnectée) s'en affranchit
              pour fournir son propre en-tête/pied plein écran. */}
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
