import { fedifyWith } from "@fedify/next";
import { federation } from "@/federation/federation";

// Intègre Fedify devant l'app (Next 16 : convention `proxy`, ancien
// `middleware`). Le `matcher` ne route vers Fedify que les requêtes
// ActivityPub/WebFinger (en-tête Accept/Content-Type idoine) et NodeInfo ;
// les requêtes HTML normales passent à l'app (négociation de contenu).
// NB : l'option `runtime` est interdite dans proxy (Node.js par défaut).
export default fedifyWith(federation)();

export const config = {
  matcher: [
    {
      source: "/:path*",
      has: [
        {
          type: "header",
          key: "Accept",
          value: ".*application\\/((jrd|activity|ld)\\+json|xrd\\+xml).*",
        },
      ],
    },
    {
      source: "/:path*",
      has: [
        {
          type: "header",
          key: "content-type",
          value: ".*application\\/((jrd|activity|ld)\\+json|xrd\\+xml).*",
        },
      ],
    },
    { source: "/.well-known/webfinger" },
    { source: "/.well-known/nodeinfo" },
    { source: "/.well-known/x-nodeinfo2" },
  ],
};
