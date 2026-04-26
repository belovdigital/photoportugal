import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

// GET: list published posts (public) or single post by slug
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  try {
    if (slug) {
      // Single post by slug
      const post = await queryOne<{
        id: string;
        slug: string;
        title: string;
        excerpt: string | null;
        content: string;
        cover_image_url: string | null;
        meta_title: string | null;
        meta_description: string | null;
        target_keywords: string | null;
        author: string;
        published_at: string;
        created_at: string;
      }>(
        "SELECT id, slug, title, excerpt, content, cover_image_url, meta_title, meta_description, target_keywords, author, published_at, created_at FROM blog_posts WHERE slug = $1 AND is_published = TRUE",
        [slug]
      );

      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      return NextResponse.json(post);
    }

    // List published posts
    const posts = await query<{
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      cover_image_url: string | null;
      author: string;
      published_at: string;
    }>(
      "SELECT id, slug, title, excerpt, cover_image_url, author, published_at FROM blog_posts WHERE is_published = TRUE ORDER BY published_at DESC"
    );

    return NextResponse.json(posts);
  } catch (error) {
    console.error("[blog] GET error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/blog", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}
