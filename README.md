This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Documentation

La documentation du projet (cahier des charges, journal de décisions ADR,
roadmap) est construite avec **MkDocs Material** et publiée sur **GitHub Pages**
à chaque `push` sur `main` via `.github/workflows/deploy-docs.yml`. La source
vit dans `docs/` ; toute modification passe par une *pull request* relue.

### Aperçu local

```bash
pip install -r requirements-docs.txt
mkdocs serve   # http://127.0.0.1:8000
```

### Mise en route (une fois)

1. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub
   Actions**.
2. `git push` sur `main` → l'Action construit et publie la doc.
3. Créer le **GitHub Project** (roadmap) et coller son URL dans
   `docs/roadmap.md`.

Conventions de tenue de la doc (rituel ADR, gouvernance) : voir la section
« Conventions de documentation » de [`CLAUDE.md`](CLAUDE.md).

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
