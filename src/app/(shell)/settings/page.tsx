import { permanentRedirect } from "next/navigation";

/** « Réglages » a été renommé /preferences (URL sans accent, §Lot 5).
 *  Redirection permanente pour ne pas casser les liens existants. */
export default function SettingsRedirect() {
  permanentRedirect("/preferences");
}
