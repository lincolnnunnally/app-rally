import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, safeHref } from "./markdown.ts";

test("raw HTML is escaped, never executed", () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="x()">');
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("javascript: links are dropped to plain text", () => {
  const html = renderMarkdown("[click](javascript:alert(1))");
  assert.ok(!html.includes("href"));
  assert.ok(html.includes("click"));
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("//evil.example"), null);
});

test("headings, lists, emphasis, links", () => {
  const html = renderMarkdown(
    "# Big\n\n## Say it simpler\n\nIf your instruction needs **more** explanation, *change* it.\n\n- one\n- two\n\n1. first\n2. second\n\n[Rally](https://rally.unitedundergod.org)",
  );
  assert.ok(html.includes("<h2>Big</h2>"));
  assert.ok(html.includes("<h2>Say it simpler</h2>"));
  assert.ok(html.includes("<strong>more</strong>"));
  assert.ok(html.includes("<em>change</em>"));
  assert.ok(html.includes("<ul><li>one</li><li>two</li></ul>"));
  assert.ok(html.includes("<ol><li>first</li><li>second</li></ol>"));
  assert.ok(html.includes('<a href="https://rally.unitedundergod.org" rel="noopener">Rally</a>'));
});

test("code is escaped and not formatted", () => {
  const html = renderMarkdown("Use `**x** <b>` here\n\n```\n<div>*a*</div>\n```");
  assert.ok(html.includes("<code>**x** &lt;b&gt;</code>"));
  assert.ok(html.includes("<pre><code>&lt;div&gt;*a*&lt;/div&gt;</code></pre>"));
});
