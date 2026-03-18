#!/usr/bin/env node
/**
 * One-time script: Convert HTML blog posts to markdown format.
 * Run: node scripts/convert-html-to-md.mjs
 */
import pg from "pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://photoportugal:PhotoPortugal2026Secure@localhost:5432/photoportugal",
});

function htmlToMarkdown(html) {
  let md = html;

  // Normalize line breaks - collapse to single line first, then work with tags
  md = md.replace(/\r\n/g, "\n").replace(/\n\s*\n/g, "\n");

  // Convert block elements first

  // Headings
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, (_, text) => `\n\n## ${cleanInline(text)}\n\n`);
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, (_, text) => `\n\n### ${cleanInline(text)}\n\n`);
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, (_, text) => `\n\n### ${cleanInline(text)}\n\n`);

  // Images (standalone or inside figure)
  md = md.replace(/<figure[^>]*>\s*<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?\s*>\s*(?:<figcaption>.*?<\/figcaption>\s*)?<\/figure>/gi,
    (_, src, alt) => `\n\n![${alt}](${src})\n\n`);
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?\s*>/gi,
    (_, src, alt) => `![${alt}](${src})`);
  md = md.replace(/<img[^>]+alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?\s*>/gi,
    (_, alt, src) => `![${alt}](${src})`);

  // Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    const items = [];
    inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, text) => {
      items.push(`- ${cleanInline(text.trim())}`);
    });
    return `\n\n${items.join("\n")}\n\n`;
  });

  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    const items = [];
    let n = 1;
    inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, text) => {
      items.push(`${n++}. ${cleanInline(text.trim())}`);
    });
    return `\n\n${items.join("\n")}\n\n`;
  });

  // Blockquote
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, text) => {
    const clean = cleanInline(text.replace(/<\/?p[^>]*>/gi, "").trim());
    return `\n\n> ${clean}\n\n`;
  });

  // Paragraphs - convert to double newline separated text
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, text) => `\n\n${cleanInline(text.trim())}\n\n`);

  // Clean up any remaining block tags
  md = md.replace(/<\/?(div|section|article|header|footer|main|nav|aside|br\s*\/?)[^>]*>/gi, "\n");

  // Strip any remaining HTML tags that slipped through
  md = md.replace(/<[^>]+>/g, "");

  // Clean up whitespace - normalize multiple newlines to double
  md = md.replace(/\n{3,}/g, "\n\n").trim();

  return md;
}

function cleanInline(text) {
  let s = text;

  // Bold
  s = s.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  s = s.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");

  // Italic
  s = s.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  s = s.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Links
  s = s.replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Line breaks
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // Strip any remaining tags
  s = s.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  s = s.replace(/&amp;/g, "&");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&mdash;/g, "—");
  s = s.replace(/&ndash;/g, "–");
  s = s.replace(/&nbsp;/g, " ");

  return s;
}

function isHtml(content) {
  return /^<(h[1-6]|p|div|section|article|figure|ul|ol|blockquote|table|hr|img)\b/im.test(
    content.trim()
  );
}

async function main() {
  const { rows: posts } = await pool.query(
    "SELECT id, slug, content FROM blog_posts ORDER BY created_at"
  );

  console.log(`Found ${posts.length} total blog posts\n`);

  let converted = 0;

  for (const post of posts) {
    if (!isHtml(post.content)) {
      console.log(`  SKIP (already markdown): ${post.slug}`);
      continue;
    }

    const markdown = htmlToMarkdown(post.content);

    // Preview
    console.log(`  CONVERT: ${post.slug}`);
    console.log(`    Before: ${post.content.substring(0, 80)}...`);
    console.log(`    After:  ${markdown.substring(0, 80)}...`);
    console.log();

    await pool.query("UPDATE blog_posts SET content = $1 WHERE id = $2", [
      markdown,
      post.id,
    ]);

    converted++;
  }

  console.log(`\nDone! Converted ${converted} posts from HTML to markdown.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
