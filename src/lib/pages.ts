import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sitePages } from "@/db/schema";
import { renderMarkdown, slugify } from "@/lib/markdown";

/** Slug de la page « mentions légales » (page par défaut, toujours disponible). */
export const MENTIONS_LEGALES_SLUG = "mentions-legales";

/**
 * Slugs réservés : routes statiques existantes à la racine. Une page portant un
 * de ces slugs serait **masquée** par la route statique (qui gagne sur la route
 * dynamique `[handle]`) → on interdit sa création pour éviter toute confusion.
 * `new` est réservé car `/admin/pages/new` masquerait son édition.
 */
export const RESERVED_SLUGS = new Set([
  "login",
  "signup",
  "feed",
  "feeds",
  "recherche",
  "compose",
  "notifications",
  "preferences",
  "settings",
  "admin",
  "api",
  "users",
  "new",
]);

/** Contenu par défaut de la page « mentions légales » (cf. RGPD / Matomo). */
export const DEFAULT_LEGAL_MARKDOWN = `## Éditeur du site

Ce site est édité par **[À compléter : nom ou structure]**.
Directeur·rice de la publication : **[À compléter]**.
Contact : **[À compléter : adresse e-mail]**.

## Hébergement

Hébergé par **OVH SAS**, 2 rue Kellermann, 59100 Roubaix, France — ovhcloud.com.

## Propriété intellectuelle

Les contenus publiés par les autrices et auteurs restent leur propriété. Le
reste du site (code, identité visuelle) est mis à disposition par l'éditeur.

## Données personnelles (RGPD)

La création d'un compte nécessite une adresse e-mail et un mot de passe (stocké
sous forme chiffrée). Vous pouvez consulter, modifier ou supprimer vos données
depuis vos préférences ; la suppression de compte est immédiate et définitive.

Pour toute question relative à vos données : **[À compléter : adresse e-mail]**.

## Mesure d'audience

Ce site utilise **Matomo**, une solution de mesure d'audience respectueuse de la
vie privée : **sans cookie**, **sans traceur publicitaire**, avec
**anonymisation des adresses IP** et **respect du signal « Do Not Track »** de
votre navigateur. Aucune donnée n'est partagée avec des tiers. Cette mesure
étant exemptée de consentement (lignes directrices de la CNIL), aucun bandeau ne
vous est imposé.`;

/**
 * Pages « par défaut » fournies par le code : disponibles immédiatement (avant
 * tout enregistrement) et éditables depuis l'admin. Pour l'instant, seule la
 * page « mentions légales ».
 */
export const DEFAULT_PAGES: Record<string, { title: string; markdown: string }> =
  {
    [MENTIONS_LEGALES_SLUG]: {
      title: "Mentions légales",
      markdown: DEFAULT_LEGAL_MARKDOWN,
    },
  };

/** Un slug est valide s'il est en kebab-case alphanumérique (a-z, 0-9, tirets). */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** Normalise une saisie en slug d'URL (réutilise `slugify`). */
export function toSlug(input: string): string {
  return slugify(input);
}

export interface SitePageView {
  slug: string;
  title: string;
  contentMarkdown: string;
  contentHtml: string;
  updatedAt: Date | null;
  /** Vrai si l'on sert un contenu par défaut (aucune ligne enregistrée). */
  isDefault: boolean;
}

/**
 * Renvoie la page de slug donné : la version enregistrée si elle existe, sinon
 * le contenu par défaut (mentions légales) rendu à la volée, sinon `null`.
 */
export async function getPage(slug: string): Promise<SitePageView | null> {
  const row = await db.query.sitePages.findFirst({
    where: eq(sitePages.slug, slug),
  });
  if (row) {
    return {
      slug: row.slug,
      title: row.title,
      contentMarkdown: row.contentMarkdown,
      contentHtml: row.contentHtml,
      updatedAt: row.updatedAt,
      isDefault: false,
    };
  }
  const def = DEFAULT_PAGES[slug];
  if (def) {
    return {
      slug,
      title: def.title,
      contentMarkdown: def.markdown,
      contentHtml: renderMarkdown(def.markdown),
      updatedAt: null,
      isDefault: true,
    };
  }
  return null;
}

export interface PageListItem {
  slug: string;
  title: string;
  updatedAt: Date | null;
  isDefault: boolean;
}

/**
 * Liste des pages gérables depuis l'admin : les pages enregistrées + les pages
 * par défaut pas encore enregistrées (mentions légales), triées par titre.
 */
export async function listPages(): Promise<PageListItem[]> {
  const rows = await db.query.sitePages.findMany({
    orderBy: [asc(sitePages.title)],
  });
  const saved = new Set(rows.map((r) => r.slug));
  const items: PageListItem[] = rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    updatedAt: r.updatedAt,
    isDefault: false,
  }));
  for (const [slug, def] of Object.entries(DEFAULT_PAGES)) {
    if (!saved.has(slug)) {
      items.push({ slug, title: def.title, updatedAt: null, isDefault: true });
    }
  }
  return items.sort((a, b) => a.title.localeCompare(b.title, "fr"));
}
