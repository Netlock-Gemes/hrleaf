# Design: the note sheet ("Green Columnar Pad")

Recorded from the built CSS (`app/globals.css`, the "Green Columnar Pad" block) and `app/components/NoteFields.tsx`. Dark mode is the primary experience; light mode and print follow the same rules. The app chrome (header, home, admin) keeps HRLeaf's existing look.

## Idea

Each note is a page from an accountant's green-ruled columnar pad, turned dark. Leaf green is the ruling ink; everything else is HRLeaf's warm charcoal and off-white. No other hues (warning and danger tints stay functional only).

## Colour

| Token | Dark | Light | Use |
|---|---|---|---|
| `--room` | `#121110` | `#f3f1ec` | behind the sheet |
| `--paper` | `#181715` | `#fbfaf7` | the sheet |
| `--text` | `rgb(236 232 225)` | `rgb(33 30 26)` | ink |
| `--leaf` | `#4cc47e` | `#4cc47e` | caret, selection, brand |
| `--pad-label` (`--leaf-strong`) | `#6fd69a` | `#17804a` | field labels, table headers, H4, list markers, ticks |
| `--pad-rule` | leaf 55% | `#17804a` 55% | double rules, table outer rules, quote and divider |
| `--pad-hair` | leaf 17% | `#17804a` 18% | cell rules, field dividers |
| `--pad-wash` | leaf 5% | `#17804a` 4.5% | alternate table rows, Tip callout, done box |

## Type

Geist for everything you read and write; Geist Mono for field values and code. Labels are 10.5–12px, semibold, uppercase, tracked 0.1–0.12em, in `--pad-label`. Tables use tabular numerals.

## Structure

- **Header fields:** a ruled strip across the top of the sheet: **Note** (name), **Access** (Team / Only me, public link, locked; "Shared link" on share pages), **Updated** (last saved date, updates on save). Closed by a 4px double green rule. On phones, Access is hidden.
- **Corners:** square (3–4px at most).

## Blocks

- **Tables (ledger):** 1px green rules above and below; header row in green caps over a 4px double rule; green hairline row and column rules; alternate rows washed green; text left-aligned; wide tables scroll sideways.
- **Callouts:** ruled boxes. Note: neutral hairline. Tip: green rule and wash. Warning / Important: their functional tone at 45%.
- **Checklists:** square ruled boxes; done shows a green tick on a faint green wash, text struck in neutral.
- **Lists:** green markers, tabular numerals.
- **Quote:** 1px green rule. **Divider:** double green rule.
- **H4:** a pad label (small green caps).

## Don'ts

- No new hues inside the sheet; no vermilion or red accents.
- No rounded cards or soft shadows inside the sheet.
- Don't put green on running text; it's for rules, labels and state.
