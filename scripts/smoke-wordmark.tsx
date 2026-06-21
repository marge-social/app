// Test de rendu minimal du mot-symbole <Wordmark> (convention smoke du repo) :
//   npx tsx scripts/smoke-wordmark.tsx
// Vérifie : présence du mot + du point, aria-label quand href, plancher 14px.
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Wordmark } from "../src/components/brand/Wordmark";

function check(name: string, fn: () => void) {
  fn();
  console.log(`  ✓ ${name}`);
}

console.log("smoke-wordmark");

// 1. Sans href : simple <span>, mot + point, pas de nom accessible de lien.
const plain = renderToStaticMarkup(<Wordmark />);
check("rend le mot « marge »", () => assert.match(plain, /marge/));
check("rend le point décoratif", () => {
  assert.match(plain, /wordmark__dot/);
  assert.match(plain, /aria-hidden="true"[^>]*>\.<\/span>|>\.<\/span>/);
});
check("sans href → <span>, pas d'aria-label", () => {
  assert.match(plain, /^<span/);
  assert.doesNotMatch(plain, /aria-label/);
});
check("casse minuscule (pas de « Marge »)", () =>
  assert.doesNotMatch(plain, /Marge/),
);

// 2. Avec href : lien <a> nommé « …retour à l'accueil ».
const linked = renderToStaticMarkup(<Wordmark href="/" />);
check("avec href → <a href> + aria-label", () => {
  assert.match(linked, /<a /);
  assert.match(linked, /href="\/"/);
  // (l'apostrophe est échappée en HTML par React → &#x27;)
  assert.match(linked, /aria-label="marge, retour à l(&#x27;|')accueil"/);
});
check("homeLabel surchargeable", () => {
  const custom = renderToStaticMarkup(
    <Wordmark href="/" homeLabel="marge, back to home" />,
  );
  assert.match(custom, /aria-label="marge, back to home"/);
});

// 3. Plancher de lisibilité : jamais sous 14px même si on demande moins.
check("taille < 14 plafonnée à 14px", () => {
  const tiny = renderToStaticMarkup(<Wordmark size={10} />);
  assert.match(tiny, /font-size:14px/);
});
check("taille demandée respectée au-dessus du plancher", () => {
  const big = renderToStaticMarkup(<Wordmark size={22} />);
  assert.match(big, /font-size:22px/);
});

console.log("OK — smoke-wordmark");
