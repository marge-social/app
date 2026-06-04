import { permanentRedirect } from "next/navigation";

/** La page de lecture « Flux » a fusionné avec la home (§Lot 3) : les items des
 *  flux suivis apparaissent dans le fil unifié. La déclaration de ses propres
 *  flux se fait désormais sur le profil ; la découverte via la recherche.
 *  Le détail d'un flux reste disponible sur /feeds/[id]. */
export default function FeedsRedirect() {
  permanentRedirect("/");
}
