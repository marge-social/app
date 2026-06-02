/**
 * Hook de démarrage Next.js (exécuté une fois au boot du serveur, runtime
 * Node.js). On y crée les tables KV/queue de Fedify et on démarre le worker de
 * livraison sortante en process — pas de processus séparé au MVP.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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
