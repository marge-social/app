import Link from "next/link";
import { Avatar } from "@/components/discover/Avatar";

export interface MeSummary {
  name: string;
  handle: string;
  /** Handle fédéré complet `@user@domaine` (affiché sous le nom). */
  fediHandle: string;
  /** URL de l'avatar S3/legacy, ou null → pastille à initiales. */
  avatarSrc: string | null;
  /** Couleur de la pastille de repli. */
  color: string;
  textes: number;
  abonnes: number;
}

/** Rail gauche — carte profil **réelle** de l'utilisateur connecté + navigation
 *  personnelle (liens réels uniquement). Les éléments du prototype sans donnée
 *  backend (sujets suivis, reprise de lecture, compteurs de brouillons…) sont
 *  retirés tant que les sources n'existent pas. */
export function LeftRail({ me }: { me: MeSummary }) {
  return (
    <aside className="rail-left" aria-label="Mon espace">
      <div className="me-card">
        <div className="me-head">
          {me.avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={me.avatarSrc}
              alt=""
              width={44}
              height={44}
              style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <Avatar name={me.name} color={me.color} size={44} />
          )}
          <div className="min-w-0">
            <div className="me-name">{me.name}</div>
            <div className="me-handle">{me.fediHandle}</div>
          </div>
        </div>
        <div className="me-stats">
          <div className="me-stat">
            <div className="v">{me.textes}</div>
            <div className="l">textes publiés</div>
          </div>
          <div className="me-stat">
            <div className="v">{me.abonnes}</div>
            <div className="l">abonnés</div>
          </div>
        </div>
      </div>

      <nav className="nav-side" aria-label="Mon espace">
        <h4>Mon espace</h4>
        <Link href={`/@${me.handle}`}>
          <span>Mon profil</span>
        </Link>
        <Link href="/compose">
          <span>Écrire un texte</span>
        </Link>
        <Link href="/notifications">
          <span>Notifications</span>
        </Link>
        <Link href="/preferences">
          <span>Préférences</span>
        </Link>
      </nav>
    </aside>
  );
}
