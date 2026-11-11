# Changelog

All notable changes to HRLeaf are documented here.

## [1.3.0] - 2026-11-12

A new sheet design, better tables and more blocks.

### Added

- New sheet design, "Green Columnar Pad": a ruled header with the note's name, who can see it and when it was saved; green-ruled ledger tables with alternate rows; square ruled callouts, checklists and code. Dark-first, in HRLeaf's own green and charcoal; light and print match (see DESIGN.md)
- Wide tables keep readable columns and scroll sideways inside the page, with a fade on the edge that has more; long text wraps within its column. Works in the editor, read-only pages and share links
- `/` menu grouped into sections, with Heading 4, Callout (Note, Tip, Warning, Important), Toggle (collapsible section), Link to note, Today's date, Current time, code blocks in a chosen language, Indent, Outdent and Clear formatting
- `[[` links another note by name
- Markdown export writes callouts as `> [!NOTE]` alerts and toggles as `<details>`

### Fixed

- After picking from the `/` menu, an invisible box stayed where the command was typed and blocked clicks there
- The table cell menu now follows its cell when a table scrolls sideways, and the "add row" button sits below the scrollbar

## [1.2.0] - 2026-11-11

Polish, speed of use, and a safety net for the code.

### Added

- Light theme ("day paper") alongside dark, with System / Light / Dark in the account menu; no flash on load
- Command palette (`Ctrl/⌘ + K`): search notes, jump to headings, and run note and app commands
- Contents list beside long notes on wide screens, following your scroll
- Installable app with offline reading of recently opened notes, an offline page, and an "Offline" indicator in the editor
- Confirmation before saving a note that has been emptied
- Home page grouped by Today, Yesterday, This week, This month…
- Search button in headers, skip-to-content link, reduced-motion support for loading skeletons
- Unit tests (Vitest), end-to-end tests (Playwright) with a guard against running on real data, and GitHub Actions CI
- Structured `[hrleaf:error]` server error logs

### Fixed

- The primary button was white-on-white in light surfaces
- Colours are now theme tokens throughout (danger, warning, hairlines, shadows, overlays)

## [1.1.0] - 2026-11-11

Private by default: accounts, sharing, and safety nets.

### Added

- Member accounts created by the admin (generated password shown once), with reset password, rename, disable, sign out everywhere and delete
- `/login` for everyone, and a home page listing the notes you can open, with search
- Note visibility: **Team** (admin and members) or **Only me** (admin only)
- Public share links at `/s/<code>`, read-only or editable, which the admin can replace or turn off; bulk link creation
- Trash: deleted notes can be restored for 30 days, then they're removed automatically
- Activity log of sign-ins, sharing, visibility, trash and user changes, kept 90 days
- Download backup (all notes as JSON) and a storage meter for the Atlas free tier
- Unsaved changes kept in the browser and offered back after a crash or closed tab
- "Last edited by" on notes
- Branded 404, error and loading pages
- Security headers (CSP, frame blocking, referrer policy, HSTS) and a rate limit on saves through share links

### Changed

- Notes now need a signed-in account; signed-out visitors are sent to sign in. Existing notes became Team notes
- The admin area is a plain 404 for anyone but the admin, and is split into Notes, Users and Activity tabs
- Link previews for notes show only the brand image; share links show the note's name, never its text
- Session cookie renamed to `hrleaf_session` (everyone signs in again once)

### Removed

- `/ainzooalgown/login` (use `/login`)
- Per-note preview images on note addresses, which revealed whether a note existed

## [1.0.0] - 2026-11-10

First HRLeaf release.

### Added

- Manual saving with a Save button that's enabled only when there are changes, plus `Ctrl/⌘ + S`
- Unsaved-change markers (note name dot, tab title) and a save / discard / stay prompt on leaving
- Restore previous version (one version kept; restoring is reversible)
- Conflict detection when a note was saved elsewhere since it was opened
- Floating formatting toolbar on text selection, including links
- Share menu with read-only links and a server-rendered `/note/view` page
- Download as Markdown and Export PDF (print layout)
- Focus mode and per-browser recent notes
- Admin dashboard: server-side search/filter/sort/paging, previews, activity chart, largest notes, rename, restore, bulk lock/unlock/delete, delete all empty notes
- Single admin account configured in `.env`

### Changed

- New "Quiet paper" interface
- Notes render on the server for instant first paint
- KaTeX is loaded only when a note contains an equation
- Faster database access: shared connection, indexes, and stored previews so lists never load note bodies

### Removed

- Google sign-in, better-auth and Prisma

### Fixed

- Locked notes could be overwritten through a public server function
- Strikethrough text wasn't styled
- Equations with non-Latin characters broke copy/export
- Empty notes were created just by opening a page
