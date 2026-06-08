/**
 * Données de DÉMO pour la home « Découvrir » (phase pré-bêta, couche visuelle).
 *
 * ⚠️ Aucune source réelle ici : ni DB, ni ActivityPub, ni réseau. Les types sont
 * pensés pour anticiper les futurs modèles (Drizzle `posts`/`articles`/`users`,
 * objets Fedify Note/Article/Video) sans rien y brancher. Quand le câblage
 * arrivera, ces structures serviront de cible de mapping — pas l'inverse.
 */

/** Formats publiables. Aligné sur la décision Note vs Article du cahier
 *  (microblog `Note` sans titre ; `Article` titré), étendu côté UI par les
 *  variantes éditoriales « analyse » et « vidéo commentée ». */
export type FeedFormat = "billet" | "note" | "analyse" | "video";

/** Réputation décomposée d'un auteur (signaux coûteux, jamais agrégés en score
 *  caché — cf. note algorithmique du design). */
export interface AuthorReputation {
  /** Textes publiés. */
  textes: number;
  /** Citations reçues. */
  citations: number;
  /** Réponses-billets suscitées. */
  reponses: number;
  /** Taux de lectures complètes (pourcentage). */
  complete: number;
  /** Abonnés fidèles (libellé pré-formaté, ex. « 1,2 k »). */
  abonnes: string;
}

export interface MockAuthor {
  /** Identifiant local stable (futur `users.id`/handle). */
  id: string;
  name: string;
  /** Handle court, préfixé `@` (futur `fediverseHandle`). */
  handle: string;
  /** Couleur de la pastille d'avatar (les avatars réels viendront de S3). */
  color: string;
  rep: AuthorReputation;
}

/** Compteurs publics et honnêtes : visibles de tous, **jamais** utilisés pour
 *  trier (cf. §8 option c). Tous optionnels selon le format. */
export interface PostMetrics {
  vues: string;
  reactions: number;
  reponses?: number;
  annotations?: number;
  sources?: number;
}

/** Raison concrète et nommée de la remontée d'un contenu. Aucun score caché. */
export interface RemonteeReason {
  kind: "depth" | "social" | "recency" | "discovery" | "controversy";
  txt: string;
}

export type PostMedia =
  | { kind: "img"; caption?: string; credit?: string }
  | {
      kind: "video";
      duration: string;
      label: string;
      caption?: string;
      /** Positions (0..1) des annotations à la seconde sur la timeline. */
      annotations: number[];
    }
  | { kind: "doc"; name: string; sub: string };

/** Position d'un contenu sur trois axes lisibles (0..1). Sert au tri par
 *  affinité avec les curseurs du lecteur — la logique est publique et locale. */
export interface PostProfile {
  depth: number;
  discovery: number;
  controversy: number;
}

export interface MockPost {
  id: string;
  fmt: FeedFormat;
  /** Clé d'auteur dans {@link AUTHORS}. */
  author: string;
  /** Titre (billet/analyse/vidéo). Absent pour une note brève. */
  title?: string;
  /** Chapô éditorial (billet/analyse/vidéo). */
  chapo?: string;
  /** Corps d'une note brève (pas de titre). */
  body?: string;
  /** Extrait long affiché sur le fil (billet/analyse/vidéo). */
  excerpt?: string;
  /** Citation mise en exergue (analyses). */
  pull?: string;
  media?: PostMedia;
  /** Libellé relatif pré-formaté (ex. « il y a 2 jours »). */
  publishedAgo: string;
  metrics: PostMetrics;
  profile: PostProfile;
  reasons: RemonteeReason[];
}

/** Conversation en cours (réponses-billets reliées) pour le rail droit. */
export interface MockThread {
  source: { title: string; author: string };
  reply: { title: string; author: string };
  context: string;
}

