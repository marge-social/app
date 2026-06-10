/**
 * Dictionnaire **français** — source de vérité de la forme des messages.
 *
 * Le type `Messages` est dérivé de cet objet : toute autre langue (en.ts…) doit
 * en respecter exactement la structure, sinon erreur de compilation. Les chaînes
 * sont volontairement laissées « larges » (string) pour que les traductions
 * puissent diverger.
 *
 * Les entrées de la forme `{ one, other }` sont pluralisées via `plural()`.
 * Les marqueurs `{x}` sont remplis via `interpolate()`.
 */
const fr = {
  meta: {
    title: "Marge",
    description:
      "Un média social de contenus longs, sourcés et fédérés — à contre-courant de l'économie attentionnelle.",
  },
  common: {
    skipToContent: "Aller au contenu",
    language: "Langue",
    metaNotFound: "Introuvable — Marge",
    lastUpdated: "Dernière mise à jour le {date}.",
  },
  nav: {
    mainLabel: "Navigation principale",
    searchLabel: "Rechercher",
    searchPlaceholder: "Rechercher…",
    search: "Recherche",
    write: "Écrire",
    notifications: "Notifications",
    unread: { one: "{n} non lue", other: "{n} non lues" },
    unreadNotifications: {
      one: "{n} notification non lue",
      other: "{n} notifications non lues",
    },
    admin: "Admin",
    profile: "Profil",
    preferences: "Préférences",
    logout: "Se déconnecter",
    login: "Se connecter",
    signup: "Créer un compte",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },
  footer: {
    legal: "Mentions légales",
  },
  auth: {
    loginTitle: "Se connecter",
    signupTitle: "Créer un compte",
    noAccount: "Pas encore de compte ?",
    haveAccount: "Déjà inscrit·e ?",
    createAccountLink: "Créer un compte",
    loginLink: "Se connecter",
    displayName: "Nom affiché",
    handle: "Handle",
    handleHelp:
      "Lettres minuscules, chiffres, tirets. Formera ton identité fédérée.",
    email: "Email",
    password: "Mot de passe",
    passwordHelp: "Au moins 8 caractères.",
    submitSignup: "Créer mon compte",
    submitLogin: "Se connecter",
    pending: "Patiente…",
  },
  portal: {
    // En-tête / pied autonomes du portail visiteur.
    skipToCard: "Aller au formulaire de connexion",
    // Colonne manifeste.
    manifestoTitle: "Un média social réinventé.",
    manifestoP1:
      "Marge est un média social à contre-courant de l’économie attentionnelle : on y publie des contenus longs, on agrège des flux qu’on a choisis, et tout est nativement fédéré et interopérable.",
    manifestoP2:
      "Pas de manipulation cachée. Vous réglez vous-même ce qui remonte dans votre fil, et chaque texte affiche la raison concrète de sa présence.",
    betaTag: "BÊTA",
    betaText:
      "En ce moment, on pose les fondations. Inscrivez-vous et expérimentez avec nous.",
    signature: "Contenus longs d’abord · Flux choisis · Algorithme transparent",
    // Carte d’authentification — onglets.
    tabSignup: "Créer un compte",
    tabLogin: "Se connecter",
    // Mode inscription.
    signupHeading: "Créer un compte",
    signupSubtitle:
      "Quelques minutes suffisent. Vous pourrez tout affiner ensuite.",
    displayName: "Nom affiché",
    displayNamePlaceholder: "Camille Roussel",
    handle: "Handle",
    handleHint:
      "Lettres minuscules, chiffres, tirets. Formera ton identité fédérée.",
    email: "Email",
    emailPlaceholder: "camille@exemple.fr",
    password: "Mot de passe",
    passwordHint: "Au moins 8 caractères.",
    showPassword: "Afficher",
    hidePassword: "Masquer",
    submitSignup: "Créer mon compte",
    legalBefore: "En créant un compte, vous acceptez la",
    legalCharter: "charte",
    legalAnd: "et la",
    legalPrivacy: "politique de confidentialité",
    legalAfter: "de Marge.",
    // Mode connexion.
    loginHeading: "Se connecter",
    loginSubtitle: "Heureux de vous revoir sur Marge.",
    identifier: "Email ou handle",
    forgotPassword: "Mot de passe oublié ?",
    submitLogin: "Se connecter",
  },
  feed: {
    sources: {
      local: "compte Marge",
      fediverse: "Fediverse",
      rss: "flux RSS",
    },
    sharedBy: "partagé par {who}",
    permalink: "Permalien",
    untitled: "(sans titre)",
    like: "Aimer",
    unlike: "Retirer le like",
    share: "Partager",
    unshare: "Ne plus partager",
    replyWithArticle: "Répondre par un billet",
    articleReplyPrefix: "Réponse-billet :",
    comment: "Commenter",
    commentPlaceholder: "Commenter…",
    editPost: "Modifier",
    deletePost: "Supprimer",
    confirmDeletePost:
      "Supprimer ce message ? Cette action est définitive.",
    savePost: "Enregistrer",
    cancelEdit: "Annuler",
  },
  profile: {
    editProfile: "Modifier mon profil",
    avatarAlt: "Avatar de {name}",
    followAccount: "Suivre le compte",
    unfollowAccount: "Ne plus suivre le compte",
    loginToFollowLink: "Connecte-toi",
    loginToFollowSuffix: "pour suivre ce compte.",
    publishedTexts: "Textes publiés",
    noPublished: "Aucun texte publié pour l’instant.",
    declaredFeeds: "Flux RSS déclarés",
    noDeclaredFeeds: "Aucun flux déclaré pour l’instant.",
    followFeed: "Suivre ce flux",
    unfollowFeed: "Ne plus suivre ce flux",
    addMyFeed: "Ajouter mon flux",
    addMyFeedHelp:
      "Déclarez un flux RSS que vous possédez. Pour en revendiquer la propriété (et activer le texte intégral), passez par la page du flux. Suivre un flux n’est pas suivre un compte.",
    feedClaimed: "réclamé",
    feedReferenced: "référencé",
    removeFeed: "retirer",
  },
  search: {
    metaTitle: "Recherche — Marge",
    title: "Recherche",
    inputLabel: "Rechercher des contenus, comptes ou flux",
    placeholder: "Mots-clés, @compte@instance, titre de flux…",
    submit: "Rechercher",
    followShort: "Suivre",
    addThisFeed: "Ajouter ce flux",
    remoteNotFound:
      "« {q} » ressemble à un compte du Fediverse, mais il reste introuvable.",
    feedOptOut:
      "Ce flux a fait l’objet d’un retrait (opt-out) et ne peut pas être référencé.",
    feedAlreadyReferenced: "— déjà référencé, voir le flux",
    feedNotReadable: "Aucun flux RSS/Atom n’a pu être lu à cette adresse.",
    promptMinChars:
      "Saisissez au moins deux caractères pour rechercher des contenus, des comptes et des flux sur l’instance.",
    noResults: "Aucun résultat pour « {q} ».",
    sectionContents: "Contenus",
    sectionAccounts: "Comptes",
    sectionFeeds: "Flux",
    noContent: "Aucun contenu.",
    noAccount: "Aucun compte.",
    noFeed: "Aucun flux.",
    metaArticle: "Billet",
    metaMessage: "Message",
    metaRssFeed: "Flux RSS",
    feedClaimedBy: "réclamé par {who}",
    feedOrphan: "orphelin",
  },
  composer: {
    ariaLabel: "Commencez à rédiger",
    lead: "Commencez à rédiger",
    bodyLabel: "Votre message (Markdown accepté)",
    placeholder:
      "Une idée, une citation, un lien à partager. Quelques lignes suffisent.",
    writing: "Écriture en cours…",
    draftSaved: "Brouillon enregistré",
    // Vignette de lien (aperçu Open Graph)
    noVignette: "Aucune vignette.",
    chooseLink: "Choisir un lien",
    showPreview: "Afficher l’aperçu",
    nLinks: "{n} liens",
    chooseVignetteHint: "cliquez pour choisir la vignette à mettre en avant",
    chooseVignetteAria: "Choisir la vignette",
    removeVignette: "Retirer la vignette",
    noneOption: "Aucune",
    loadingPreview: "Récupération de l’aperçu…",
    attachMedia: "Ajouter un média",
    attachMediaHint: "(image, PDF, MP4/WebM, MP3 — 5 Mo max)",
    removeMedia: "Retirer le média",
    altLabel: "Texte alternatif",
    altHint: "(obligatoire — décrit l’image)",
    altPlaceholder:
      "Décris l’image pour les personnes qui ne la voient pas",
    publish: "Publier",
    publishing: "Publication…",
  },
  editor: {
    saveDraft: "Enregistrer le brouillon",
    publish: "Publier",
    pending: "Patiente…",
    replyingTo: "En réponse à",
    replyingToLink: "un contenu publié",
    replyingToSuffix:
      ". Votre billet apparaîtra dans le fil et sera rattaché à ce contenu.",
    title: "Titre",
    summary: "Résumé / chapô",
    optional: "(optionnel)",
    summaryHelp:
      "Sert d’aperçu et de résumé fédéré. À défaut, dérivé du début du texte.",
    editMode: "Mode d’édition",
    write: "Écrire",
    preview: "Aperçu",
    contentPlaceholder: "Écris ton texte en Markdown…",
    attachment: "Pièce jointe",
    attachmentHint: "(optionnel — image, PDF, MP4/WebM, MP3, 5 Mo max)",
    altLabel: "Texte alternatif",
    altHint: "(obligatoire — décrit l’image)",
    altPlaceholder:
      "Décris l’image pour les personnes qui ne la voient pas",
    titlePlaceholder: "Titre du billet",
    chapoPlaceholder:
      "Chapô (optionnel) — une phrase qui annonce la question posée",
    bodyPlaceholder:
      "Commencez à écrire votre billet. Markdown supporté : **gras**, *italique*, ## titre, > citation, [lien](url).",
    // Sélecteur de format (advisory — l’article fédère toujours comme Article).
    formats: {
      note: {
        name: "Note brève",
        cap: "≤ 280 mots",
        blurb:
          "Diffusion restreinte (abonnés seulement), pas de réponses-billets, format max 280 mots.",
      },
      billet: {
        name: "Billet",
        cap: "format libre",
        blurb:
          "Format standard. Diffusion dans le fil et la découverte, toutes interactions disponibles.",
      },
      analyse: {
        name: "Analyse",
        cap: "≥ 800 mots",
        blurb:
          "Éligible à l’éditorialisation. Sourcing attendu, badge dédié, format minimal 800 mots.",
      },
    },
    formatSelectorLabel: "Choisir un format",
    // Panneau « miroir ».
    mirror: {
      title: "Éditeur miroir",
      sub: "Un reflet qualitatif de ce que vous écrivez, sans note ni pourcentage.",
      words: "Mots",
      reading: "Lecture",
      readingUnit: "min",
      sources: "Sources",
      paragraphs: "Passages annotables",
      suggestionLabel: "Suggestion",
      signals: {
        sources: {
          name: "Sources citées",
          on: { one: "{n} référence attachée au texte", other: "{n} références attachées au texte" },
          off: "Aucune source rattachée pour l’instant",
        },
        margeRef: {
          name: "Référence à un autre auteur de Marge",
          on: "Vous dialoguez avec une publication existante",
          off: "Aucun lien vers un autre texte de Marge",
        },
        structure: {
          name: "Structure de lecture",
          on: "Le texte est divisé en sections (titres intermédiaires)",
          off: "Aucun titre intermédiaire — texte d’un seul tenant",
        },
        argument: {
          name: "Engagement argumentatif",
          on: "Articulations contradictoires détectées (mais, cependant, en revanche…)",
          off: "Pas d’articulation contradictoire repérée",
        },
        quote: {
          name: "Citation directe",
          on: "Un passage en bloc de citation est présent",
          off: "Aucun passage en bloc-citation",
        },
      },
      suggestions: {
        enjeu:
          "Commencez par poser l’enjeu. Un billet trouve son lectorat quand il annonce clairement la question qu’il pose dans ses dix premières lignes.",
        noSources:
          "Aucune source rattachée. Une référence externe — même légère — alourdit votre texte dans les signaux coûteux du classement.",
        noMargeRef:
          "Aucune référence à un autre texte de Marge. Pensez-vous à dialoguer avec une publication existante ? Les citations croisées sont fortement pondérées.",
        noStructure:
          "Le texte dépasse 350 mots sans titre intermédiaire. Un découpage par H2 aide les lectures longues et améliore le taux de lecture complète.",
        noArgument:
          "Le texte n’articule pas de contradiction. Marquer un « mais » ou un « cependant » rend une thèse plus tenable.",
      },
      noteLabel: "Format Note brève",
      noteOverLimit:
        "Au-delà de 280 mots, ce texte ne pourra plus être publié en Note brève — envisagez de passer en Billet.",
      analyseLabel: "Format Analyse",
      analyseUnderLimit: "Le format Analyse attend au moins 800 mots ({n} restants).",
    },
    // Rail des sources.
    sourcesPanel: {
      title: "Sources",
      sub: "Dans l’ordre d’apparition dans le texte. Chaque source génère un appel de note numéroté.",
      addSource: "Ajouter une source",
      removeSource: "Retirer la source",
      untitled: "Sans titre",
      kinds: {
        url: "Lien",
        book: "Ouvrage",
        article: "Article",
        marge: "Marge",
      },
    },
    // Modale d’ajout de source.
    sourceModal: {
      title: "Ajouter une source",
      close: "Fermer",
      attachedPassage: "Passage rattaché",
      noPassage:
        "Aucun passage sélectionné — l’appel de note sera placé à la position du curseur.",
      tabs: {
        url: "Lien web",
        book: "Ouvrage",
        article: "Article",
        marge: "Texte sur Marge",
      },
      url: "URL",
      urlPlaceholder: "https://…",
      pageTitle: "Titre",
      pageTitlePlaceholder: "Titre de la page",
      authorOrMedia: "Auteur ou média",
      year: "Année",
      bookTitle: "Titre",
      author: "Auteur",
      isbn: "ISBN",
      isbnPlaceholder: "978-…",
      isbnHint:
        "Une recherche automatique récupèrera l’éditeur et la couverture.",
      articleTitle: "Titre de l’article",
      authors: "Auteur·rice·s",
      venue: "Revue",
      doi: "DOI",
      doiPlaceholder: "10.…",
      margeText: "Texte publié sur Marge",
      margePlaceholder:
        "Rechercher un texte ou coller un permalien marge.social/…",
      margeHint:
        "Citer un texte de Marge alimente l’indice citations croisées de son auteur — un signal coûteux et donc pondéré fortement.",
      cancel: "Annuler",
      add: "Ajouter la source",
    },
    // Image d’illustration (cover).
    cover: {
      addTitle: "Ajouter une image d’illustration",
      addSub:
        "Image de couverture affichée en tête du billet, dans le fil de découverte et lors des partages. Glissez un fichier ou cliquez pour parcourir.",
      replace: "Remplacer",
      remove: "Retirer",
      captionPlaceholder: "Légende — décrit l’image, son contexte",
      captionRequired:
        "La légende sert de texte alternatif (obligatoire pour une image).",
      creditPlaceholder: "Crédit — © photographe, source",
    },
    // Barre flottante de sélection.
    toolbar: {
      bold: "Gras",
      italic: "Italique",
      h2: "Titre 2",
      h3: "Titre 3",
      quote: "Citation",
      list: "Liste",
      link: "Lien",
      addSource: "Ajouter une source au passage sélectionné",
      linkPrompt: "URL du lien :",
    },
    // Barre de publication.
    publishBar: {
      transparency: "Voir comment ce texte sera classé dans le feed",
      words: { one: "{n} mot", other: "{n} mots" },
      reading: "~{n} min de lecture",
    },
    // Modale de transparence (illustrative — algorithme public et paramétrable).
    transparency: {
      title: "Comment ce texte sera classé dans le feed",
      intro:
        "L’algorithme de Marge est public et paramétrable. Voici les signaux qu’il combine, avec leur poids relatif. Ils sont décomposés volontairement : aucun score agrégé n’est calculé en coulisses.",
      signals: {
        replies: {
          n: "Réponses-billets reçues",
          d: "Une réponse-billet est un signal coûteux : elle demande un texte argumenté en retour.",
        },
        readRate: {
          n: "Taux de lecture complète",
          d: "Mesuré sur les lecteurs ayant atteint au moins 90% du texte.",
        },
        crossRefs: {
          n: "Citations croisées",
          d: "Quand votre texte cite — ou est cité par — un autre texte publié sur Marge.",
        },
        annotations: {
          n: "Annotations qualifiées",
          d: "Surlignages accompagnés d’une note. Pèse plus qu’un simple surlignage.",
        },
        sources: {
          n: "Sources citées",
          d: "Présence et diversité des références externes (URL, ouvrages, articles).",
        },
        loyalty: {
          n: "Fidélité d’audience",
          d: "Lecteurs revenant à plusieurs de vos textes au fil du temps.",
        },
        likes: {
          n: "Likes & vues",
          d: "Affichés publiquement, mais pondérés très faiblement dans le classement.",
        },
        immediacy: {
          n: "Réactivité immédiate",
          d: "Les pics d’engagement dans la première heure ne sont pas survalorisés.",
        },
      },
      whyLabel: "Pour ce brouillon :",
      whyHasSources: {
        one: "vous avez {n} source attachée{marge}. Le signal citations croisées jouera en faveur de la remontée.",
        other:
          "vous avez {n} sources attachées{marge}. Le signal citations croisées jouera en faveur de la remontée.",
      },
      whyMargeClause: " et une référence à un autre texte de Marge",
      whyNoSources:
        "aucune source n’est attachée pour le moment. Le signal sources citées sera neutre — un sourcing même léger améliore la remontée.",
      whyStructured:
        " Le texte est suffisamment structuré pour que le taux de lecture complète soit mesuré finement.",
      close: "Fermer",
    },
  },
  compose: {
    writeTitle: "Écrire un texte",
    writeIntro: "Markdown, prévisualisation, brouillon ou publication.",
    drafts: "Brouillons",
    modifiedOn: "modifié le {date}",
    editText: "Modifier le texte",
    editDraft: "Modifier le brouillon",
    viewPublicPage: "Voir la page publique",
    deleteText: "Supprimer ce texte",
  },
  notifications: {
    metaTitle: "Notifications — Marge",
    title: "Notifications",
    refresh: "Rafraîchir",
    markAllRead: "Tout marquer comme lu",
    empty:
      "Aucune notification pour le moment. Vous serez prévenu·e quand un compte se mettra à vous suivre.",
    unreadBadge: { one: "{n} non lue", other: "{n} non lues" },
    unreadDot: "Non lue",
    see: "voir",
    andOthers: { one: "et {n} autre", other: "et {n} autres" },
    verbs: {
      follow: { one: "vous suit", other: "vous suivent" },
      like: {
        one: "a aimé votre publication",
        other: "ont aimé votre publication",
      },
      comment: {
        one: "a commenté votre publication",
        other: "ont commenté votre publication",
      },
      reply: {
        one: "a répondu à votre publication",
        other: "ont répondu à votre publication",
      },
      announce: {
        one: "a partagé votre publication",
        other: "ont partagé votre publication",
      },
      mention: { one: "vous a mentionné", other: "vous ont mentionné" },
      other: { one: "a interagi avec vous", other: "ont interagi avec vous" },
    },
  },
  preferences: {
    metaTitle: "Préférences — Marge",
    title: "Préférences",
    accountSection: "Compte",
    displayName: "Nom affiché",
    federatedHandle: "Handle fédéré",
    email: "Email",
    editProfileBefore: "Nom, bio et avatar se modifient sur",
    editProfileLink: "votre profil",
    changePasswordSection: "Changer mon mot de passe",
    notificationsSection: "Notifications",
    notificationsIntro:
      "Pour chaque type d’interaction, choisissez quand être interrompu·e (temps réel), regroupé en récapitulatif (digest) ou rien (désactivé), et quelles origines compter. Le réseau parle normalement au Fediverse ; vous décidez de ce qui mérite de vous interrompre.",
    typeLabels: {
      reply: "Réponses-billets",
      comment: "Commentaires",
      announce: "Partages",
      like: "J’aime",
    },
    channel: "Canal",
    scope: "Portée",
    channelOptions: {
      realtime: "Temps réel",
      digest: "Digest",
      off: "Désactivé",
    },
    scopeOptions: {
      all: "Local + fédéré",
      local: "Local seulement",
      federated: "Fédéré seulement",
    },
    savePreferences: "Enregistrer les préférences",
    followedAccounts: "Comptes suivis",
    noFollowsBefore: "Vous ne suivez aucun compte. Trouvez-en via la",
    noFollowsLink: "recherche",
    unfollow: "ne plus suivre",
    followPending: "(en attente)",
    blockedAccounts: "Comptes bloqués",
    unblock: "débloquer",
    exportSection: "Exporter mes données",
    exportIntro:
      "Vos données vous appartiennent et restent portables (standards ouverts).",
    exportMarkdown: "Mes textes (Markdown)",
    exportOpml: "Mes abonnements (OPML)",
    deleteSection: "Supprimer mon compte",
    deleteWarnBefore:
      "Action définitive : vos textes, abonnements et relations sont supprimés, et un",
    deleteWarnAfter:
      "fédéré est envoyé aux instances qui vous suivent. Les flux que vous possédez redeviennent orphelins.",
    deleteConfirm: "Je comprends que cette action est irréversible.",
    deleteButton: "Supprimer définitivement mon compte",
  },
  forms: {
    profileDisplayName: "Nom affiché",
    profileBio: "Bio",
    profileAvatar: "Avatar",
    profileAvatarHint: "PNG, JPEG, WebP ou GIF, 5 Mo maximum.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    feedPlaceholder: "https://un-blog.example/ ou .../feed.xml",
    feedAriaLabel: "URL d’un blog ou d’un flux RSS",
    feedReference: "Référencer",
    feedReading: "Lecture…",
    feedHelp:
      "Colle l’adresse d’un blog (le flux est auto-découvert) ou directement celle d’un flux RSS/Atom. Le flux devient suivable par tout le monde.",
    passwordCurrent: "Mot de passe actuel",
    passwordNew: "Nouveau mot de passe",
    passwordConfirm: "Confirmer le nouveau mot de passe",
    passwordHelp: "Au moins 8 caractères.",
    passwordSubmit: "Changer mon mot de passe",
    passwordChanging: "Modification…",
  },
  home: {
    landingTitle: "Un média social pour le débat démocratique.",
    landingP1:
      "Marge est un média social à contre-courant de l’économie attentionnelle : on y publie des textes long, on agrège des flux qu’on a choisis, et tout est nativement fédéré et interopérable (ActivityPub).",
    landingP2:
      "En ce moment, on pose les fondations. Vous pouvez vous inscrire, mais c’est encore peu utilisable.",
    feedTitle: "Fil",
    feedSubtitle: "comptes et flux suivis, mêlés en ordre chronologique.",
    emptyBefore: "Ton fil est vide. Écris un premier message ci-dessus, ou utilise la",
    emptyLink: "recherche",
    emptyAfter: "pour suivre des comptes et des flux.",
    loadMore: "Charger plus",
  },
  article: {
    draftNotice: "Brouillon — visible par toi seul·e.",
    readingTime: "{n} min de lecture",
    edit: "Modifier",
  },
  admin: {
    metaTitle: "Administration — Marge",
    title: "Administration",
    intro:
      "Supervision de l’instance (comptes et billets en lecture seule) et édition des pages de contenu. Aucune action de modération ici.",
    navLabel: "Navigation administration",
    accounts: "Comptes",
    posts: "Billets",
    pages: "Pages",
    accountsMetaTitle: "Comptes — Administration",
    accountsCount: { one: "{n} compte local.", other: "{n} comptes locaux." },
    colAccount: "Compte",
    colSignup: "Inscription",
    colPosts: "Billets",
    colFollowers: "Abonnés",
    colFollowing: "Abonnements",
    colStatus: "Statut",
    statusActive: "Actif",
    postsMetaTitle: "Billets — Administration",
    postsCount: {
      one: "{n} billet public.",
      other: "{n} billets publics.",
    },
    postsEmpty: "Aucun billet public publié sur l’instance pour le moment.",
    by: "par",
    pagesMetaTitle: "Pages — Administration",
    pagesTitle: "Pages de contenu",
    pagesIntro: "Pages publiques éditables en Markdown, accessibles à leur URL",
    newPage: "Nouvelle page",
    defaultContent: "contenu par défaut",
    updatedShort: "màj {date}",
    see: "voir",
    newPageMetaTitle: "Nouvelle page — Administration",
    allPages: "← Toutes les pages",
    editPageMetaTitle: "Éditer une page — Administration",
    editPageTitle: "Éditer : {title}",
    defaultPageNotice:
      "Contenu par défaut : il sera enregistré tel quel à la première sauvegarde.",
    deletePage: "Supprimer cette page",
  },
  feedDetail: {
    statusOrphan: "orphelin (sans propriétaire)",
    statusClaimed: "réclamé",
    statusOptOut: "retiré",
    statusPrefix: "Statut :",
    ownedBy: "propriété de",
    loginToFollowSuffix: "pour suivre ce flux.",
    ownerTitle: "Vous êtes propriétaire de ce flux",
    disableFullText: "Désactiver le texte intégral",
    enableFullText: "Activer le texte intégral",
    fullTextLabel: "Texte intégral réhébergé :",
    fullTextOn: "activé",
    fullTextOff: "désactivé (extrait + lien)",
    yourBlogBefore: "C’est votre blog ?",
    yourBlogLink: "Connectez-vous",
    yourBlogAfter:
      "pour réclamer ce flux ou en demander le retrait (opt-out).",
    latestItems: "Derniers items",
    noItems: "Aucun item récupéré.",
    readOnSource: "Lire sur la source →",
  },
  claim: {
    optOutTitle: "Confirmer le retrait de ce flux",
    claimTitle: "Prouver que ce flux est le vôtre",
    tokenInstructions:
      "Insérez ce jeton dans votre flux (par ex. dans le titre ou la description d’un billet, ou une balise du flux), republiez, puis cliquez sur Vérifier. Marge récupère le flux et confirme votre contrôle.",
    verifyNow: "Vérifier maintenant",
    yourBlogTitle: "C’est votre blog ?",
    referencedBefore: "Ce flux est référencé",
    referencedOrphan: "sans propriétaire",
    referencedClaimed: "et déjà réclamé",
    referencedAfter:
      ". Vous pouvez prouver que vous le contrôlez pour le réclamer, ou en demander le retrait définitif (opt-out).",
    claimRequest: "Réclamer ce flux",
    optoutRequest: "Demander le retrait (opt-out)",
  },
  pageEditor: {
    create: "Créer la page",
    saved: "Page enregistrée.",
    slugLabel: "Slug (URL)",
    slugHint: "fixé à la création, non modifiable ensuite.",
    publicUrl: "URL publique :",
    write: "Rédiger",
    preview: "Aperçu",
    contentPlaceholder: "Rédige le contenu en Markdown…",
  },
  media: {
    pdfDocument: "Document PDF",
    playVideo: "Lire la vidéo",
    playVideoNamed: "Lire la vidéo : {alt}",
  },
  // Messages renvoyés par les server actions / la lib (clés stables, §i18n).
  // Marqueurs `{x}` résolus via errorParams/successParams au rendu.
  errors: {
    invalidData: "Données invalides.",
    // Auth
    handleReserved: "Ce handle est réservé. Choisis-en un autre.",
    emailExists: "Un compte existe déjà avec cet email.",
    handleTaken: "Ce handle est déjà pris.",
    invalidCredentials: "Email ou mot de passe incorrect.",
    // Validation (Zod)
    handleTooShort: "Le handle doit faire au moins 2 caractères.",
    handleTooLong: "Le handle ne peut dépasser 32 caractères.",
    handleChars:
      "Le handle ne peut contenir que des lettres minuscules, chiffres, tirets et underscores.",
    emailInvalid: "Adresse email invalide.",
    passwordTooShort8: "Le mot de passe doit faire au moins 8 caractères.",
    displayNameRequired: "Le nom affiché est requis.",
    passwordRequired: "Mot de passe requis.",
    // Posts / messages
    notFound: "Contenu introuvable.",
    messageEmpty: "Le message ne peut pas être vide.",
    messageTooLong: "Message trop long (max {n} caractères).",
    altRequired: "Le texte alternatif est obligatoire pour une image.",
    // Mot de passe
    allFieldsRequired: "Tous les champs sont requis.",
    passwordTooShortN: "Le nouveau mot de passe doit faire au moins {n} caractères.",
    confirmMismatch: "La confirmation ne correspond pas au nouveau mot de passe.",
    currentPasswordWrong: "Le mot de passe actuel est incorrect.",
    newMustDiffer: "Le nouveau mot de passe doit différer de l’actuel.",
    // Flux
    feedUrlRequired: "Indique l’URL d’un blog ou d’un flux.",
    feedUnreadable: "Impossible de lire cette adresse.",
    feedOptOutBlocked:
      "Ce flux a fait l’objet d’un retrait (opt-out) et ne peut pas être référencé.",
    feedRemovedByAuthor: "Ce flux a été retiré par son auteur.",
    noFeedFound: "Aucun flux RSS/Atom trouvé à cette adresse.",
    // Articles / billets
    titleRequired: "Le titre est requis.",
    contentEmpty: "Le contenu ne peut pas être vide.",
    articleNotFound: "Article introuvable.",
    // Suivi distant
    handleRequired: "Indique un handle (@compte@instance).",
    followFailed: "Échec du suivi.",
    remoteAccountNotFound: "Compte introuvable sur le Fediverse.",
    notAnAccount: "Ce handle ne correspond pas à un compte.",
    // Réclamation / opt-out
    feedUnknown: "Flux inconnu.",
    feedNotFound: "Flux introuvable.",
    feedHasOwner: "Ce flux a déjà un propriétaire.",
    requestNotFound: "Demande introuvable.",
    cannotFetchFeed: "Impossible de récupérer le flux pour vérifier le jeton.",
    tokenNotFound:
      "Jeton non trouvé dans le flux. Ajoute-le puis réessaie (le cache de ton blog peut tarder).",
    unknownAction: "Action inconnue.",
    // Pages CMS
    slugInvalid: "Slug invalide (lettres minuscules, chiffres, tirets).",
    slugMissing: "Slug manquant.",
    slugReserved: "Le slug « {slug} » est réservé par une autre page.",
    pageExists: "Une page « {slug} » existe déjà.",
    // Profil
    nameTooLong: "Nom trop long (max {n} caractères).",
    bioTooLong: "Bio trop longue (max {n} caractères).",
    avatarMustBeImage: "L’avatar doit être une image (JPEG, PNG, WebP, GIF).",
    // Médias (upload)
    fileEmpty: "Fichier vide.",
    fileTooBig: "Fichier trop lourd (max 5 Mo).",
    formatNotAllowed:
      "Format non autorisé (images, PDF, MP4/WebM, MP3 uniquement).",
    extensionMismatch:
      "L’extension du fichier ne correspond pas à son contenu réel.",
    imageCorrupt: "Image illisible ou corrompue.",
  },
  success: {
    passwordChanged:
      "Mot de passe modifié. Vos autres sessions ont été déconnectées.",
    followRequestSent: "Demande de suivi envoyée à {handle}.",
    profileUpdated: "Profil mis à jour.",
  },
};

export type Messages = typeof fr;
export default fr;
