import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sitePages } from "@/db/schema";
import { renderMarkdown } from "@/lib/markdown";

/** Slug unique de la page « mentions légales » dans `site_pages`. */
export const LEGAL_SLUG = "mentions-legales";
/** Titre de la page (fixe ; le corps est éditable en Markdown depuis l'admin). */
export const LEGAL_TITLE = "Mentions légales";

/**
 * Contenu **par défaut** servi tant que l'admin n'a rien enregistré. Volontaire-
 * ment minimal et truffé de marqueurs `[À compléter]` : l'éditeur·rice le
 * complète depuis `/admin/mentions-legales`. La section « Mesure d'audience »
 * documente le suivi Matomo conforme RGPD déjà en place.
 */
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

export interface LegalPage {
  title: string;
  contentMarkdown: string;
  contentHtml: string;
  updatedAt: Date | null;
  /** Vrai si l'on sert le contenu par défaut (aucune ligne enregistrée). */
  isDefault: boolean;
}

/**
 * Renvoie la page « mentions légales » : la version enregistrée si elle existe,
 * sinon le contenu par défaut rendu à la volée. Toujours sûr à afficher.
 */
export async function getLegalPage(): Promise<LegalPage> {
  const row = await db.query.sitePages.findFirst({
    where: eq(sitePages.slug, LEGAL_SLUG),
  });
  if (row) {
    return {
      title: row.title,
      contentMarkdown: row.contentMarkdown,
      contentHtml: row.contentHtml,
      updatedAt: row.updatedAt,
      isDefault: false,
    };
  }
  return {
    title: LEGAL_TITLE,
    contentMarkdown: DEFAULT_LEGAL_MARKDOWN,
    contentHtml: renderMarkdown(DEFAULT_LEGAL_MARKDOWN),
    updatedAt: null,
    isDefault: true,
  };
}
