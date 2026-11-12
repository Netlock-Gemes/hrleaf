import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertToMarkdownString } from "@lexical/markdown";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { createEditor } from "lexical";
import { describe, expect, it } from "vitest";

import {
  CalloutNode,
  EquationNode,
  ToggleContainerNode,
  ToggleContentNode,
  ToggleTitleNode,
} from "@/app/components/editor/custom-nodes";
import { HRLEAF_TRANSFORMERS } from "@/app/components/editor/custom-transformers/HRLeafTransformers";
import { lexicalToMarkdown, markdownToLexical } from "@/lib/markdown-lexical";
import { derivedFields } from "@/server/document-utils";

/** The same node set the editor registers. */
function editor() {
  return createEditor({
    namespace: "test",
    nodes: [
      HeadingNode, ListNode, ListItemNode, QuoteNode, CodeNode, CodeHighlightNode,
      TableNode, TableCellNode, TableRowNode, AutoLinkNode, LinkNode, HorizontalRuleNode,
      EquationNode, CalloutNode, ToggleContainerNode, ToggleTitleNode, ToggleContentNode,
    ],
    onError: (e) => {
      throw e;
    },
  });
}

/** Loads JSON into a real editor (throws on anything it can't read) and returns what the app would export. */
function throughEditor(json: object) {
  const ed = editor();
  const state = ed.parseEditorState(JSON.stringify(json));
  return {
    json: state.toJSON(),
    markdown: state.read(() => $convertToMarkdownString(HRLEAF_TRANSFORMERS)),
  };
}

const SAMPLE = `# Weekly plan

Some **bold**, *italic*, ~~gone~~ and \`code\` with a [link](https://example.com) and a [note](/other-note).

## Lists

- one
- two
  - nested
- three

1. first
2. second

- [ ] todo
- [x] done

> A quote
> over two lines

> [!TIP]
> Callouts work too.

\`\`\`ts
const x = 1;
console.log(x);
\`\`\`

---

| Name | Score |
| --- | --- |
| Ada | 10 |
| Bob | *7* |

Inline math $x^2$ and a block:

$$
E = mc^2
$$

<details>
<summary>More</summary>

Hidden text.

</details>
`;

describe("markdownToLexical", () => {
  it("produces JSON the editor loads without errors", () => {
    const json = markdownToLexical(SAMPLE);
    const { json: back } = throughEditor(json);
    const types = back.root.children.map((c) => c.type);
    expect(types).toEqual([
      "heading", "paragraph", "heading", "list", "list", "list", "quote", "callout",
      "code", "horizontalrule", "table", "paragraph", "paragraph", "toggle",
    ]);
  });

  it("keeps text, formats and structure", () => {
    const md = throughEditor(markdownToLexical(SAMPLE)).markdown;
    expect(md).toContain("# Weekly plan");
    expect(md).toContain("**bold**");
    expect(md).toContain("*italic*");
    expect(md).toContain("~~gone~~");
    expect(md).toContain("`code`");
    expect(md).toContain("[note](/other-note)");
    expect(md).toContain("- [ ] todo");
    expect(md).toContain("- [x] done");
    expect(md).toContain("> [!TIP]");
    expect(md).toContain("```ts\nconst x = 1;\nconsole.log(x);\n```");
    expect(md).toContain("$x^2$");
    expect(md).toContain("<summary>More</summary>");
  });

  it("nests lists the way the editor does", () => {
    const json = markdownToLexical("- a\n  - b\n- c");
    const list = throughEditor(json).json.root.children[0] as unknown as {
      children: { children: { type: string }[] }[];
    };
    expect(list.children).toHaveLength(3);
    expect(list.children[1].children[0].type).toBe("list");
  });

  it("maps alert kinds to callout variants", () => {
    const variant = (kind: string) =>
      (markdownToLexical(`> [!${kind}]\n> x`).root.children![0] as { variant?: string }).variant;
    expect(variant("NOTE")).toBe("note");
    expect(variant("WARNING")).toBe("warning");
    expect(variant("IMPORTANT")).toBe("danger");
  });

  it("does not read prices as equations", () => {
    const json = markdownToLexical("It costs $5 and $10 today.");
    expect(JSON.stringify(json)).not.toContain('"equation"');
  });

  it("gives the stored fields the app expects", () => {
    const d = derivedFields(markdownToLexical("# Hi\n\nThere"));
    expect(d.is_empty).toBe(false);
    expect(d.preview).toBe("Hi · There");
    expect(derivedFields(markdownToLexical("   \n")).is_empty).toBe(true);
  });
});

describe("lexicalToMarkdown", () => {
  it("round-trips the sample", () => {
    const once = lexicalToMarkdown(markdownToLexical(SAMPLE));
    const twice = lexicalToMarkdown(markdownToLexical(once));
    expect(twice).toBe(once);
    expect(once).toContain("| Ada | 10 |");
    expect(once).toContain("  - nested");
    expect(once).toContain("$$E = mc^2$$");
  });
});
