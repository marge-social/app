import { fedifyWith, integrateFederation } from "@fedify/next";
import { NextResponse } from "next/server";
import { federation } from "@/federation/federation";

// Intègre Fedify devant l'app (Next 16 : convention `proxy`, ancien
// `middleware`). Le `matcher` ne route vers Fedify que les requêtes
// ActivityPub/WebFinger (en-tête Accept/Content-Type idoine) et NodeInfo ;
// les requêtes HTML normales passent à l'app (négociation de contenu).
// NB : l'option `runtime` est interdite dans proxy (Node.js par défaut).

// `fedifyWith` ne délègue à Fedify que si l'en-tête Accept/Content-Type matche
// la regex ActivityPub, ou si le chemin est `/.well-known/nodeinfo`. Or :
//   - WebFinger fetché sans `Accept: application/jrd+json` (ex. navigateur),
//   - le document NodeInfo (`/nodeinfo/2.1`, fetché en `Accept: application/json`)
// échapperaient à ce filtre et tomberaient dans la route de page Next (404).
// On force donc Fedify pour ces chemins fédératifs, quel que soit l'Accept.
const handleFederation = integrateFederation(federation);

export default fedifyWith(federation)((request) => {
  const { pathname } = new URL(request.url);
  if (pathname === "/.well-known/webfinger" || pathname.startsWith("/nodeinfo/")) {
    return handleFederation(request);
  }
  return NextResponse.next();
});

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
    // Document NodeInfo lui-même (fetché en `Accept: application/json`, donc
    // non capté par la regex ActivityPub ci-dessus).
    { source: "/nodeinfo/2.1" },
  ],
};
