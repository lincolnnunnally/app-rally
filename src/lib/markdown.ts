/**
 * A small, safe Markdown-to-HTML renderer for published articles.
 *
 * Safety comes from the order of operations: every character of source text is
 * HTML-escaped before any markup is produced, so raw HTML in the source is shown
 * as text and never executed. Links are allowed only for http(s), mailto and
 * site-relative targets.
 *
 * Supported: ATX headings (#..######), paragraphs, blank-line separation,
 * unordered (-, *, +) and ordered (1.) lists, blockquotes (>), fenced code
 * blocks (```), horizontal rules (---), **bold**, *italic* / _italic_,
 * `inline code`, and [text](url) links.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Accepts only http(s), mailto, and site-relative URLs; returns null otherwise. */
export function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (url.startsWith("#")) return url;
  return null;
}

/** Inline markup on one already-split run of text. Input is raw; output is safe HTML. */
export function renderInline(raw: string): string {
  // Pull out code spans first so their contents are not formatted.
  const codes: string[] = [];
  let text = raw.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\uE000${codes.length - 1}\uE000`;
  });

  // Links: capture before escaping so the URL is checked in its raw form.
  const links: string[] = [];
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const safe = safeHref(href);
    const inner = formatEmphasis(escapeHtml(label));
    if (!safe) {
      links.push(inner);
    } else {
      const external = /^https?:\/\//i.test(safe);
      links.push(
        `<a href="${escapeHtml(safe)}"${external ? ' rel="noopener"' : ""}>${inner}</a>`,
      );
    }
    return `\uE001${links.length - 1}\uE001`;
  });

  let html = formatEmphasis(escapeHtml(text));
  html = html.replace(/\uE001(\d+)\uE001/g, (_m, i: string) => links[Number(i)] ?? "");
  html = html.replace(/\uE000(\d+)\uE000/g, (_m, i: string) => codes[Number(i)] ?? "");
  return html;
}

function formatEmphasis(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^\w_])_([^_\s][^_]*)_(?=[^\w_]|$)/g, "$1<em>$2</em>");
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const isBlank = (l: string) => l.trim() === "";
  const ulRe = /^\s*[-*+]\s+(.*)$/;
  const olRe = /^\s*\d+[.)]\s+(.*)$/;
  const hRe = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
  const hrRe = /^\s*([-*_])(\s*\1){2,}\s*$/;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (or end of input)
      out.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    const h = hRe.exec(line);
    if (h) {
      // Article title is the page's h1, so body headings start at h2.
      const level = Math.min(6, Math.max(2, h[1].length));
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (hrRe.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(body.join("\n"))}</blockquote>`);
      continue;
    }

    if (ulRe.test(line) || olRe.test(line)) {
      const ordered = !ulRe.test(line);
      const re = ordered ? olRe : ulRe;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) {
        let item = re.exec(lines[i])![1];
        i++;
        // Indented continuation lines belong to the item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !ulRe.test(lines[i]) && !olRe.test(lines[i])) {
          item += " " + lines[i].trim();
          i++;
        }
        items.push(`<li>${renderInline(item)}</li>`);
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !hRe.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !ulRe.test(lines[i]) &&
      !olRe.test(lines[i]) &&
      !hrRe.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(`<p>${renderInline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}