// ─── Auteurs ─────────────────────────────────────────────────────────────────
export const AUTHORS: Record<string, MockAuthor> = {
  lea: {
    id: "lea",
    name: "Léa Mercier",
    handle: "@lea",
    color: "#7A4A22",
    rep: { textes: 12, citations: 31, reponses: 156, complete: 78, abonnes: "1,2 k" },
  },
  maxime: {
    id: "maxime",
    name: "Maxime Lefort",
    handle: "@maxime",
    color: "#3F6F8F",
    rep: { textes: 27, citations: 8, reponses: 24, complete: 41, abonnes: "312" },
  },
  adele: {
    id: "adele",
    name: "Adèle Faure",
    handle: "@adele",
    color: "#7E5C8E",
    rep: { textes: 6, citations: 19, reponses: 47, complete: 81, abonnes: "540" },
  },
  theo: {
    id: "theo",
    name: "Théo Marchais",
    handle: "@theo",
    color: "#406B4A",
    rep: { textes: 12, citations: 47, reponses: 22, complete: 67, abonnes: "2,3 k" },
  },
  apolline: {
    id: "apolline",
    name: "Apolline Vauthier",
    handle: "@apolline",
    color: "#8B3A1F",
    rep: { textes: 8, citations: 12, reponses: 18, complete: 68, abonnes: "210" },
  },
  bastien: {
    id: "bastien",
    name: "Bastien Roy",
    handle: "@bastien",
    color: "#5A5A2A",
    rep: { textes: 11, citations: 14, reponses: 32, complete: 73, abonnes: "480" },
  },
  salome: {
    id: "salome",
    name: "Salomé Brun",
    handle: "@salome",
    color: "#6E4A4A",
    rep: { textes: 7, citations: 21, reponses: 39, complete: 76, abonnes: "720" },
  },
};

