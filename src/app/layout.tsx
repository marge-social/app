import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { MatomoAnalytics } from "@/components/MatomoAnalytics";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getServerI18n } from "@/lib/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} dict={dict}>
          {matomoUrl && matomoSiteId && (
            <MatomoAnalytics url={matomoUrl} siteId={matomoSiteId} />
          )}
          <a href="#main-content" className="skip-link">
            {dict.common.skipToContent}
          </a>
          <SiteHeader />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-3xl flex-1 px-4 py-8"
          >
            {children}
          </main>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
