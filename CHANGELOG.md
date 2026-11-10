# Changelog

All notable changes to HRLeaf are documented here.

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