/** Initiales (max 2) d'un nom, pour les pastilles d'avatar. */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ─── Fil ─────────────────────────────────────────────────────────────────────
export const POSTS: MockPost[] = [
  {
    id: "p1",
    fmt: "analyse",
    author: "lea",
    title: "Les conditions techniques d'une délibération en ligne",
    chapo:
      "On ne sortira pas de la guerre des opinions par la modération seule. Les architectures qui rendent possible — ou non — une discussion lente méritent leur revue critique.",
    excerpt:
      "On a beaucoup écrit sur les contenus, peu sur ce qui en organise la circulation. Or, ce qui fait qu'une conversation publique se tient, ou s'effondre, tient moins aux opinions échangées qu'aux conditions matérielles dans lesquelles elles s'expriment : la place laissée au délai, le coût des contributions, la visibilité accordée aux réponses argumentées, la possibilité pour un lecteur de revenir trois jours plus tard sans avoir tout perdu. Ce sont des questions techniques, et elles méritent leur revue critique — pièce par pièce, fonctionnalité par fonctionnalité.",
    pull: "Le problème n'est pas qu'on échange peu, c'est qu'on échange toujours dans les mêmes conditions de temps, d'attention et de visibilité — celles de la salle des marchés.",
    media: {
      kind: "img",
      caption: "Schéma — architectures délibératives comparées",
      credit: "Illustration : L. Mercier, 2025",
    },
    publishedAgo: "il y a 2 jours",
    metrics: { vues: "4 218", reactions: 142, reponses: 18, annotations: 87, sources: 14 },
    profile: { depth: 0.95, discovery: 0.3, controversy: 0.45 },
    reasons: [
      { kind: "depth", txt: "14 sources et 67% de lectures complètes" },
      { kind: "social", txt: "Citée par 3 auteurs que vous suivez" },
    ],
  },
  {
    id: "p2",
    fmt: "billet",
    author: "lea",
    title: "Le ralentissement comme méthode",
    chapo:
      "Et si la première contribution d'un média était de remettre des heures entre la lecture et l'écriture ?",
    excerpt:
      "Pendant longtemps j'ai cru que la lenteur était une posture, le luxe défensif d'auteurs qui se croient au-dessus du présent. J'en suis revenue. Le ralentissement n'est pas un style, c'est une infrastructure : ce sont des champs qu'on ne publie pas, des compteurs qu'on n'affiche pas, des notifications qu'on retarde, des fils qu'on assume de laisser maturer une nuit complète avant de les rouvrir. La méthode peut s'écrire — et même se mesurer, à condition d'accepter que les bons indicateurs sont ceux qui ne s'enflamment pas.",
    publishedAgo: "il y a 4 h",
    metrics: { vues: "1 312", reactions: 64, reponses: 9, annotations: 28, sources: 4 },
    profile: { depth: 0.6, discovery: 0.35, controversy: 0.25 },
    reasons: [
      { kind: "social", txt: "Auteure suivie · 9 réponses-billets reçues" },
      { kind: "depth", txt: "78% de lectures complètes" },
    ],
  },
  {
    id: "p3",
    fmt: "note",
    author: "maxime",
    body: "Quelqu'un a déjà remarqué que les fils où l'on partage le moins sont aussi ceux où l'on lit le mieux ? Je me demande si ce n'est pas un signal qu'on devrait commencer à mesurer — un « taux de lecture profonde » qui serait inversement corrélé au taux de re-partage immédiat. Intuition de comptoir, à creuser ; mais si quelqu'un a une étude qui va dans ce sens, je preneur.",
    publishedAgo: "il y a 1 h",
    metrics: { vues: "412", reactions: 28, annotations: 6 },
    profile: { depth: 0.15, discovery: 0.55, controversy: 0.55 },
    reasons: [
      { kind: "recency", txt: "Publié il y a 1 h · 4 abonnés que vous suivez ont annoté" },
    ],
  },
  {
    id: "p-video",
    fmt: "video",
    author: "adele",
    title: "Lire ensemble : sur le terrain avec une rédaction de quartier",
    chapo:
      "Trois mois passés à filmer comment se prennent les décisions éditoriales dans un journal de proximité. Vidéo commentée, ouverte aux annotations à la seconde.",
    excerpt:
      "On parle beaucoup des grandes rédactions et de leurs algorithmes ; ce film s'arrête à l'autre bout de la chaîne, dans une rédaction de huit personnes qui distribuent trente exemplaires papier le mardi matin. J'ai filmé six conférences de rédaction, deux bouclages, une assemblée d'abonnés. Le format vidéo commenté permet de poser une annotation à la seconde précise : ce que la rédaction dit, ce qu'elle ne dit pas, et les hésitations qui se voient à l'écran mais ne passent jamais dans le compte-rendu écrit.",
    media: {
      kind: "video",
      duration: "14:32",
      label: "Vidéo commentée",
      caption: "Conférence de rédaction du mardi · prise 03",
      annotations: [0.18, 0.34, 0.52, 0.71, 0.86],
    },
    publishedAgo: "il y a 18 h",
    metrics: { vues: "1 902", reactions: 78, reponses: 5, annotations: 142, sources: 3 },
    profile: { depth: 0.7, discovery: 0.75, controversy: 0.3 },
    reasons: [
      {
        kind: "depth",
        txt: "142 annotations à la seconde — densité de lecture exceptionnelle",
      },
      { kind: "discovery", txt: "Format vidéo commentée, expérimental" },
    ],
  },
  {
    id: "p4",
    fmt: "billet",
    author: "adele",
    title: "Pourquoi mes voisins ne me lisent pas",
    chapo:
      "Confessions d'une autrice de quartier : j'écris pour des inconnus à 600 km, et je ne sais plus parler à la pharmacienne d'en bas.",
    excerpt:
      "L'algorithme m'a appris à écrire pour des lecteurs que je n'avais jamais vus, et j'ai désappris à écrire pour ceux que je croisais tous les jours. Le constat n'est pas neuf — il est au cœur du travail de Charles Taylor sur l'imaginaire moderne — mais il prend une couleur particulière quand on tient une chronique locale. Mes voisins ne me lisent pas parce que je n'écris plus pour eux : je sélectionne mes sujets en pensant aux RSS de Bruxelles, mes images en pensant à Twitter, mes titres en pensant à Google.",
    media: {
      kind: "doc",
      name: "Notes de terrain — rue Léon-Frot.pdf",
      sub: "PDF · 2.4 Mo · 14 pages · annoté par 6 lecteurs",
    },
    publishedAgo: "il y a 8 h",
    metrics: { vues: "987", reactions: 51, reponses: 4, annotations: 19, sources: 2 },
    profile: { depth: 0.5, discovery: 0.8, controversy: 0.4 },
    reasons: [
      { kind: "discovery", txt: "Découverte : autrice jamais lue par votre cercle" },
      { kind: "depth", txt: "81% de lectures complètes" },
    ],
  },
  {
    id: "p5",
    fmt: "analyse",
    author: "theo",
    title: "L'économie politique des systèmes de recommandation",
    chapo:
      "Personne ne classe pour rien. Une revue de ce que les recommandeurs récompensent vraiment — et de qui en paie le prix.",
    excerpt:
      "Les systèmes de recommandation sont présentés comme des outils techniques, parfois imparfaits, jamais politiques. Cette posture est intenable. Tout classement valorise certains coûts et en externalise d'autres ; en l'occurrence, les plateformes dominantes ont fait le choix presque universel d'optimiser pour la durée de session, c'est-à-dire pour la fidélité comportementale d'un utilisateur à un fil — au détriment de la qualité de l'argumentation, de la diversité des sources, et de la rémunération des auteurs qui écrivent lentement.",
    pull: "Optimiser pour la durée de session n'est pas un choix technique, c'est une décision sur ce qui doit circuler dans l'espace public.",
    media: {
      kind: "img",
      caption: "Figure 4 — flux de valeur dans 6 plateformes étudiées",
      credit: "T. Marchais · CC BY-SA",
    },
    publishedAgo: "il y a 3 jours",
    metrics: { vues: "6 802", reactions: 213, reponses: 24, annotations: 142, sources: 21 },
    profile: { depth: 0.9, discovery: 0.55, controversy: 0.85 },
    reasons: [
      { kind: "controversy", txt: "Sujet contesté : 3 réponses-billets de désaccord publiées" },
      { kind: "depth", txt: "21 sources académiques attachées" },
    ],
  },
  {
    id: "p6",
    fmt: "note",
    author: "apolline",
    body: "Relisant la circulaire interministérielle de 2023 sur l'interopérabilité : il y a un paragraphe entier — § 3.4 sur les obligations de portabilité descendante — qui mériterait sa réponse-billet. À méditer ce week-end, peut-être un texte court d'ici mardi. Si quelqu'un est déjà allé sur ce terrain, je suis preneuse de lectures.",
    publishedAgo: "il y a 6 h",
    metrics: { vues: "184", reactions: 14, annotations: 3 },
    profile: { depth: 0.3, discovery: 0.2, controversy: 0.2 },
    reasons: [{ kind: "social", txt: "Vous lisez régulièrement les notes de cette autrice" }],
  },
  {
    id: "p7",
    fmt: "billet",
    author: "bastien",
    title: "Contre l'urgence — éloge des textes qu'on garde au tiroir",
    chapo:
      "Tous les bons billets que j'ai publiés ont attendu au moins trois jours. Tous les mauvais sont partis le soir-même.",
    excerpt:
      "Je fais le compte sur dix ans d'écriture en ligne. Trente-deux textes que je relis encore avec plaisir ; tous ont passé au moins une nuit dans un tiroir, la plupart trois ou quatre. À l'inverse, les billets que je voudrais effacer rétrospectivement ont une caractéristique commune : ils ont été publiés dans l'heure qui a suivi leur conception. Ce n'est pas un problème de moi, c'est un problème de format.",
    media: {
      kind: "img",
      caption: "Photographie d'archive — bureau de l'auteur",
      credit: "Cliché : B. Roy",
    },
    publishedAgo: "il y a 1 jour",
    metrics: { vues: "1 740", reactions: 89, reponses: 6, annotations: 31, sources: 1 },
    profile: { depth: 0.55, discovery: 0.5, controversy: 0.35 },
    reasons: [{ kind: "depth", txt: "73% de lectures complètes · 6 réponses-billets" }],
  },
  {
    id: "p8",
    fmt: "billet",
    author: "salome",
    title: "La fabrique du commentaire ordinaire",
    chapo:
      "Ce que les boîtes à commentaires des journaux nous ont fait perdre. Et ce qu'un format de « réponse-billet » pourrait, ou non, restituer.",
    excerpt:
      "On se souvient mal des forums modérés des journaux des années 2000. Ils étaient lents, parfois autoritaires, souvent décevants ; mais ils produisaient quelque chose qu'aucun fil de commentaires actuel ne produit plus : un texte de lecteur qu'on pouvait citer comme on citerait un éditorial. La question que je voudrais poser ici est de savoir si un format de « réponse-billet » restaure cette dignité, ou s'il en simule simplement la forme sans en retrouver les conditions.",
    media: {
      kind: "doc",
      name: "Corpus — 240 commentaires Le Monde 2003-2009.pdf",
      sub: "PDF · 8.1 Mo · transcrits & anonymisés",
    },
    publishedAgo: "il y a 16 h",
    metrics: { vues: "2 110", reactions: 96, reponses: 11, annotations: 44, sources: 5 },
    profile: { depth: 0.65, discovery: 0.6, controversy: 0.55 },
    reasons: [
      { kind: "depth", txt: "5 sources + 11 réponses-billets" },
      { kind: "discovery", txt: "Hors de votre cercle habituel" },
    ],
  },
  {
    id: "p9",
    fmt: "note",
    author: "theo",
    body: "Note de lecture : la thèse de Mercier sur les « signaux coûteux » devrait être lue à côté de Boyd 2010 sur les commons. Les deux disent la même chose, depuis deux disciplines différentes — l'une depuis la pragmatique, l'autre depuis l'économie institutionnelle — et la convergence est, je trouve, suffisamment frappante pour mériter un texte croisé. Je m'y attelle.",
    publishedAgo: "il y a 12 h",
    metrics: { vues: "428", reactions: 22, annotations: 8 },
    profile: { depth: 0.45, discovery: 0.4, controversy: 0.3 },
    reasons: [{ kind: "social", txt: "Cite une autrice que vous suivez" }],
  },
];

