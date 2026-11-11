# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Mainly the owner, for personal use: business documents, checklists and quick scratch notes. Two or three friends have member accounts. Notes are not shared with clients; share links exist but outside readers are not a design priority.

## Product Purpose

A private, link-based notes editor. Every note lives at its own address (`/name`). The team writes and edits there, and the owner decides which notes are team-wide, private or shared publicly. Success: writing and reading your own notes every day feels fast, calm and personal.

## Positioning

A personal private notebook with its own character, where every note has its own address. It is not a big workspace tool with databases, and it is not a public blogging platform.

## Operating Context

- Content mix: business documents (quotations, proposals, strategy and plans, often with large comparison tables and prices in ₹), checklists and task trackers, and quick scratch notes. Technical content (code, equations) is used but less often.
- Notes range from a single line to very long documents with dozens of wide tables (one note has 28).
- Used on laptops and phones. Dark mode is used most of the time; light mode must still work.
- Notes are sometimes printed or saved as PDF.
- Saving is manual (`Ctrl/⌘ + S`), with drafts kept locally until saved.

## Capabilities and Constraints

- Rich text editor (Lexical): headings, lists, checklists, quotes, callouts, toggles, tables, code, equations, dividers, links between notes.
- Read-only pages and share links render notes without the editor, so every block needs a static form.
- Accounts: one admin (configured in the environment) plus member accounts. The admin area is hidden.
- Hosted on Vercel; notes stored in MongoDB Atlas on a free tier, so storage use matters (version history was declined for this reason).
- Both light and dark themes must keep working. Notes must print well.

## Brand Commitments

- Name: HRLeaf. Forked from openleaf (MIT); the license stays unchanged.
- The owner prefers a creative look over a strictly formal document look.
- Colour is pinned to HRLeaf's own palette: leaf green (`#4cc47e`, stronger `#6fd69a`) on warm charcoal neutrals (room `#121110`, paper `#181715`) with warm off-white text. No new hues (a vermilion/red second ink was tried and rejected as looking foreign). Warning/danger tints stay functional only.
- Design dark-first: the dark theme is the primary experience.

## Evidence on Hand

- Real notes in the database are the content to design for; no testimonials, customers or metrics exist and none should be invented.

## Product Principles

1. Writing comes first: the page must stay calm and fast to type in.
2. It should feel like the owner's own book, not a generic app.
3. Dense material (big tables, long plans) must stay readable, never squeezed.
4. Private by default; nothing advertises what isn't shared.

## Accessibility & Inclusion

No specific standard was set. Keep readable contrast in both themes, keyboard use throughout, and respect reduced-motion settings.
