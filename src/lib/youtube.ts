/**
 * Résolveur YouTube : convertit une URL ou un @handle de chaîne YouTube en URL
 * de flux Atom public (`/feeds/videos.xml`), et fournit l'embed d'une vidéo pour
 * la lecture dans le fil.
 *
 * marge n'a aucun accès privilégié à YouTube : on ne s'appuie que sur les deux
 * surfaces publiques et stables qu'il expose — le flux Atom par chaîne (anonyme,
 * pas d'authentification) et le lecteur intégrable. Le flux d'abonnements
 * personnel (`/feed/subscriptions`) est authentifié → hors de portée.
 *
 * ⚠️ Un flux YouTube n'est pas revendiquable (ce n'est pas le blog de
 * l'utilisateur) : la page du flux ne propose donc pas la réclamation/opt-out.
 */

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const FEED_BASE = "https://www.youtube.com/feeds/videos.xml";

function hostOf(input: string): string | null {
  try {
    return new URL(input).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Vrai si l'entrée pointe vers YouTube (URL) ou est un @handle YouTube nu. */
export function isYouTubeUrl(input: string): boolean {
  const host = hostOf(input);
  if (host) return YT_HOSTS.has(host);
  // @handle nu — sans second @ (sinon c'est un handle Fediverse user@instance).
  return /^@[\w.-]+$/.test(input.trim());
}

/** Vrai si l'URL est déjà un flux Atom YouTube (`/feeds/videos.xml`). */
export function isYouTubeFeedUrl(url: string): boolean {
  const host = hostOf(url);
  return !!host && YT_HOSTS.has(host) && /\/feeds\/videos\.xml/i.test(url);
}

function feedUrlForChannel(channelId: string): string {
  return `${FEED_BASE}?channel_id=${channelId}`;
}

/** Extrait un channel_id (UC…) du HTML d'une page de chaîne YouTube. */
function channelIdFromHtml(html: string): string | null {
  // 1. Lien d'auto-découverte Atom (le plus fiable) : porte déjà le channel_id.
  const alt = html.match(/\/feeds\/videos\.xml\?channel_id=(UC[\w-]+)/i);
  if (alt) return alt[1];
  // 2. URL canonique / og:url de la forme /channel/UC…
  const canon = html.match(/\/channel\/(UC[\w-]+)/);
  if (canon) return canon[1];
  // 3. JSON inline (ytInitialData) : "channelId":"UC…" ou "externalId":"UC…".
  const json = html.match(/"(?:channelId|externalId)":"(UC[\w-]+)"/);
  if (json) return json[1];
  return null;
}

/**
 * Résout l'URL de flux Atom d'une chaîne YouTube à partir d'une URL ou d'un
 * @handle. Renvoie `null` si l'entrée n'est pas YouTube ou n'est pas résolvable.
 *
 * Sans réseau pour `/channel/UC…`, `/playlist?list=…` et un flux déjà formé ;
 * une seule requête HTML pour `/@handle`, `/c/NAME`, `/user/NAME`, `/watch?v=…`
 * (pour en extraire le channel_id). Best-effort : ne lance jamais.
 */
export async function resolveYouTubeFeedUrl(
  input: string,
  opts: { userAgent?: string } = {},
): Promise<string | null> {
  const raw = input.trim();
  if (!isYouTubeUrl(raw)) return null;

  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(raw)
        ? raw
        : `https://www.youtube.com/${raw.replace(/^\//, "")}`,
    );
  } catch {
    return null;
  }

  // Déjà un flux Atom : on le renvoie tel quel.
  if (/\/feeds\/videos\.xml/i.test(url.pathname)) return url.href;

  // /channel/UC… : channel_id direct, aucun réseau.
  const chan = url.pathname.match(/\/channel\/(UC[\w-]+)/);
  if (chan) return feedUrlForChannel(chan[1]);

  // /playlist?list=… : flux de playlist.
  if (/\/playlist/i.test(url.pathname)) {
    const list = url.searchParams.get("list");
    if (list) return `${FEED_BASE}?playlist_id=${list}`;
  }

  // /@handle, /c/NAME, /user/NAME, /watch?v=… → lire le HTML, extraire l'id.
  try {
    const res = await fetch(url.href, {
      headers: {
        "User-Agent": opts.userAgent ?? "marge/0.1 (+https://marge.social)",
        Accept: "text/html,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    // Les pages de chaîne YouTube sont volumineuses (~2 Mo) et le channel_id
    // n'apparaît que loin dans le document (~600 Ko) : on cherche large, borné
    // par sécurité contre une réponse pathologique.
    const html = (await res.text()).slice(0, 4_000_000);
    const channelId = channelIdFromHtml(html);
    return channelId ? feedUrlForChannel(channelId) : null;
  } catch {
    return null;
  }
}

/**
 * Extrait l'identifiant (11 car.) d'une vidéo YouTube depuis une URL : `watch?v=`,
 * `youtu.be/<id>`, `/embed/<id>`, `/shorts/<id>`. `null` si ce n'en est pas une.
 */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (!YT_HOSTS.has(host)) return null;
  const v = u.searchParams.get("v");
  if (v && /^[\w-]{11}$/.test(v)) return v;
  const m = u.pathname.match(/\/(?:embed|shorts|v)\/([\w-]{11})/);
  return m ? m[1] : null;
}

/**
 * URL d'embed respectueuse de la vie privée (domaine `youtube-nocookie.com` :
 * pas de cookie tant que la vidéo n'est pas lancée).
 */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
