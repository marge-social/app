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

/** Permalien d'un article. */
export function articleUrl(handle: string, slug: string): string {
  return `${APP_URL}/@${handle}/${slug}`;
}
