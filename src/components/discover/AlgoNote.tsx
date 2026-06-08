"use client";

import { useEffect, useState } from "react";

/** Modale « note algorithmique » — transparence du classement. */
function AboutAlgoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="algo-note-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-hd">
          <h3 id="algo-note-title">Note algorithmique — Marge</h3>
          <button type="button" className="x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>
            Marge utilise un classement algorithmique, comme toute plateforme qui publie plus de
            textes qu’il n’y a d’heures pour les lire. Ce qui change ici :
          </p>
          <ul>
            <li>
              <strong>Les critères sont publics et nommés.</strong> Aucun score agrégé n’est calculé
              en coulisses.
            </li>
            <li>
              <strong>Les signaux coûteux pèsent plus que les signaux faciles.</strong> Une
              réponse-billet vaut plus qu’un like — parce qu’elle coûte plus.
            </li>
            <li>
              <strong>Les trois curseurs en haut du fil sont les vôtres.</strong> Ils déplacent
              réellement le classement ; rien n’est cosmétique.
            </li>
            <li>
              <strong>Chaque texte affiche la raison de sa remontée.</strong> Vous pouvez la
              contester, l’ignorer ou la prendre en compte.
            </li>
          </ul>
          <p>
            L’algorithme valorise : les réponses-billets reçues, le taux de lecture complète, les
            citations croisées entre textes, les annotations qualifiées, les sources citées, la
            fidélité d’audience. Il sous-pondère : les pics de réactivité, les likes et les vues
            seules.
          </p>
          <p style={{ color: "var(--ink-3)", fontSize: 12 }}>
            v1 · révisée trimestriellement · journal des changements public
          </p>
        </div>
      </div>
    </div>
  );
}

/** Encart « Comment Marge classe » + ouverture de la note algorithmique. */
export function AlgoNote() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="panel algo-card">
        <h3>Comment Marge classe</h3>
        <p>
          Trois curseurs en haut du fil. Aucun score caché. Chaque texte affiche la raison concrète
          de sa remontée.
        </p>
        <button type="button" className="algo-link" onClick={() => setOpen(true)}>
          Lire la note algorithmique →
        </button>
      </div>
      {open && <AboutAlgoModal onClose={() => setOpen(false)} />}
    </>
  );
}