/** Profil « moi » affiché dans le rail gauche (démo). */
export const ME = {
  author: AUTHORS.apolline,
  drafts: 3,
  saved: 17,
  replies: 4,
  annotations: 29,
  topics: [
    "délibération",
    "médias locaux",
    "interopérabilité",
    "économie de l'attention",
    "communs numériques",
  ],
  resume: {
    title: "L'économie politique des systèmes…",
    author: "Théo Marchais",
    progress: "38% lu",
  },
};

/** Auteurs mis en avant dans le rail droit (clés vers {@link AUTHORS}). */
export const FEATURED_AUTHOR_IDS = ["lea", "theo", "adele", "bastien"];

/** Suivis initiaux (démo) pour l'état des boutons « Suivre ». */
export const INITIAL_FOLLOWING: Record<string, boolean> = {
  lea: true,
  adele: true,
  theo: false,
  bastien: false,
};

export const THREADS: MockThread[] = [
  {
    source: {
      title: "L'économie politique des systèmes de recommandation",
      author: "Théo Marchais",
    },
    reply: { title: "L'algorithme n'est pas seul en cause", author: "Léa Mercier" },
    context: "3 réponses-billets · 2 jours d'écart",
  },
  {
    source: { title: "Le ralentissement comme méthode", author: "Léa Mercier" },
    reply: { title: "Réponse : la lenteur est un privilège", author: "Salomé Brun" },
    context: "1 réponse-billet · publié il y a 18 h",
  },
];

