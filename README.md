# HRLeaf

A minimalist, browser-based rich text editor. Open any URL, write, press **Save**.

- Visit `/` to get a fresh note with a random name, or go to `/anything-you-want`
- Write with Markdown shortcuts, the `/` command menu, or the formatting toolbar
- Press **Save** or `Ctrl/⌘ + S`. The button lights up only when there's something to save
- Share the link to edit together, or a read-only link (`/your-note/view`)

## Writing

### Saving

- **Manual save.** Nothing is written until you click **Save** or press `Ctrl/⌘ + S`.
- A green dot next to the note name and a `●` in the tab title mean there are unsaved changes.
- Leaving with unsaved changes asks whether to save, discard, or stay.
- **Restore previous version.** The version before your last save is kept (exactly one). Restoring swaps it with the current one, so you can always switch back.
- **Conflict protection.** If someone else saved the note after you opened it, you choose to keep yours or load theirs. Nothing is overwritten silently.

### Formatting toolbar

Select text to get bold, italic, underline, strikethrough, inline code and links.

### Markdown shortcuts

Type the symbol, then a space:

| Type | Gets you |
| --- | --- |
| `#`, `##`, `###` | Headings |
| `-` | Bullet list |
| `1.` | Numbered list |
| `[]` or `[x]` | Checklist |
| `>` | Quote |
| `` `code` `` | Inline code |
| ` ``` ` + Space | Code block with line numbers |
| `---` | Divider |
| `$x^2$` | Inline equation (LaTeX) |
| `$$x^2$$` | Block equation (LaTeX) |
| `[text](url)` | Link |

### Command menu

Press `/` for headings, lists, tables, quotes, alignment, code blocks and equations. Type `/3x4` to insert a 3 × 4 table directly.

### More menu (`⋯`)

- **Restore previous version**
- **Download Markdown**: saves the note as a `.md` file
- **Export PDF**: opens the print dialog with a clean, light print layout
- **Focus mode**: the header hides while you type and returns when you move the mouse

The note name in the header opens your **recent notes** (stored in this browser only).

## Admin

The admin dashboard (its route is set in `middleware.ts`) is protected by a single admin account from `.env`. It has:

- Server-side search, filters (All, Locked, Empty), sorting and paging
- A text preview of every note, its size, and created/modified times
- Activity chart (notes edited or created per day, last 30 days) and the largest notes
- Per note: lock/unlock, rename, restore previous version, read-only view, delete
- Bulk select: lock, unlock or delete many notes at once
- **Delete empty**: removes every empty, unlocked note in one go

## Running locally

Requires Node 20+ and a MongoDB database (Atlas works).

```bash
npm install
cp .env.example .env   # then fill it in
npm run dev            # http://localhost:3000
```

`.env`:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Database name (default `hrleaf`) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | The admin login |
| `AUTH_SECRET` | 32+ random characters that sign the admin cookie |
| `NEXT_PUBLIC_SITE_URL` | Optional. Your public URL, used in `robots.txt` |

On first start the app creates its indexes and fills in preview/size fields for existing notes automatically.

## How it's built

- [Next.js 15](https://nextjs.org/) (App Router, server actions) and React 19
- [Lexical](https://lexical.dev/) editor
- [MongoDB](https://www.mongodb.com/) via the official driver
- [Tailwind CSS](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/) components
- [KaTeX](https://katex.org/) for equations, loaded only when a note contains one

Notes render to HTML on the server, so text appears before the editor's JavaScript loads. The read-only view ships no editor at all.

## Privacy

Notes are not private: anyone with the link can read and edit an unlocked note. Don't store secrets. See [/privacy](app/(main)/privacy/page.tsx).

## License

MIT. See [LICENSE](LICENSE).
