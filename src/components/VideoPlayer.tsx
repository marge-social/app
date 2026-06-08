"use client";

import { useRef, useState } from "react";

/**
 * Lecteur vidéo pour le fil. Lit directement dans Marge :
 * - un fichier mp4/webm via `<video>` natif ;
 * - une playlist HLS (PeerTube HLS-only) via hls.js, importé **à la demande**
 *   (au clic sur « Lire ») pour ne pas alourdir le fil ; lecture native sur
 *   Safari (qui gère HLS sans bibliothèque).
 *
 * Conforme à l'éthos anti-attention : **aucune lecture automatique**. Tant qu'on
 * a une vignette (`poster`), on n'affiche qu'elle + un bouton de lecture — la
 * vidéo (et hls.js) n'est chargée qu'au clic explicite de l'utilisateur.
 */
export function VideoPlayer({
  src,
  hlsUrl,
  poster,
  alt,
}: {
  /** Source directe mp4/webm, si disponible. */
  src?: string | null;
  /** Playlist HLS, si pas de source directe (ou en complément). */
  hlsUrl?: string | null;
  /** Vignette/affiche (vidéo distante). */
  poster?: string | null;
  /** Texte alternatif / titre, pour l'accessibilité. */
  alt?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);

  async function play() {
    setActive(true);
    const video = videoRef.current;
    if (!video) return;
    try {
      if (src) {
        video.src = src;
      } else if (hlsUrl) {
        // Safari lit HLS nativement ; ailleurs, hls.js.
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = hlsUrl;
        } else {
          const Hls = (await import("hls.js")).default;
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
          } else {
            setFailed(true);
            return;
          }
        }
      } else {
        setFailed(true);
        return;
      }
      await video.play().catch(() => {});
    } catch {
      setFailed(true);
    }
  }

  // Pas de vignette (vidéo locale ou Mastodon mp4) : lecteur classique inline.
  if (!poster) {
    return (
      <video
        src={src ?? undefined}
        controls
        playsInline
        className="max-h-96 w-full rounded-lg border border-black/10 dark:border-white/15"
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
      <video
        ref={videoRef}
        controls={active}
        poster={poster}
        playsInline
        preload="none"
        className="max-h-96 w-full bg-black"
      />
      {!active && (
        <button
          type="button"
          onClick={play}
          aria-label={alt ? `Lire la vidéo : ${alt}` : "Lire la vidéo"}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/35"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white">
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
      {failed && (
        <p className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center text-sm text-white">
          Lecture impossible ici.
        </p>
      )}
    </div>
  );
}
