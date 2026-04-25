"use client";

import { useState, useEffect, useCallback } from "react";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content?: string;
  cover_image_url: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  target_keywords?: string | null;
  author: string;
  is_published: boolean;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  locale?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function BlogManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [targetKeywords, setTargetKeywords] = useState("");
  const [author, setAuthor] = useState("Photo Portugal");
  const [isPublished, setIsPublished] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/blog");
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch {
      console.error("Failed to fetch blog posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setSlugManual(false);
    setExcerpt("");
    setContent("");
    setCoverFile(null);
    setCoverPreview(null);
    setMetaTitle("");
    setMetaDescription("");
    setTargetKeywords("");
    setAuthor("Photo Portugal");
    setIsPublished(false);
    setScheduledAt("");
    setPreviewMode(false);
    setError("");
    setEditingPost(null);
  };

  const openNewPost = () => {
    resetForm();
    setShowEditor(true);
  };

  const openEditPost = async (post: BlogPost) => {
    // Fetch full post data via admin endpoint (includes drafts)
    try {
      const res = await fetch(`/api/admin/blog?id=${post.id}`);
      if (res.ok) {
        const fullPost = await res.json();
        setEditingPost(post);
        setTitle(fullPost.title || "");
        setSlug(fullPost.slug || "");
        setSlugManual(true);
        setExcerpt(fullPost.excerpt || "");
        setContent(fullPost.content || "");
        setCoverFile(null);
        setCoverPreview(fullPost.cover_image_url || null);
        setMetaTitle(fullPost.meta_title || "");
        setMetaDescription(fullPost.meta_description || "");
        setTargetKeywords(fullPost.target_keywords || "");
        setAuthor(fullPost.author || "Photo Portugal");
        setIsPublished(fullPost.is_published);
        setScheduledAt(fullPost.scheduled_at ? new Date(fullPost.scheduled_at).toISOString().slice(0, 16) : "");
        setPreviewMode(false);
        setError("");
        setShowEditor(true);
      } else {
        setError("Failed to load post");
      }
    } catch {
      setError("Failed to load post");
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugManual) {
      setSlug(slugify(val));
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("slug", slug);
      formData.append("excerpt", excerpt);
      formData.append("content", content);
      formData.append("meta_title", metaTitle);
      formData.append("meta_description", metaDescription);
      formData.append("target_keywords", targetKeywords);
      formData.append("author", author);
      formData.append("is_published", isPublished.toString());
      if (scheduledAt) {
        formData.append("scheduled_at", new Date(scheduledAt).toISOString());
      }

      if (coverFile) {
        formData.append("cover_image", coverFile);
      }

      if (editingPost) {
        formData.append("id", editingPost.id);
      }

      const res = await fetch("/api/admin/blog", {
        method: editingPost ? "PUT" : "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save post");
      }

      resetForm();
      setShowEditor(false);
      await fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this blog post? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/blog?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchPosts();
      }
    } catch {
      console.error("Failed to delete post");
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Blog Posts</h2>
        <button
          onClick={() => {
            if (showEditor) {
              resetForm();
              setShowEditor(false);
            } else {
              openNewPost();
            }
          }}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
        >
          {showEditor ? "Cancel" : "New Post"}
        </button>
      </div>

      {/* Editor Form */}
      {showEditor && (
        <form onSubmit={handleSave} className="mt-4 rounded-xl border border-warm-200 bg-white p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Post title"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug *
                <button
                  type="button"
                  onClick={() => { setSlugManual(!slugManual); if (slugManual) setSlug(slugify(title)); }}
                  className="ml-2 text-xs text-primary-600 hover:text-primary-700"
                >
                  {slugManual ? "Auto-generate" : "Edit manually"}
                </button>
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="post-slug"
                required
                readOnly={!slugManual}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 ${!slugManual ? "bg-gray-50 text-gray-500" : ""}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short summary for listing pages..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Content *</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className={`px-3 py-1 text-xs font-medium ${!previewMode ? "bg-primary-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(true)}
                  className={`px-3 py-1 text-xs font-medium ${previewMode ? "bg-primary-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Preview
                </button>
              </div>
            </div>
            {!previewMode ? (
              <>
                <p className="text-xs text-gray-400 mb-2">
                  Use ## for H2, ### for H3, **bold**, *italic*, - for lists. Separate paragraphs with blank lines.
                </p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your blog post content..."
                  rows={15}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </>
            ) : (
              <div className="min-h-[360px] rounded-lg border border-gray-300 bg-white p-4 prose prose-sm max-w-none overflow-y-auto">
                {content ? <MarkdownPreview content={content} /> : <p className="text-gray-400 italic">Nothing to preview</p>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-600 hover:file:bg-primary-100"
            />
            {coverPreview && (
              <div className="mt-2">
                <img src={coverPreview} alt="Cover preview" className="h-32 w-auto rounded-lg object-cover" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="SEO title (defaults to post title)"
                maxLength={200}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <p className="mt-1 text-xs text-gray-400">{metaTitle.length}/200</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Photo Portugal"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="SEO description (defaults to excerpt)"
              maxLength={300}
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-400">{metaDescription.length}/300</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Keywords</label>
            <input
              type="text"
              value={targetKeywords}
              onChange={(e) => setTargetKeywords(e.target.value)}
              placeholder="comma, separated, keywords"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => { setIsPublished(e.target.checked); if (e.target.checked) setScheduledAt(""); }}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-primary-300" />
              </label>
              <span className="text-sm font-medium text-gray-700">
                {isPublished ? "Published" : "Draft"}
              </span>
            </div>
            {!isPublished && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Schedule:</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                {scheduledAt && (
                  <button type="button" onClick={() => setScheduledAt("")} className="text-xs text-red-500 hover:text-red-700">Clear</button>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : editingPost ? "Update Post" : "Create Post"}
            </button>
            <button
              type="button"
              onClick={() => { resetForm(); setShowEditor(false); }}
              className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Posts Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-warm-200 bg-white">
        {loading ? (
          <div className="px-4 py-8 text-center text-gray-400">Loading blog posts...</div>
        ) : (
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-warm-200 bg-warm-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Author</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {posts.map((post) => (
                <tr key={post.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {post.cover_image_url && (
                        <img src={post.cover_image_url} alt={post.title} className="h-10 w-14 rounded object-cover" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{post.title}</p>
                        <p className="text-xs text-gray-400">{post.locale && post.locale !== "en" ? `/${post.locale}` : ""}/blog/{post.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{post.author}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      post.is_published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {post.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditPost(post)}
                        className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
                      >
                        Edit
                      </button>
                      {post.is_published && (
                        <a
                          href={`${post.locale && post.locale !== "en" ? `/${post.locale}` : ""}/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          View
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No blog posts yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/** Simple markdown-to-HTML preview — covers headings, bold, italic, lists, links, tables, blockquotes, images */
function MarkdownPreview({ content }: { content: string }) {
  const html = markdownToHtml(content);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Skip table separator rows
    if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
      if (!inTable) { inTable = true; html += "<table class='border-collapse w-full text-sm my-3'><tbody>"; }
      continue;
    }

    // Table rows
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (!inTable) { inTable = true; html += "<table class='border-collapse w-full text-sm my-3'><tbody>"; }
      const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
      html += "<tr>" + cells.map((c) => `<td class='border border-gray-200 px-3 py-1.5'>${inlineMarkdown(c)}</td>`).join("") + "</tr>";
      continue;
    }
    if (inTable) { inTable = false; html += "</tbody></table>"; }

    // Empty line
    if (line.trim() === "") {
      if (inList) { inList = false; html += "</ul>"; }
      continue;
    }

    // Headings
    if (line.startsWith("### ")) { html += `<h3 class='text-lg font-bold mt-5 mb-2'>${inlineMarkdown(line.slice(4))}</h3>`; continue; }
    if (line.startsWith("## ")) { html += `<h2 class='text-xl font-bold mt-6 mb-2'>${inlineMarkdown(line.slice(3))}</h2>`; continue; }
    if (line.startsWith("# ")) { html += `<h1 class='text-2xl font-bold mt-6 mb-3'>${inlineMarkdown(line.slice(2))}</h1>`; continue; }

    // Blockquote
    if (line.startsWith("> ")) { html += `<blockquote class='border-l-4 border-primary-300 pl-4 my-3 text-gray-600 italic'>${inlineMarkdown(line.slice(2))}</blockquote>`; continue; }

    // Unordered list
    if (/^[-*] /.test(line.trim())) {
      if (!inList) { inList = true; html += "<ul class='list-disc pl-5 my-2 space-y-1'>"; }
      html += `<li>${inlineMarkdown(line.trim().slice(2))}</li>`;
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line.trim())) {
      if (!inList) { inList = true; html += "<ol class='list-decimal pl-5 my-2 space-y-1'>"; }
      html += `<li>${inlineMarkdown(line.trim().replace(/^\d+\.\s/, ""))}</li>`;
      continue;
    }

    if (inList) { inList = false; html += "</ul>"; }

    // Paragraph
    html += `<p class='my-2'>${inlineMarkdown(line)}</p>`;
  }

  if (inList) html += "</ul>";
  if (inTable) html += "</tbody></table>";
  return html;
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-lg max-w-full my-2" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 underline">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs">$1</code>');
}
