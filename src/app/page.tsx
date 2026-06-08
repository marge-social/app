import { DiscoverShell } from "@/components/discover/DiscoverShell";

/**
 * Home « Découvrir » — écran principal (fil visiteur public).
 *
 * Phase pré-bêta : couche visuelle uniquement, à partir du prototype Claude
 * Design « Home Visiteur ». Données 100 % de démo (`@/lib/mock/discover`), aucun
 * appel DB / ActivityPub / réseau. Le shell interactif (curseurs, suivis,
 * enregistrements) vit dans `DiscoverShell` (île client). Le câblage métier
 * (auth, fédération, persistance) viendra dans une étape ultérieure.
 */
export default function HomePage() {
  return <DiscoverShell />;
}
