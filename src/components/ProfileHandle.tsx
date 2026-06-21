"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";

/**
 * Identifiant fédéré du profil, copiable d'un clic (affordance UI du prototype
 * « Profil Membre »). Affiche un repère « fédéré » et, après copie, un état
 * éphémère « copié ». Aucune logique métier : pur chrome d'interface.
 */
export function ProfileHandle({ handle }: { handle: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard indisponible : on ignore silencieusement */
    }
  }

  return (
    <button
      type="button"
      className="pf-handle"
      onClick={copy}
      aria-label={t.profile.copyHandle}
      title={t.profile.copyHandle}
    >
      <span className="fed-mark" aria-hidden="true">
        ⁂
      </span>
      <span>{handle}</span>
      {copied && <span className="pf-copied">{t.profile.copied}</span>}
    </button>
  );
}
