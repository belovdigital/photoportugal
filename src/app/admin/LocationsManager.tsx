"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ManagedLocation {
  id: string;
  slug: string;
  name: string;
  region: string;
  description: string | null;
  long_description: string | null;
  cover_image_url: string | null;
  lat: number | null;
  lng: number | null;
  seo_title: string | null;
  seo_description: string | null;
  is_active: boolean;
}

export function LocationsManager() {
  const router = useRouter();
  const [locations, setLocations] = useState<ManagedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ManagedLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [longDesc, setLongDesc] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");

  useEffect(() => { loadLocations(); }, []);

  async function loadLocations() {
    try {
      const res = await fetch("/api/admin/locations");
      if (res.ok) setLocations(await res.json());
    } catch {}
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setName(""); setSlug(""); setRegion(""); setDescription(""); setLongDesc("");
    setLat(""); setLng(""); setSeoTitle(""); setSeoDesc("");
    setShowForm(true);
  }

  function openEdit(loc: ManagedLocation) {
    setEditing(loc);
    setName(loc.name); setSlug(loc.slug); setRegion(loc.region);
    setDescription(loc.description || ""); setLongDesc(loc.long_description || "");
    setLat(loc.lat?.toString() || ""); setLng(loc.lng?.toString() || "");
    setSeoTitle(loc.seo_title || ""); setSeoDesc(loc.seo_description || "");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const formData = new FormData();
    if (editing) formData.append("id", editing.id);
    formData.append("name", name);
    formData.append("slug", slug);
    formData.append("region", region);
    formData.append("description", description);
    formData.append("long_description", longDesc);
    formData.append("lat", lat);
    formData.append("lng", lng);
    formData.append("seo_title", seoTitle);
    formData.append("seo_description", seoDesc);

    const fileInput = document.getElementById("location-cover") as HTMLInputElement;
    if (fileInput?.files?.[0]) formData.append("cover_image", fileInput.files[0]);

    const res = await fetch("/api/admin/locations", {
      method: editing ? "PUT" : "POST",
      body: formData,
    });

    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setMessage(editing ? "Location updated" : "Location created");
      loadLocations();
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(data.error || "Failed");
    }
  }

  async function handleDelete(id: string, locName: string) {
    if (!confirm(`Delete "${locName}"?`)) return;
    const res = await fetch(`/api/admin/locations?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setMessage("Location deleted");
      loadLocations();
    }
  }

  async function toggleActive(loc: ManagedLocation) {
    const formData = new FormData();
    formData.append("id", loc.id);
    formData.append("name", loc.name);
    formData.append("slug", loc.slug);
    formData.append("region", loc.region);
    formData.append("is_active", (!loc.is_active).toString());
    await fetch("/api/admin/locations", { method: "PUT", body: formData });
    loadLocations();
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          Managed Locations ({locations.length})
        </h2>
        <button onClick={openNew} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
          Add Location
        </button>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        These are additional locations managed via admin. The 23 default locations are hardcoded in the codebase.
      </p>

      {message && <div className="mt-3 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">{message}</div>}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-warm-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900">{editing ? "Edit Location" : "New Location"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" value={name} onChange={(e) => { setName(e.target.value); if (!editing) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }}
                required className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug (URL)</label>
              <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
                required className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Region</label>
              <input type="text" value={region} onChange={(e) => setRegion(e.target.value)}
                required placeholder="e.g., Greater Lisbon" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cover Image</label>
              <input type="file" id="location-cover" accept="image/*" className="mt-1 block w-full text-sm text-gray-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Short Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Long Description</label>
            <textarea value={longDesc} onChange={(e) => setLongDesc(e.target.value)} rows={4}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Latitude</label>
              <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Longitude</label>
              <input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">SEO Title</label>
              <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">SEO Description</label>
              <input type="text" value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-warm-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="border-b border-warm-200 bg-warm-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Region</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Slug</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Active</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : locations.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No managed locations yet. The 23 default locations are in the codebase.</td></tr>
            ) : (
              locations.map((loc) => (
                <tr key={loc.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{loc.name}</td>
                  <td className="px-4 py-3 text-gray-500">{loc.region}</td>
                  <td className="px-4 py-3 text-gray-500">{loc.slug}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(loc)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${loc.is_active ? "bg-accent-500" : "bg-gray-200"}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${loc.is_active ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(loc)} className="text-xs font-medium text-primary-600 hover:text-primary-700">Edit</button>
                      <button onClick={() => handleDelete(loc.id, loc.name)} className="text-xs font-medium text-red-500 hover:text-red-600">Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
