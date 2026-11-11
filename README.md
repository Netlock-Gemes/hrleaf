# HRLeaf

A private, invitation-only notebook. Notes are only open to signed-in accounts that the admin creates. Any single note can also be shared through a public link that is read-only or editable. Every page asks search engines not to index it.

- Sign in at `/login`. Home (`/`) lists every note you can open, with search
- Press **New note** (or `N`) and pick a name, or go straight to `/anything-you-want`
- Write with Markdown shortcuts, the `/` command menu, or the formatting toolbar
- Press **Save** or `Ctrl/⌘ + S`. The button lights up only when there's something to save
- Press `Ctrl/⌘ + K` anywhere to search notes, jump to a heading, or run a command

## Who can open what

| Person | Signs in with | Can open |
| --- | --- | --- |
| **Admin** | `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env` | Every note, plus the admin area |
| **Member** | An account the admin creates | Every **Team** note (read and edit). Never notes marked **Only me**, never the admin area |
| **Anyone with a share link** | Nothing | Only that one note at `/s/<code>`, read-only or editable as the admin set it |

- New notes are **Team** notes. The admin can switch any note to **Only me**.
- Share links use a random 12-character code, not the note's name, so they can't be guessed. The admin can switch a link between read-only and editable, replace it (the old link stops working), or turn it off.
- Signed-out visitors get the sign-in page for every note address, whether or not the note exists. Link previews for notes show only the HRLeaf brand image. Previews for share links show the note's name, never its text.
- Disabling a member, resetting their password, or "Sign out everywhere" ends their sessions immediately.

## Writing

### Saving

- **Manual save.** Nothing is written until you click **Save** or press `Ctrl/⌘ + S`.
- A green dot next to the note name and a `●` in the tab title mean there are unsaved changes.
- Leaving with unsaved changes asks whether to save, discard, or stay.
- **Restore previous version.** The version before your last save is kept (exactly one). Restoring swaps it with the current one, so you can always switch back.
- **Conflict protection.** If someone else saved the note after you opened it, you choose to keep yours or load theirs. Nothing is overwritten silently.
- **Unsaved changes survive crashes.** Unsaved edits are kept in this browser. If the tab closes or the device restarts, reopening the note offers them back. Signing out clears them.

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

Press `/` for blocks, grouped into Basic, Lists, Insert, Code, Math and Format. Start typing to filter.

- **Headings 1–4**, quote, divider, bulleted, numbered and check lists
- **Callout**: a tinted box for notes. Click its icon to switch between Note, Tip, Warning and Important (or type `/tip`, `/warning`)
- **Toggle**: a collapsible section. Click the arrow or press `Ctrl/⌘ + Enter` in its title to open or close it
- **Table**: type `/3x4` to insert a 3 × 4 table directly. Wide tables scroll sideways instead of squeezing their columns
- **Link to note**: or type `[[` anywhere, then pick a note
- **Code block**, or a language directly (`/python`, `/sql`, `/js`…)
- **Today's date**, **Current time**, equations, indent / outdent, clear formatting, alignment

Inside a callout or toggle, press Enter on an empty last line to step out below it.

### Block panel

On wide screens (1200px and up) a small panel beside the sheet holds the same blocks in four groups: Text, Lists, Blocks and Insert. The block your cursor is in is highlighted; click a highlighted style again to turn it back into a paragraph. The line at the bottom names the option you're pointing at and its shortcut. On phones and narrow windows, use `/`.

### Command palette (`Ctrl/⌘ + K`)

Search every note you can open (best match first, with **Create** as the fallback), jump to a heading in the open note, or run commands: new note, save, download Markdown, export PDF, focus mode, copy link, share settings (admin), switch theme, sign out. It also opens from the search button in the header or the account menu.

### Contents

Notes with two or more headings get a contents list beside the page on wide screens, highlighting the section you're reading. On any screen size, the headings are also in the command palette.

### More menu (`⋯`)

- **Restore previous version**
- **Download Markdown**: saves the note as a `.md` file
- **Export PDF**: opens the print dialog with a clean, light print layout
- **Focus mode**: the header hides while you type and returns when you move the mouse

The note name in the header opens your **recent notes** (stored in this browser only).

### Light and dark

Choose **System**, **Light** or **Dark** in the account menu or the command palette. The choice is remembered per browser and applied before the page draws, so there's no flash.

### Install and offline

