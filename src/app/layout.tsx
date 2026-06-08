import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MatomoAnalytics } from "@/components/MatomoAnalytics";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Marge",
  description:
    "Un média social de contenus longs, sourcés et fédérés — à contre-courant de l'économie attentionnelle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Mesure d'audience Matomo : activée uniquement si l'instance est configurée
  // (env runtime, lue côté serveur). Absente en dev = aucun suivi.
  const matomoUrl = process.env.MATOMO_URL;
  const matomoSiteId = process.env.MATOMO_SITE_ID;

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {matomoUrl && matomoSiteId && (
          <MatomoAnalytics url={matomoUrl} siteId={matomoSiteId} />
        )}
        <a href="#main-content" className="skip-link">
          Aller au contenu
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
      </body>
    </html>
  );
}