// ─── Tri par affinité (logique publique, locale, sans score caché) ───────────

export interface SliderState {
  depth: number;
  discovery: number;
  controversy: number;
}

export const DEFAULT_SLIDERS: SliderState = {
  depth: 0.7,
  discovery: 0.4,
  controversy: 0.5,
};

/** Score d'affinité 0..1 : 1 − distance moyenne entre le profil du contenu et
 *  la position des curseurs, chaque axe pesant identiquement. Aucun poids caché
 *  — c'est précisément l'argument du design. */
export function scorePost(post: MockPost, sliders: SliderState): number {
  const d = Math.abs(post.profile.depth - sliders.depth);
  const x = Math.abs(post.profile.discovery - sliders.discovery);
  const c = Math.abs(post.profile.controversy - sliders.controversy);
  return 1 - (d + x + c) / 3;
}

/** Réordonne le fil selon les curseurs (tri stable décroissant par affinité). */
export function orderPosts(posts: MockPost[], sliders: SliderState): MockPost[] {
  return posts
    .map((post, index) => ({ post, index }))
    .sort((a, b) => {
      const diff = scorePost(b.post, sliders) - scorePost(a.post, sliders);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ post }) => post);
}

/** Traduit l'état des curseurs en une phrase « vous lisez actuellement… ».
 *  Le `<em>` est intentionnel (rendu via balisage, pas dangerouslySetInnerHTML). */
export function describeFeed(sliders: SliderState): string {
  const parts: string[] = [];
  if (sliders.depth > 0.62) parts.push("des textes <em>longs et sourcés</em>");
  else if (sliders.depth < 0.38) parts.push("des publications <em>récentes</em>");

  if (sliders.discovery > 0.62)
    parts.push(parts.length ? "<em>hors de votre cercle</em>" : "des auteurs <em>que vous ne lisez pas encore</em>");
  else if (sliders.discovery < 0.38)
    parts.push(parts.length ? "venus de <em>vos abonnements</em>" : "des publications de <em>vos abonnements</em>");

  if (sliders.controversy > 0.62) parts.push("avec une <em>controverse en cours</em>");
  else if (sliders.controversy < 0.38) parts.push("autour de <em>consensus assumés</em>");

  if (!parts.length) return "un fil équilibré sur les trois axes.";
  return parts.join(", ") + ".";
}
