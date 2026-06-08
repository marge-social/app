"use client";

import { AUTHORS, FEATURED_AUTHOR_IDS } from "@/lib/mock/discover";
import { Avatar } from "@/components/discover/Avatar";

/** Rail droit — « À découvrir cette semaine ». Le bouton Suivre est interactif
 *  côté UI (état visuel) mais **non câblé** : aucun Follow ActivityPub émis. */
export function FeaturedAuthors({
  following,
  onToggleFollow,
}: {
  following: Record<string, boolean>;
  onToggleFollow: (id: string) => void;
}) {
  return (
    <div className="panel">
      <h3>
        <span>À découvrir cette semaine</span>
        {/* TODO: page « tous les auteurs ». */}
        <a href="#">Tous →</a>
      </h3>
      {FEATURED_AUTHOR_IDS.map((id) => {
        const a = AUTHORS[id];
        const isFollowing = !!following[id];
        return (
          <div key={id} className="featured-author">
            <Avatar name={a.name} color={a.color} />
            <div className="min-w-0">
              <div className="nm">{a.name}</div>
              <div className="meta-mini">
                <b>{a.rep.textes}</b> textes · <b>{a.rep.abonnes}</b> ab.
              </div>
            </div>
            <button
              type="button"
              className="follow"
              data-on={isFollowing}
              aria-pressed={isFollowing}
              onClick={() => onToggleFollow(id)}
            >
              {isFollowing ? "Abonné·e" : "Suivre"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
