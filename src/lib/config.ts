/** Configuration d'instance dérivée de l'environnement. */

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

/** Domaine fédéré de l'instance (partie après le @ dans un handle). */
export const INSTANCE_DOMAIN =
  process.env.INSTANCE_DOMAIN ?? new URL(APP_URL).host;

/** Handle fédéré complet : @claire@instance.tld */
export function fediverseHandle(handle: string): string {
  return `@${handle}@${INSTANCE_DOMAIN}`;
}

/** URI de l'acteur ActivityPub d'un compte local. */
export function actorUri(handle: string): string {
  return `${APP_URL}/users/${handle}`;
}

/** Permalien (humain) d'un article. */
export function articleUrl(handle: string, slug: string): string {
  return `${APP_URL}/@${handle}/${slug}`;
}

/** URI ActivityPub (machine) de l'objet Article — déréférençable par Fedify. */
export function articleApUri(handle: string, slug: string): string {
  return `${APP_URL}/users/${handle}/articles/${slug}`;
}

/** Permalien (humain) d'un message court (Note). */
export function noteUrl(handle: string, id: string): string {
  return `${APP_URL}/@${handle}/notes/${id}`;
}

/** URL de l'avatar d'un compte local (servie depuis Postgres). */
export function avatarUrl(handle: string): string {
  return `${APP_URL}/api/avatar/${handle}`;
}
