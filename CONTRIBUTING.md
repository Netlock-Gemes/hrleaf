# Contributing to HRLeaf

## Setup

```bash
npm install
cp .env.example .env   # fill in MongoDB and admin values
npm run dev
```

## Before opening a PR

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Project layout

```
app/
  (main)/            public pages: random-note redirect, /[slug] editor, /[slug]/view, /privacy
  ainzooalgown/      admin login + dashboard
  components/
    editor/          Lexical editor, plugins, nodes, transformers
    SiteHeader.tsx
components/ui/       shadcn/ui primitives
lib/
  session.ts         signed admin cookie (works in middleware and server code)
  static-render.tsx  server-side Lexical JSON -> HTML
  recent.ts          per-browser recent notes and preferences
server/
  document-actions.ts  the only public server actions (save, restore)
  admin-actions.ts     admin-only server actions (all call requireAdmin)
  document-service.ts  server-only database access
  mongo-config.ts      shared connection, indexes, backfill
middleware.ts        protects /ainzooalgown
```

## Rules of thumb

- Anything in a `"use server"` file is callable from the browser. Keep database helpers in `server-only` modules and expose only what's needed.
- Every admin server action must call `requireAdmin()`.
- Lists must never load note `content`; use the stored `preview`, `size` and `is_empty` fields.
- Keep the UI on the existing tokens in `app/globals.css`; leaf green is for state (save, focus, selection), not decoration.
