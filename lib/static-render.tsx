import "server-only";

import katex from "katex";
import { Fragment, ReactNode } from "react";

import theme from "@/app/components/editor/themes/DefaultTheme";
import { CALLOUT_ICONS, CALLOUT_LABELS, CHEVRON_ICON, isCalloutVariant } from "@/lib/blocks";

/**
 * Renders saved Lexical JSON to plain React/HTML on the server, using the same
 * class names as the live editor. Used for instant first paint and read-only pages.
 */

type Node = {
  type?: string;
  children?: Node[];
  text?: string;
  format?: number | string;
  tag?: string;
  listType?: "bullet" | "number" | "check";
  start?: number;
  checked?: boolean;
  url?: string;
  highlightType?: string;
  language?: string;
  headerState?: number;
  colSpan?: number;
  rowSpan?: number;
  equation?: string;
  inline?: boolean;
  indent?: number;
  variant?: string;
  open?: boolean;
};

type Options = { equations: "katex" | "plain" };

const FORMAT = {
  bold: 1,
  italic: 2,
  strikethrough: 4,
  underline: 8,
  code: 16,
  subscript: 32,
  superscript: 64,
};

const safeUrl = (url?: string) =>
  url && /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : undefined;

const align = (format: Node["format"]) =>
  typeof format === "string" && ["center", "right", "justify"].includes(format)
    ? { textAlign: format as "center" | "right" | "justify" }
    : undefined;

function renderText(node: Node, key: number): ReactNode {
  const f = typeof node.format === "number" ? node.format : 0;
  const classes: string[] = [];
  if (f & FORMAT.bold) classes.push(theme.text.bold);
  if (f & FORMAT.italic) classes.push(theme.text.italic);
  if (f & FORMAT.underline && f & FORMAT.strikethrough) classes.push(theme.text.underlineStrikethrough);
  else if (f & FORMAT.underline) classes.push(theme.text.underline);
  else if (f & FORMAT.strikethrough) classes.push(theme.text.strikethrough);

  let el: ReactNode = node.text ?? "";
  if (f & FORMAT.code) return <code key={key} className={theme.text.code}>{el}</code>;
  if (f & FORMAT.subscript) el = <sub>{el}</sub>;
  if (f & FORMAT.superscript) el = <sup>{el}</sup>;
  return classes.length ? (
    <span key={key} className={classes.join(" ")}>{el}</span>
  ) : (
    <Fragment key={key}>{el}</Fragment>
  );
}

function renderEquation(node: Node, key: number, opts: Options): ReactNode {
  const inline = node.inline ?? false;
  const cls = `${theme.equation.container} ${inline ? theme.equation.inline : theme.equation.block}`;
  if (opts.equations === "plain") {
    return (
      <span key={key} className={cls}>
        <code className={theme.text.code}>{node.equation}</code>
      </span>
    );
  }
  const html = katex.renderToString(node.equation ?? "", {
    displayMode: !inline,
    throwOnError: false,
    output: "html",
    trust: false,
    strict: "ignore",
  });
  return (
    <span key={key} className={cls}>
      <span className={theme.equation.renderer} dangerouslySetInnerHTML={{ __html: html }} />
    </span>
  );
}

function renderChildren(nodes: Node[] | undefined, opts: Options, depth = 0): ReactNode[] {
  return (nodes ?? []).map((n, i) => renderNode(n, i, opts, depth));
}

