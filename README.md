# lostlink

Next.js App Router application with TypeScript, Tailwind CSS, and ESLint.

## Development

Requires Node.js 20.9 or newer and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Edit `src/app/page.tsx` to update the home page.
Global styles and Tailwind are configured in `src/app/globals.css`.
Use `@/*` imports for files inside `src/`.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
```

Run `npm start` after building to serve the production app.

## Design previews

Two responsive HTML concepts live in `public/designs/`:

- [Modern minimalist](public/designs/modern.html): ivory and forest green, editorial typography, and restrained motion.
- [Neobrutalist](public/designs/neobrutalist.html): acid yellow, oversized type, heavy rules, and offset shadows.

Open either HTML file directly in a browser, keeping `interactions.js` and the `assets/` folder alongside it. With `npm run dev`, visit `/designs/modern.html` or `/designs/neobrutalist.html`. Each page links to the other option.

Both include searchable sample reports, lost/found filters, item details, a report preview dialog, keyboard navigation, and reduced-motion support. These are static design prototypes: no authentication, uploads, persistence, or backend submissions are connected. The main Next.js route remains the starter page.

Photos are stored locally from Unsplash: [backpack](https://images.unsplash.com/photo-1553062407-98eeb64c6a62), [headphones](https://images.unsplash.com/photo-1546435770-a3e426bf472b), and [camera](https://images.unsplash.com/photo-1516035069371-29a1b244cc32). Google Fonts supplies DM Sans and Space Grotesk; system fonts provide an offline fallback.