HRLeaf can be installed as an app from the browser ("Install" or "Add to Home Screen"). Notes you've opened on a device can be read offline (up to 40 most recent). Saving needs a connection; the editor shows **Offline**, and unsaved changes are kept on the device until you're back. Signing out removes the offline copies.

### Safety net for empty saves

If you clear all the text in a note and save, HRLeaf asks first. Saving an empty note keeps the old text as the previous version, so you can still restore it.

## Admin

The admin area is reachable only by the admin account; everyone else gets a plain 404. It has three tabs.

**Notes**
- Server-side search, filters (All, Shared, Only me, Locked, Empty, Trash), sorting and paging
- A text preview of every note, who edited it last, its size, and created/modified times
- Per note: share settings (Team / Only me, public link read or edit), lock/unlock, rename, restore previous version, move to trash
- Bulk select: lock, unlock, create or turn off share links, change visibility, move to trash
- **Trash**: deleted notes can be restored for 30 days, then MongoDB removes them automatically
- **Delete empty**: removes every empty note that isn't locked or shared
- Activity chart, largest notes, a **storage meter** for the Atlas free tier (512 MB), and **Download backup** (every note as one JSON file, built on request)

**Users**: add a member (a strong password is generated and shown once, ready to copy), reset password, rename, disable or enable, sign out everywhere, delete. Their notes stay.

**Activity**: sign-ins (including failed ones), sharing, visibility, trash and user changes, filterable by person. Entries delete themselves after 90 days.

## Brand

- **Mark:** one solid leaf with one cut. The cut is both the leaf's midrib and the `/` of a note's address (`hrleaf/your-note`). Files: `public/logo/hrleaf-mark*.svg` (green, dark, white) and `hrleaf-mark-1024.png`; React component in `app/components/Logo.tsx`.
- **Wordmark:** "HR" regular + "Leaf" semibold, Geist.
- **Colours:** leaf `#4cc47e` on warm near-black `#121110`, ink `#ece8e1`.
- **Link previews:** every route has its own Open Graph image, generated on the server (`opengraph-image.tsx` files, shared layout in `lib/og.tsx`). Note previews show the note's name, last update and word count, never its text.

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
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | The admin login. Members are created in the admin area, not here |
| `AUTH_SECRET` | 32+ random characters that sign session cookies. Changing it signs everyone out |
| `NEXT_PUBLIC_SITE_URL` | Optional. Your public URL, used in `robots.txt` |

On first start the app creates its indexes (including the trash and activity-log expiry) and fills in preview/size fields for existing notes automatically. Notes from before accounts existed become **Team** notes.

## Security

- Passwords are hashed with scrypt; sessions are HMAC-signed, `httpOnly` cookies (admin 7 days, members 30 days).
- Sign-in is rate limited (5 failures per IP per 15 minutes, 50 overall). Saves through editable share links are limited to 120 per IP per 10 minutes.
- Security headers on every response: Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy (`no-referrer` on share links), Permissions-Policy and HSTS.

## Tests

```bash
npm test            # unit tests (Vitest): slugs, content, sessions, passwords, redirects
npm run build
npm run test:e2e    # browser tests (Playwright): roles, sharing, drafts, trash, palette, themes, tables, callouts, toggles
```

The end-to-end tests create notes and users named `zz-e2e-…` and delete them afterwards. They refuse to run unless `MONGODB_DB` ends in `_dev`, `_ci` or `_test`, so they can't touch real notes. Set `PLAYWRIGHT_CHROMIUM_PATH` to use an installed Chromium.

**CI** (`.github/workflows/ci.yml`) runs on every push to `develop` and `main` and on pull requests: lint, type check, unit tests and build, then the browser tests against a throwaway MongoDB inside the runner.

**Errors in production** are logged on one line starting with `[hrleaf:error]` (route, path, message, digest; never cookies or note text). Find them in Vercel → Logs.

## How it's built

- [Next.js 15](https://nextjs.org/) (App Router, server actions) and React 19
- [Lexical](https://lexical.dev/) editor
- [MongoDB](https://www.mongodb.com/) via the official driver
- [Tailwind CSS](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/) components
- [KaTeX](https://katex.org/) for equations, loaded only when a note contains one

Notes render to HTML on the server, so text appears before the editor's JavaScript loads. The read-only view ships no editor at all.

## Privacy

Notes need a signed-in account, except notes the admin has shared with a public link. Anyone who has that link can open the note, so keep secrets out of shared notes. See [/privacy](app/(main)/privacy/page.tsx).

## License

MIT. See [LICENSE](LICENSE).
