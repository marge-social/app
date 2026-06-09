import { permanentRedirect } from "next/navigation";

/** Le « mon fil » a fusionné avec la home (§Lot 3). Ancienne route conservée
 *  en redirection permanente pour ne pas casser les liens existants. */
export default function FeedRedirect() {
  permanentRedirect("/");
}
