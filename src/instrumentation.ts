/**
 * Hook de démarrage Next.js (exécuté une fois au boot du serveur, runtime
 * Node.js). On y crée les tables KV/queue de Fedify et on démarre le worker de
 * livraison sortante en process — pas de processus séparé au MVP.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Logs Fedify (diagnostic fédération) vers la console du conteneur. Doit être
  // configuré AVANT le premier usage de Fedify. `@logtape/logtape` est
  // externalisé (cf. next.config.ts) pour partager l'unique instance avec le
  // LogTape interne de Fedify — sinon la config n'aurait aucun effet.
  try {
    const { AsyncLocalStorage } = await import("node:async_hooks");
    const { configure, getConsoleSink } = await import("@logtape/logtape");
    await configure({
      // Stockage contextuel (corrige le warning « Context-local storage is not
      // configured » et active le suivi de contexte des logs Fedify).
      contextLocalStorage: new AsyncLocalStorage(),
      sinks: { console: getConsoleSink() },
      loggers: [
        // `info` : résumés inbox/outbox + warnings/erreurs, sans le bruit `debug`
        // (kv-cache, docloader). Passer à `debug` ponctuellement pour diagnostiquer.
        { category: "fedify", lowestLevel: "info", sinks: ["console"] },
        {
          category: ["logtape", "meta"],
          lowestLevel: "error",
          sinks: ["console"],
        },
      ],
    });
  } catch (err) {
    // configure() ne peut être appelé qu'une fois : on ignore si déjà fait.
    console.warn("[logtape] configuration ignorée :", (err as Error).message);
  }

  const { federation, ensureFederationStorage } = await import(
    "@/federation/federation"
  );
  await ensureFederationStorage();
  // Traite la file de livraison sortante (retries gérés par Fedify).
  // NE PAS attendre : startQueue tourne en boucle et ne se résout jamais.
  void federation.startQueue(undefined).catch((err) => {
    console.error("[federation] queue worker stopped:", err);
  });
}