function renderNode(node: Node, key: number, opts: Options, depth: number): ReactNode {
  switch (node.type) {
    case "text":
    case "code-highlight":
      if (node.type === "code-highlight" && node.highlightType) {
        const cls = (theme.codeHighlight as Record<string, string>)[node.highlightType];
        return <span key={key} className={cls}>{node.text}</span>;
      }
      return renderText(node, key);
    case "tab":
      return <Fragment key={key}>{"\t"}</Fragment>;
    case "linebreak":
      return <br key={key} />;
    case "paragraph":
      return (
        <p key={key} className={theme.paragraph} style={align(node.format)}>
          {node.children?.length ? renderChildren(node.children, opts, depth) : <br />}
        </p>
      );
    case "heading": {
      const tag = (["h1", "h2", "h3", "h4", "h5"].includes(node.tag ?? "") ? node.tag : "h2") as
        "h1" | "h2" | "h3" | "h4" | "h5";
      const Tag = tag;
      return (
        <Tag key={key} className={theme.heading[tag]} style={align(node.format)}>
          {renderChildren(node.children, opts, depth)}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote key={key} className={theme.quote}>
          {renderChildren(node.children, opts, depth)}
        </blockquote>
      );
    case "list": {
      const ordered = node.listType === "number";
      const Tag = ordered ? "ol" : "ul";
      const depthCls = ordered
        ? theme.list.olDepth[depth % theme.list.olDepth.length]
        : theme.list.ulDepth[depth % theme.list.ulDepth.length];
      const cls = [ordered ? theme.list.ol : theme.list.ul, depthCls];
      if (node.listType === "check") cls.push(theme.list.checklist);
      return (
        <Tag key={key} className={cls.join(" ")} start={ordered ? node.start : undefined}>
          {(node.children ?? []).map((child, i) => {
            const nested = child.children?.some((c) => c.type === "list");
            const liCls = [theme.list.listitem];
            if (nested) liCls.push(theme.list.nested.listitem);
            else if (node.listType === "check") {
              liCls.push(child.checked ? theme.list.listitemChecked : theme.list.listitemUnchecked);
            }
            return (
              <li
                key={i}
                className={liCls.join(" ")}
                role={node.listType === "check" && !nested ? "checkbox" : undefined}
                aria-checked={node.listType === "check" && !nested ? !!child.checked : undefined}
              >
                {renderChildren(child.children, opts, nested ? depth + 1 : depth)}
              </li>
            );
          })}
        </Tag>
      );
    }
    case "link":
    case "autolink":
      return (
        <a key={key} href={safeUrl(node.url)} className={theme.link} target="_blank" rel="noopener noreferrer">
          {renderChildren(node.children, opts, depth)}
        </a>
      );
    case "code": {
      const lines = 1 + (node.children ?? []).filter((c) => c.type === "linebreak").length;
      return (
        <code
          key={key}
          className={theme.code}
          data-gutter={Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
          data-language={node.language}
        >
          {renderChildren(node.children, opts, depth)}
        </code>
      );
    }
    case "horizontalrule":
      return <hr key={key} className={theme.hr} />;
    case "table":
      return (
        <div key={key} className={theme.tableScrollableWrapper}>
          <table className={theme.table}>
            <tbody>{renderChildren(node.children, opts, depth)}</tbody>
          </table>
        </div>
      );
    case "tablerow":
      return <tr key={key}>{renderChildren(node.children, opts, depth)}</tr>;
    case "tablecell": {
      const header = (node.headerState ?? 0) > 0;
      const Tag = header ? "th" : "td";
      return (
        <Tag
          key={key}
          className={`${theme.tableCell} ${header ? theme.tableCellHeader : ""}`}
          colSpan={node.colSpan && node.colSpan > 1 ? node.colSpan : undefined}
          rowSpan={node.rowSpan && node.rowSpan > 1 ? node.rowSpan : undefined}
        >
          {renderChildren(node.children, opts, depth)}
        </Tag>
      );
    }
    case "equation":
      return renderEquation(node, key, opts);
    case "callout": {
      const variant = isCalloutVariant(node.variant) ? node.variant : "note";
      return (
        <aside key={key} className="editor-callout" data-variant={variant} aria-label={CALLOUT_LABELS[variant]}>
          <span className="editor-callout-icon" dangerouslySetInnerHTML={{ __html: CALLOUT_ICONS[variant] }} />
          <div className="editor-callout-body">{renderChildren(node.children, opts, depth)}</div>
        </aside>
      );
    }
    case "toggle": {
      const [title, ...rest] = node.children ?? [];
      return (
        <details key={key} className="editor-toggle" open={node.open !== false}>
          <summary className="editor-toggle-title">
            <span className="editor-toggle-chevron" dangerouslySetInnerHTML={{ __html: CHEVRON_ICON }} />
            <span className="editor-toggle-title-text">
              {title?.type === "toggle-title" ? renderChildren(title.children, opts, depth) : null}
            </span>
          </summary>
          {rest.map((child, i) => renderNode(child, i, opts, depth))}
        </details>
      );
    }
    case "toggle-content":
      return (
        <div key={key} className="editor-toggle-content">
          {renderChildren(node.children, opts, depth)}
        </div>
      );
    default:
      return node.children ? (
        <Fragment key={key}>{renderChildren(node.children, opts, depth)}</Fragment>
      ) : null;
  }
}

export function renderDocumentStatic(
  content: object | null | undefined,
  opts: Options = { equations: "plain" },
): ReactNode {
  const root = (content as { root?: Node } | null)?.root;
  if (!root?.children?.length) return null;
  return renderChildren(root.children, opts);
}
