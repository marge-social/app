"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

interface MatomoAnalyticsProps {
  /** URL de l'instance Matomo (ex. https://analytics.kilometre-0.fr). */
  url: string;
  /** Identifiant du site Matomo (ex. 10). */
  siteId: string;
}

/**
 * Suivi d'audience Matomo configuré pour être conforme RGPD **sans bandeau de
 * consentement** (mesure d'audience exemptée — lignes directrices CNIL), ce qui
 * évite un dark pattern contraire à l'éthique du projet :
 *  - **sans cookie** (`disableCookies`) → aucun traceur persistant déposé ;
 *  - **respecte Do Not Track / Global Privacy Control** → aucune collecte si le
 *    visiteur a activé le signal côté navigateur ;
 *  - n'envoie que le **chemin** de la page (`location.origin + pathname`), jamais
 *    la query string : ni terme de recherche, ni jeton, aucune donnée perso.
 *
 * À activer **aussi côté serveur Matomo** (réglages d'instance, hors app, requis
 * pour l'exemption) : anonymisation d'IP ≥ 2 octets et respect du DNT.
 *
 * Lit ses paramètres en props (fournies par le layout serveur depuis l'env
 * runtime) plutôt que via `NEXT_PUBLIC_*` : ces dernières seraient inlinées au
 * `next build` (étape Docker sans les variables runtime) donc indisponibles.
 */
export function MatomoAnalytics({ url, siteId }: MatomoAnalyticsProps) {
  const pathname = usePathname();
  const startedRef = useRef(false);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Respect du signal « ne pas pister » du navigateur (DNT / GPC).
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    const win = window as Window & { doNotTrack?: string };
    if (
      nav.doNotTrack === "1" ||
      win.doNotTrack === "1" ||
      nav.globalPrivacyControl === true
    ) {
      return;
    }

    const base = `${url.replace(/\/+$/, "")}/`;
    const holder = window as Window & { _paq?: unknown[][] };
    const paq = (holder._paq = holder._paq ?? []);
    const currentUrl = window.location.origin + pathname;

    if (!startedRef.current) {
      startedRef.current = true;
      paq.push(["disableCookies"]);
      paq.push(["setTrackerUrl", `${base}matomo.php`]);
      paq.push(["setSiteId", siteId]);
      paq.push(["setCustomUrl", currentUrl]);
      paq.push(["setDocumentTitle", document.title]);
      paq.push(["trackPageView"]);
      paq.push(["enableLinkTracking"]);
      prevUrlRef.current = currentUrl;

      const script = document.createElement("script");
      script.async = true;
      script.src = `${base}matomo.js`;
      document.head.appendChild(script);
      return;
    }

    // Navigation SPA suivante (App Router) : l'URL précédente devient le référent.
    if (prevUrlRef.current) paq.push(["setReferrerUrl", prevUrlRef.current]);
    paq.push(["setCustomUrl", currentUrl]);
    paq.push(["setDocumentTitle", document.title]);
    paq.push(["trackPageView"]);
    prevUrlRef.current = currentUrl;
  }, [pathname, url, siteId]);

  return null;
}
