import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;

  const data = verifyToken(token);
  if (!data) return false;

  const user = await queryOne<{ role: string }>(
    "SELECT role FROM users WHERE email = $1",
    [data.email]
  );
  return user?.role === "admin";
}

// GET: list all posts (admin, includes drafts) or single post by id
export async function GET(req: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      // Fetch single post with full content (for editing)
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
        is_published: boolean;
        published_at: string | null;
        created_at: string;
        updated_at: string;
      }>(
        "SELECT * FROM blog_posts WHERE id = $1",
        [id]
      );

      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      return NextResponse.json(post);
    }

    const posts = await query<{
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      cover_image_url: string | null;
      author: string;
      is_published: boolean;
      published_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT id, slug, title, excerpt, cover_image_url, author, is_published, published_at, created_at, updated_at FROM blog_posts ORDER BY created_at DESC"
    );

    return NextResponse.json(posts);
  } catch (error) {
    console.error("[admin/blog] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

// POST: create new post
export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();

    const title = formData.get("title") as string;
    const slug = formData.get("slug") as string;
    const excerpt = (formData.get("excerpt") as string) || null;
    const content = formData.get("content") as string;
    const metaTitle = (formData.get("meta_title") as string) || null;
    const metaDescription = (formData.get("meta_description") as string) || null;
    const targetKeywords = (formData.get("target_keywords") as string) || null;
    const author = (formData.get("author") as string) || "Photo Portugal";
    const isPublished = formData.get("is_published") === "true";
    const coverFile = formData.get("cover_image") as File | null;

    if (!title || !slug || !content) {
      return NextResponse.json({ error: "Title, slug, and content are required" }, { status: 400 });
    }

    // Check for duplicate slug
    const existing = await queryOne("SELECT id FROM blog_posts WHERE slug = $1", [slug]);
    if (existing) {
      return NextResponse.json({ error: "A post with this slug already exists" }, { status: 400 });
    }

    let coverImageUrl: string | null = null;

    if (coverFile && coverFile.size > 0) {
      if (coverFile.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Cover image too large (max 5MB)" }, { status: 400 });
      }
      if (!coverFile.type.startsWith("image/")) {
        return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
      }

      const ext = coverFile.name.split(".").pop() || "jpg";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const blogDir = path.join(UPLOAD_DIR, "blog");
      await mkdir(blogDir, { recursive: true });

      const buffer = Buffer.from(await coverFile.arrayBuffer());
      await writeFile(path.join(blogDir, filename), buffer);

      coverImageUrl = `/uploads/blog/${filename}`;
    }

    const publishedAt = isPublished ? new Date().toISOString() : null;

    const post = await queryOne<{ id: string }>(
      `INSERT INTO blog_posts (title, slug, excerpt, content, cover_image_url, meta_title, meta_description, target_keywords, author, is_published, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [title, slug, excerpt, content, coverImageUrl, metaTitle, metaDescription, targetKeywords, author, isPublished, publishedAt]
    );

    return NextResponse.json({ success: true, id: post?.id });
  } catch (error) {
    console.error("[admin/blog] POST error:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}

// PUT: update post
export async function PUT(req: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();

    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const slug = formData.get("slug") as string;
    const excerpt = (formData.get("excerpt") as string) || null;
    const content = formData.get("content") as string;
    const metaTitle = (formData.get("meta_title") as string) || null;
    const metaDescription = (formData.get("meta_description") as string) || null;
    const targetKeywords = (formData.get("target_keywords") as string) || null;
    const author = (formData.get("author") as string) || "Photo Portugal";
    const isPublished = formData.get("is_published") === "true";
    const coverFile = formData.get("cover_image") as File | null;

    if (!id || !title || !slug || !content) {
      return NextResponse.json({ error: "ID, title, slug, and content are required" }, { status: 400 });
    }

    // Check for duplicate slug (excluding current post)
    const existing = await queryOne<{ id: string }>("SELECT id FROM blog_posts WHERE slug = $1 AND id != $2", [slug, id]);
    if (existing) {
      return NextResponse.json({ error: "A post with this slug already exists" }, { status: 400 });
    }

    // Get current post to check publish state change
    const currentPost = await queryOne<{ is_published: boolean; published_at: string | null; cover_image_url: string | null }>(
      "SELECT is_published, published_at, cover_image_url FROM blog_posts WHERE id = $1",
      [id]
    );

    if (!currentPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    let coverImageUrl = currentPost.cover_image_url;

    if (coverFile && coverFile.size > 0) {
      if (coverFile.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Cover image too large (max 5MB)" }, { status: 400 });
      }
      if (!coverFile.type.startsWith("image/")) {
        return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
      }

      const ext = coverFile.name.split(".").pop() || "jpg";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const blogDir = path.join(UPLOAD_DIR, "blog");
      await mkdir(blogDir, { recursive: true });

      const buffer = Buffer.from(await coverFile.arrayBuffer());
      await writeFile(path.join(blogDir, filename), buffer);

      coverImageUrl = `/uploads/blog/${filename}`;
    }

    // Set published_at if publishing for the first time
    let publishedAt = currentPost.published_at;
    if (isPublished && !currentPost.is_published) {
      publishedAt = new Date().toISOString();
    } else if (!isPublished) {
      publishedAt = null;
    }

    await queryOne(
      `UPDATE blog_posts
       SET title = $1, slug = $2, excerpt = $3, content = $4, cover_image_url = $5,
           meta_title = $6, meta_description = $7, target_keywords = $8, author = $9,
           is_published = $10, published_at = $11
       WHERE id = $12
       RETURNING id`,
      [title, slug, excerpt, content, coverImageUrl, metaTitle, metaDescription, targetKeywords, author, isPublished, publishedAt, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/blog] PUT error:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

// DELETE: delete post
export async function DELETE(req: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Post ID required" }, { status: 400 });
    }

    const deleted = await queryOne("DELETE FROM blog_posts WHERE id = $1 RETURNING id", [id]);
    if (!deleted) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/blog] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
