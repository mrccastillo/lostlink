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
