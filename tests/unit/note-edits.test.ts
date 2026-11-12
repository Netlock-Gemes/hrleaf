import { describe, expect, it } from "vitest";

import { lexicalToMarkdown, markdownToLexical } from "@/lib/markdown-lexical";
import { Block, EditError, applyTextEdits, listHeadings, placeMarkdown, sectionMarkdown } from "@/lib/note-edits";

const NOTE = `# Plan

Intro line.

## Tasks

- [ ] send invoice
- [ ] call Ravi

### Later

- tidy up

## Notes

Ravi said **yes**.`;

const blocks = (md = NOTE) => markdownToLexical(md).root.children as Block[];
const md = (b: Block[]) => lexicalToMarkdown({ root: { children: b } });

describe("applyTextEdits", () => {
  it("replaces exact Markdown text", () => {
    const out = md(applyTextEdits(blocks(), [{ old_text: "- [ ] send invoice", new_text: "- [x] send invoice" }]));
    expect(out).toContain("- [x] send invoice");
    expect(out).toContain("- [ ] call Ravi");
  });

  it("keeps blocks it doesn't touch as the same objects", () => {
    const before = blocks();
    const after = applyTextEdits(before, [{ old_text: "Intro line.", new_text: "Better intro." }]);
    expect(after[0]).toBe(before[0]);
    expect(after.at(-1)).toBe(before.at(-1));
    expect(md(after)).toContain("Better intro.");
  });

  it("refuses ambiguous or missing text, unless replace_all", () => {
    expect(() => applyTextEdits(blocks(), [{ old_text: "Ravi", new_text: "R" }])).toThrow(/appears 2 times/);
    expect(() => applyTextEdits(blocks(), [{ old_text: "nope", new_text: "x" }])).toThrow(EditError);
    const out = md(applyTextEdits(blocks(), [{ old_text: "Ravi", new_text: "Asha", replace_all: true }]));
    expect(out).not.toContain("Ravi");
    expect(out.match(/Asha/g)).toHaveLength(2);
  });

  it("can span blocks and delete", () => {
    const out = md(applyTextEdits(blocks(), [{ old_text: "Intro line.\n\n## Tasks", new_text: "## Tasks" }]));
    expect(out).toMatch(/^# Plan\n\n## Tasks/);
  });

  it("applies all edits or none", () => {
    expect(() =>
      applyTextEdits(blocks(), [
        { old_text: "Intro line.", new_text: "x" },
        { old_text: "missing", new_text: "y" },
      ]),
    ).toThrow(/Edit 2 of 2.*No edits were saved/s);
  });
});

describe("sections", () => {
  it("lists headings", () => {
    expect(listHeadings(blocks())).toBe("# Plan\n## Tasks\n### Later\n## Notes");
  });

  it("appends at the end of a section, including its subsections", () => {
    const out = md(placeMarkdown(blocks(), "- [ ] book flights", "append", "## tasks"));
    expect(out.indexOf("book flights")).toBeGreaterThan(out.indexOf("tidy up"));
    expect(out.indexOf("book flights")).toBeLessThan(out.indexOf("## Notes"));
  });

  it("joins an added item onto the list next to it", () => {
    const out = md(placeMarkdown(blocks(), "- buy tape", "append", "Later"));
    expect(out).toContain("- tidy up\n- buy tape");
    const tasks = md(placeMarkdown(blocks(), "- [ ] pay rent", "prepend", "Tasks"));
    expect(tasks).toContain("## Tasks\n\n- [ ] pay rent\n- [ ] send invoice");
  });

  it("prepends just under the heading and replaces only the body", () => {
    const pre = md(placeMarkdown(blocks(), "First!", "prepend", "Notes"));
    expect(pre).toContain("## Notes\n\nFirst!\n\nRavi said");
    const rep = md(placeMarkdown(blocks(), "Fresh.", "replace", "Tasks"));
    expect(rep).toContain("## Tasks\n\nFresh.\n\n## Notes");
    expect(rep).not.toContain("tidy up");
  });

  it("reads one section and explains a missing one", () => {
    expect(sectionMarkdown(blocks(), "Later")).toBe("### Later\n\n- tidy up");
    expect(() => sectionMarkdown(blocks(), "Budget")).toThrow(/No heading "Budget".*## Tasks/s);
  });
});
