# 0007 — Nom de marque : « marge » toujours en minuscule

- **Statut** : Accepté
- **Date** : 2026-06-22
- **Décideurs** : Karl Pineau
- **ADR liés** : —

## Contexte et forces en présence

Le nom du projet jouait jusqu'ici sur deux casses : « Marge » (capitalisée,
comme un nom propre classique) dans la prose, les titres, les métadonnées et la
plupart des chaînes d'interface ; « marge » (minuscule) dans le mot-symbole
rendu par le composant `Wordmark`. Cette double écriture brouille l'identité de
marque et impose un arbitrage implicite à chaque nouvelle chaîne écrite.

Forces en présence :

- **Cohérence d'identité** — une marque ne devrait avoir qu'une seule
  orthographe canonique. Le mot-symbole est déjà figé en minuscule (`Wordmark`,
  garanti par `scripts/smoke-wordmark.tsx`).
- **Positionnement** — « marge » est un jeu de mots (la *marge*, les marges, à
  contre-courant). La minuscule renforce ce parti pris discret, anti-emphase,
  cohérent avec l'éthos anti-attentionnel du produit.
- **Friction de rédaction** — sans règle, chaque contributeur (humain ou agent)
  doit décider, et la casse dérive.

## Options envisagées

1. **« Marge » capitalisé partout** — convention classique du nom propre.
   Contredit le mot-symbole déjà en minuscule ; oblige à recapitaliser le
   `Wordmark` et son smoke test.
2. **Casse contextuelle** (Majuscule en prose, minuscule en logo) — statu quo.
   Ambigu, non outillable, dérive garantie.
3. **« marge » en minuscule, exclusivement** — une seule orthographe canonique,
   alignée sur le mot-symbole, y compris en début de phrase et dans les titres.

## Décision

**Option 3.** Le nom de la marque s'écrit **exclusivement « marge »**, en
minuscule, en toute position — y compris en début de phrase, dans les titres,
les métadonnées (`<title>`, `site_name`), les emails, le `User-Agent` et la
documentation. La forme capitalisée « Marge » n'est plus employée.

**Exceptions techniques** (ne pas confondre marque et code) :

- Les **identifiants de code** en *camelCase*/*PascalCase* qui contiennent le
  segment `Marge` (`hasMargeRef`, `packTypeMarge`, `sourceMarge`,
  `whyMargeClause`, `noMargeRef`…) restent inchangés : ce sont des symboles, pas
  la marque. Seules les **valeurs de chaînes** affichées sont normalisées.
- `scripts/smoke-wordmark.tsx` conserve volontairement la forme « Marge » dans
  ses **assertions négatives** : ce test garantit précisément que le
  mot-symbole ne rend *jamais* la forme capitalisée. Le lowercaser ici
  invaliderait le test.

## Conséquences

- Orthographe unique et outillable : tout « marge » isolé (mot entier) est en
  minuscule ; la règle se vérifie d'un `grep -nE "\bMarge\b"`.
- Normalisation rétroactive du parc existant : interface (fr/en), emails,
  métadonnées, `User-Agent`, documentation publiée (`mkdocs`), fixtures et
  exemples d'environnement passent en « marge ».
- La règle s'applique aux futurs ADR, à la documentation et à toute chaîne
  d'interface. Une chaîne montrant « Marge » est désormais un défaut.
- N'affecte pas la logique applicative ni le schéma : changement purement
  typographique sur du texte.
