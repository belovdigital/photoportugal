"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { SHOOT_TYPES, LANGUAGES } from "@/types";
import { useConfirmModal } from "@/components/ui/ConfirmModal";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import imageCompression from "browser-image-compression";
import { convertHeicIfNeeded } from "@/lib/convert-heic";
import { Avatar } from "@/components/ui/Avatar";
import { parsePhone } from "@/lib/phone-codes";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { DURATION_OPTIONS, getPricingForDuration, formatDuration } from "@/lib/package-pricing";

interface Profile {
  id: string;
  slug: string;
  name: string;
  first_name?: string;
  last_name?: string;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  cover_position_y: number;
  languages: string[];
  shoot_types: string[];
  hourly_rate: number | null;
  experience_years: number;
  plan: string;
  rating: number;
  review_count: number;
  session_count: number;
  is_approved: boolean;
  location_slugs: string[];
}

interface PortfolioItem {
  id: string;
  type: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  location_slug: string | null;
  shoot_type: string | null;
  sort_order: number;
  _uploading?: boolean;
  _preview?: string;
}

interface Package {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  num_photos: number;
  price: number;
  is_popular: boolean;
  is_public: boolean;
  delivery_days: number;
  features: string[];
}

interface Booking {
  id: string;
  client_name: string;
  client_email: string;
  client_avatar: string | null;
  package_name: string | null;
  duration_minutes: number | null;
  num_photos: number | null;
  status: string;
  shoot_date: string | null;
  shoot_time: string | null;
  total_price: number | null;
  message: string | null;
  created_at: string;
  payment_status: string | null;
  delivery_accepted: boolean;
}

interface LocationOption {
  slug: string;
  name: string;
  region: string;
}

type Tab = "profile" | "portfolio" | "packages" | "bookings";

export function PhotographerDashboardClient({
  profile,
  portfolioItems,
  packages,
  bookings,
  allLocations,
  initialTab,
  standalone,
}: {
  profile: Profile;
  portfolioItems: PortfolioItem[];
  packages: Package[];
  bookings: Booking[];
  allLocations: LocationOption[];
  initialTab?: Tab;
  standalone?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("photographerDashboard");
  const td = useTranslations("dashboard");
  const { modal, confirm } = useConfirmModal();
  const [activeTab, setActiveTabState] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "") as Tab;
      if (["profile", "portfolio", "packages", "bookings"].includes(hash)) return hash;
    }
    return initialTab || "profile";
  });

  function setActiveTab(tab: Tab) {
    setActiveTabState(tab);
    window.history.replaceState(null, "", `#${tab}`);
  }
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [message, setMessage] = useState("");

  // Warn before leaving with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) { e.preventDefault(); }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Profile form state
  const [firstName, setFirstName] = useState(profile.first_name || "");
  const [lastName, setLastName] = useState(profile.last_name || "");
  const [phoneCode, setPhoneCode] = useState("+351");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState(profile.name);

  // Load phone on mount
  useEffect(() => {
    fetch("/api/dashboard/account").then(r => r.json()).then(d => {
      if (d.phone) {
        const parsed = parsePhone(d.phone);
        setPhoneCode(parsed.code);
        setPhoneNumber(parsed.number);
      }
    }).catch(() => {});
  }, []);
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(profile.languages);
  const [selectedShootTypes, setSelectedShootTypes] = useState<string[]>(profile.shoot_types);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(profile.location_slugs);
  const [experienceYears, setExperienceYears] = useState(profile.experience_years.toString());
  const [customSlug, setCustomSlug] = useState(profile.slug);

  // Package form state
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgDuration, setPkgDuration] = useState("");
  const [pkgPhotos, setPkgPhotos] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgPopular, setPkgPopular] = useState(false);
  const [pkgPublic, setPkgPublic] = useState(true);
  const [pkgFeatures, setPkgFeatures] = useState<string[]>([]);
  const [pkgDeliveryDays, setPkgDeliveryDays] = useState("7");

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  function toggleItem(arr: string[], item: string, setter: (v: string[]) => void) {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  }

  // === Profile ===
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (selectedLanguages.length === 0) {
      showMessage(t("selectOneLanguage"));
      return;
    }
    setSaving(true);

    const res = await fetch("/api/dashboard/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        phone: phoneNumber ? `${phoneCode}${phoneNumber}` : null,
        tagline,
        bio,
        languages: selectedLanguages,
        shoot_types: selectedShootTypes,
        experience_years: parseInt(experienceYears) || 0,
        locations: selectedLocations,
        custom_slug: profile.plan === "premium" ? customSlug : undefined,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setIsDirty(false);
      showMessage(t("profileSaved"));
      router.refresh();
      // If slug changed, update URL
      if (profile.plan === "premium" && customSlug !== profile.slug) {
        window.location.href = `/dashboard/profile#profile`;
      }
    } else {
      const data = await res.json().catch(() => null);
      showMessage(data?.error || t("errorSavingProfile"));
    }
  }

  // === Portfolio ===
  const [localItems, setLocalItems] = useState(portfolioItems);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; done: number; failed: number } | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [portfolioFilter, setPortfolioFilter] = useState<{ location: string; shootType: string }>({ location: "", shootType: "" });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Sync from server only on initial load
  const initialSyncRef = useRef(true);
  useEffect(() => {
    if (initialSyncRef.current) {
      initialSyncRef.current = false;
      setLocalItems(portfolioItems);
    }
  }, [portfolioItems]);

  async function processFiles(files: FileList | File[]) {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (fileArr.length === 0) return;

    setUploadingPortfolio(true);
    const total = fileArr.length;
    const progress = { total, done: 0, failed: 0 };
    setUploadProgress({ ...progress });

    // Process in parallel batches of 3
    const BATCH_SIZE = 3;
    for (let i = 0; i < fileArr.length; i += BATCH_SIZE) {
      const batch = fileArr.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (file) => {
          // Show local preview immediately
          const previewUrl = URL.createObjectURL(file);
          const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          setLocalItems((prev) => [
            ...prev,
            { id: tempId, type: "photo", url: previewUrl, thumbnail_url: null, caption: null, location_slug: null, shoot_type: null, sort_order: prev.length, _uploading: true },
          ]);

          // Convert HEIC to JPEG on client (iOS)
          let processedFile = file;
          try { processedFile = await convertHeicIfNeeded(file); } catch { /* use original */ }

          // Compress on client
          let compressed: File | Blob = processedFile;
          try {
            compressed = await imageCompression(processedFile, {
              maxSizeMB: 2,
              maxWidthOrHeight: 2000,
              useWebWorker: true,
              fileType: "image/jpeg",
            });
          } catch {
            // Send original if compression fails
          }

          const formData = new FormData();
          formData.append("file", compressed, file.name);

          try {
            const res = await fetch("/api/dashboard/portfolio", {
              method: "POST",
              body: formData,
            });

            if (res.ok) {
              const data = await res.json();
              if (data.item) {
                // Replace temp with real item, keep the local preview as display
                setLocalItems((prev) =>
                  prev.map((it) => (it.id === tempId ? { ...data.item, _preview: previewUrl } : it))
                );
              }
              progress.done++;
            } else {
              const err = await res.json().catch(() => null);
              setLocalItems((prev) => prev.filter((it) => it.id !== tempId));
              URL.revokeObjectURL(previewUrl);
              progress.failed++;
              showMessage(err?.error || t("uploadFailed"));
            }
          } catch {
            setLocalItems((prev) => prev.filter((it) => it.id !== tempId));
            URL.revokeObjectURL(previewUrl);
            progress.failed++;
          }
          setUploadProgress({ ...progress });
        })
      );
    }

    setUploadingPortfolio(false);
    if (progress.failed === 0) {
      showMessage(progress.done !== 1 ? t("photosUploadedPlural", { count: progress.done }) : t("photosUploaded", { count: progress.done }));
    } else {
      showMessage(t("uploadedAndFailed", { done: progress.done, failed: progress.failed }));
    }
    setTimeout(() => setUploadProgress(null), 2000);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    const okDel = await confirm("Delete Photos", selectedIds.size !== 1 ? t("deleteSelectedPhotosPlural", { count: selectedIds.size }) : t("deleteSelectedPhotos", { count: selectedIds.size }), { danger: true, confirmLabel: "Delete" });
    if (!okDel) return;
    const ids = [...selectedIds];
    // Optimistic: remove immediately
    setLocalItems((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    showMessage(ids.length !== 1 ? t("photosDeletedPlural", { count: ids.length }) : t("photosDeleted", { count: ids.length }));
    // Fire deletes in background
    await Promise.all(ids.map((id) => fetch(`/api/dashboard/portfolio?id=${id}`, { method: "DELETE" })));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  async function deletePhoto(id: string) {
    const okDel = await confirm("Delete Photo", t("deleteThisPhoto"), { danger: true, confirmLabel: "Delete" });
    if (!okDel) return;
    // Optimistic delete
    setLocalItems((prev) => prev.filter((p) => p.id !== id));
    showMessage(t("photoDeleted"));
    await fetch(`/api/dashboard/portfolio?id=${id}`, { method: "DELETE" });
  }

  async function updatePhotoTag(itemId: string, field: "location_slug" | "shoot_type", value: string) {
    // Optimistic update
    setLocalItems((prev) =>
      prev.map((p) => (p.id === itemId ? { ...p, [field]: value || null } : p))
    );
    const item = localItems.find((p) => p.id === itemId);
    if (!item) return;
    await fetch("/api/dashboard/portfolio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: itemId,
        location_slug: field === "location_slug" ? (value || null) : item.location_slug,
        shoot_type: field === "shoot_type" ? (value || null) : item.shoot_type,
      }),
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((p) => p.id === active.id);
    const newIndex = localItems.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(reordered);

    // Save in background
    fetch("/api/dashboard/portfolio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reorder",
        items: reordered.map((item, i) => ({ id: item.id, sort_order: i })),
      }),
    });
  }

  const activeDragItem = activeDragId ? localItems.find((p) => p.id === activeDragId) : null;

  // Portfolio filters: only show tags that exist
  const usedLocations = [...new Set(localItems.map((p) => p.location_slug).filter(Boolean))] as string[];
  const usedShootTypes = [...new Set(localItems.map((p) => p.shoot_type).filter(Boolean))] as string[];

  const filteredPortfolio = localItems.filter((item) => {
    if (portfolioFilter.location && item.location_slug !== portfolioFilter.location) return false;
    if (portfolioFilter.shootType && item.shoot_type !== portfolioFilter.shootType) return false;
    return true;
  });

  // === Packages ===
  function openNewPackage() {
    setEditingPackage(null);
    setPkgName("");
    setPkgDesc("");
    setPkgDuration("");
    setPkgPhotos("30");
    setPkgPrice("");
    setPkgPopular(false);
    setPkgPublic(true);
    setPkgFeatures([]);
    setPkgDeliveryDays("7");
    setShowPackageForm(true);
  }

  function openEditPackage(pkg: Package) {
    setEditingPackage(pkg);
    setPkgName(pkg.name);
    setPkgDesc(pkg.description || "");
    setPkgDuration(pkg.duration_minutes.toString());
    setPkgPhotos(pkg.num_photos.toString());
    setPkgPrice(pkg.price.toString());
    setPkgPopular(pkg.is_popular);
    setPkgPublic(pkg.is_public !== false);
    setPkgFeatures(pkg.features || []);
    setPkgDeliveryDays((pkg.delivery_days || 7).toString());
    setShowPackageForm(true);
  }

  async function savePackage(e: React.FormEvent) {
    e.preventDefault();

    const durationMin = parseInt(pkgDuration);
    const priceVal = parseFloat(pkgPrice);
    const pricing = getPricingForDuration(durationMin);
    if (pricing && priceVal < pricing.minPrice) {
      showMessage(`Minimum price for ${DURATION_OPTIONS.find(o => o.minutes === durationMin)?.label} is €${pricing.minPrice}`);
      return;
    }

    setSaving(true);

    const body = {
      id: editingPackage?.id,
      name: pkgName,
      description: pkgDesc,
      duration_minutes: durationMin,
      num_photos: parseInt(pkgPhotos),
      price: priceVal,
      is_popular: pkgPopular,
      is_public: pkgPublic,
      features: pkgFeatures.filter((f) => f.trim()),
      delivery_days: parseInt(pkgDeliveryDays) || 7,
    };

    const res = await fetch("/api/dashboard/packages", {
      method: editingPackage ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (editingPackage) {
        // Update in local state — if this one is popular, clear others
        setLocalPackages((prev) =>
          prev.map((p) => (p.id === editingPackage.id
            ? { ...p, name: pkgName, description: pkgDesc || null, duration_minutes: parseInt(pkgDuration), num_photos: parseInt(pkgPhotos), price: parseFloat(pkgPrice), is_popular: pkgPopular, is_public: pkgPublic, features: pkgFeatures.filter((f) => f.trim()), delivery_days: parseInt(pkgDeliveryDays) || 7 }
            : pkgPopular ? { ...p, is_popular: false } : p))
        );
      } else if (data?.id) {
        // Add to local state — if this one is popular, clear others
        setLocalPackages((prev) => [
          ...(pkgPopular ? prev.map((p) => ({ ...p, is_popular: false })) : prev),
          {
            id: data.id, name: pkgName, description: pkgDesc || null, duration_minutes: parseInt(pkgDuration),
            num_photos: parseInt(pkgPhotos), price: parseFloat(pkgPrice), is_popular: pkgPopular, is_public: pkgPublic, features: pkgFeatures.filter((f) => f.trim()), delivery_days: parseInt(pkgDeliveryDays) || 7,
          },
        ]);
      }
      showMessage(editingPackage ? t("packageUpdated") : t("packageCreated"));
      setShowPackageForm(false);
    } else {
      const data = await res.json().catch(() => null);
      showMessage(data?.error || t("errorSavingPackage"));
    }
  }

  async function deletePackage(id: string) {
    const okDel = await confirm("Delete Package", t("deleteThisPackage"), { danger: true, confirmLabel: "Delete" });
    if (!okDel) return;
    setLocalPackages((prev) => prev.filter((p) => p.id !== id));
    showMessage(t("packageDeleted"));
    await fetch(`/api/dashboard/packages?id=${id}`, { method: "DELETE" });
  }

  // === Local packages state for DnD ===
  const [localPackages, setLocalPackages] = useState(packages);
  const initialPkgSyncRef = useRef(true);
  useEffect(() => {
    if (initialPkgSyncRef.current) {
      initialPkgSyncRef.current = false;
      setLocalPackages(packages);
    }
  }, [packages]);

  const [activePkgDragId, setActivePkgDragId] = useState<string | null>(null);
  const activePkgDragItem = activePkgDragId ? localPackages.find((p) => p.id === activePkgDragId) : null;

  function handlePkgDragStart(event: DragStartEvent) {
    setActivePkgDragId(event.active.id as string);
  }

  function handlePkgDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActivePkgDragId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = localPackages.findIndex((p) => p.id === active.id);
    const newIndex = localPackages.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localPackages, oldIndex, newIndex);
    setLocalPackages(reordered);

    // Save in background
    fetch("/api/dashboard/packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: reordered.map((pkg, i) => ({ id: pkg.id, order: i })),
      }),
    });
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending").length;
  const tabs: { key: Tab; label: string }[] = [
    { key: "bookings", label: pendingBookings > 0 ? t("tabBookingsNew", { count: pendingBookings }) : bookings.length > 0 ? t("tabBookingsCount", { count: bookings.length }) : t("tabBookings") },
    { key: "profile", label: t("tabProfile") },
    { key: "portfolio", label: t("tabPortfolio", { count: portfolioItems.length }) },
    { key: "packages", label: t("tabPackages", { count: localPackages.length }) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {!standalone && (
        <>
          {/* Header */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-gray-900">
                {t("title")}
              </h1>
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-600 uppercase">
                {profile.plan}
              </span>
            </div>
            <p className="mt-1 text-gray-500">
              {t("subtitle")}
            </p>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            {[
              { label: td("statRating"), value: profile.rating ? `${profile.rating}/5` : "—" },
              { label: td("statReviews"), value: profile.review_count },
              { label: td("statSessions"), value: profile.session_count },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Message */}
          {message && (
            <div className="mt-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">
              {message}
            </div>
          )}

          {/* Tabs */}
          <div className="mt-8 overflow-x-auto border-b border-warm-200">
            <div className="flex gap-6 whitespace-nowrap">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`border-b-2 pb-3 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "border-primary-600 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* === PROFILE TAB === */}
      <div className={standalone ? "" : "mt-8"}>
        {activeTab === "profile" && (
          <>
          <form onSubmit={saveProfile} onChange={() => { setSaved(false); setIsDirty(true); }} className="max-w-2xl space-y-6 pb-20">
            {/* Avatar */}
            <AvatarUpload initialUrl={profile.avatar_url} fallbackChar={profile.name.charAt(0)} onMessage={showMessage} />

            {/* Cover Image */}
            <CoverUpload initialUrl={profile.cover_url} initialPositionY={profile.cover_position_y ?? 50} onMessage={showMessage} />

            {/* Real Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("firstName")}</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("lastName")}</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
              </div>
            </div>

            {/* Phone */}
            <div className="max-w-sm">
              <label className="block text-sm font-medium text-gray-700">{t("phone")}</label>
              <div className="mt-1 flex gap-2">
                <select value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-primary-500 w-32">
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+7">🇷🇺 +7</option>
                  <option value="+27">🇿🇦 +27</option>
                  <option value="+30">🇬🇷 +30</option>
                  <option value="+31">🇳🇱 +31</option>
                  <option value="+32">🇧🇪 +32</option>
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+34">🇪🇸 +34</option>
                  <option value="+39">🇮🇹 +39</option>
                  <option value="+41">🇨🇭 +41</option>
                  <option value="+43">🇦🇹 +43</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+45">🇩🇰 +45</option>
                  <option value="+46">🇸🇪 +46</option>
                  <option value="+47">🇳🇴 +47</option>
                  <option value="+48">🇵🇱 +48</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+52">🇲🇽 +52</option>
                  <option value="+55">🇧🇷 +55</option>
                  <option value="+60">🇲🇾 +60</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+65">🇸🇬 +65</option>
                  <option value="+66">🇹🇭 +66</option>
                  <option value="+81">🇯🇵 +81</option>
                  <option value="+82">🇰🇷 +82</option>
                  <option value="+86">🇨🇳 +86</option>
                  <option value="+90">🇹🇷 +90</option>
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+351">🇵🇹 +351</option>
                  <option value="+353">🇮🇪 +353</option>
                  <option value="+380">🇺🇦 +380</option>
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+972">🇮🇱 +972</option>
                </select>
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder=""
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500" />
              </div>
              <p className="mt-1 text-xs text-gray-400">{t("phoneHint")}</p>
            </div>

            {/* Display name removed — using first+last name from account */}
            {/* Custom URL — Premium only */}
            {profile.plan === "premium" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("profileUrl")}
                  <span className="ml-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">{t("premiumBadge")}</span>
                </label>
                <div className="mt-1 flex items-center rounded-xl border border-gray-300 overflow-hidden focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200">
                  <span className="shrink-0 bg-warm-50 px-3 py-3 text-sm text-gray-400 border-r border-gray-300">photoportugal.com/photographers/</span>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder={t("customUrlPlaceholder")}
                    className="flex-1 px-3 py-3 text-sm outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">{t("customUrlHint")}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-warm-300 bg-warm-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">
                      {t("yourProfileUrl")} <span className="font-mono text-gray-700">photoportugal.com/photographers/{profile.slug}</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {t("customUrlUpgrade", { plan: "Premium" })}
                    </p>
                  </div>
                  <a href="/dashboard/subscriptions" className="shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-bold text-white transition hover:shadow-md">
                    {td("upgrade")}
                  </a>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("tagline")}
                <span className="ml-1.5 text-xs font-normal text-amber-600">{t("taglineHintEnglish")}</span>
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={200}
                placeholder={t("taglinePlaceholder")}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("bio")}
                <span className="ml-1.5 text-xs font-normal text-amber-600">{t("bioHintEnglish")}</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={12}
                placeholder={t("bioPlaceholder")}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("languages")} <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleItem(selectedLanguages, lang, setSelectedLanguages)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedLanguages.includes(lang)
                        ? "bg-primary-600 text-white"
                        : "bg-warm-100 text-gray-600 hover:bg-warm-200"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Shoot Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("shootTypes")}</label>
              <div className="flex flex-wrap gap-2">
                {SHOOT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleItem(selectedShootTypes, type, setSelectedShootTypes)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedShootTypes.includes(type)
                        ? "bg-primary-600 text-white"
                        : "bg-warm-100 text-gray-600 hover:bg-warm-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Locations */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("locationsCover")}</label>
              {(() => {
                const maxLocations = profile.plan === "premium" ? Infinity : profile.plan === "pro" ? 5 : 1;
                const atLimit = selectedLocations.length >= maxLocations;
                return (
                  <>
                    <p className="text-xs text-gray-400 mb-2">
                      {maxLocations === Infinity ? t("locationsUnlimited", { count: selectedLocations.length }) : t("locationsSelected", { count: selectedLocations.length, max: maxLocations })}
                      {maxLocations !== Infinity && atLimit && t("limitReached")}
                      {maxLocations !== Infinity && <> &middot; <a href="/dashboard/subscriptions" className="text-primary-600 hover:underline">{t("upgradeForMore")}</a></>}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {allLocations.map((loc) => {
                        const isSelected = selectedLocations.includes(loc.slug);
                        const isDisabled = !isSelected && atLimit;
                        return (
                          <label
                            key={loc.slug}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                              isSelected ? "bg-primary-50 text-primary-700" : isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-warm-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => { if (!isDisabled) toggleItem(selectedLocations, loc.slug, setSelectedLocations); }}
                              disabled={isDisabled}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            {loc.name}
                          </label>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("yearsOfExperience")}</label>
                <input
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  min="0"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
            </div>

          </form>

          {/* Fixed save bar — full width */}
          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-warm-200 bg-white/95 backdrop-blur-sm">
            <div className="flex items-center justify-center px-6 py-3">
              <button
                type="button"
                onClick={() => {
                  const form = document.querySelector<HTMLFormElement>("form");
                  if (form) form.requestSubmit();
                }}
                disabled={saving}
                className={`rounded-xl px-8 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
                  saved ? "bg-green-600 hover:bg-green-700" : isDirty ? "bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-600/25" : "bg-gray-400"
                }`}
              >
                {saving ? t("saving") : saved ? (<span className="inline-flex items-center gap-1.5">✓ {t("saved")}</span>) : t("saveProfile")}
              </button>
            </div>
          </div>
          </>
        )}

        {/* === PORTFOLIO TAB === */}
        {activeTab === "portfolio" && (
          <div>
            {/* Drag & Drop Upload Zone */}
            <div
              ref={dropZoneRef}
              onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
              onDragLeave={() => setDraggingOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploadingPortfolio && fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                draggingOver
                  ? "border-primary-500 bg-primary-50"
                  : "border-warm-300 bg-warm-50 hover:border-primary-400 hover:bg-primary-50/50"
              }`}
            >
              <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple onChange={handleFileInput} className="hidden" disabled={uploadingPortfolio} />
              {uploadProgress ? (
                <div className="py-2">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                    {t("uploadedOf", { done: uploadProgress.done, total: uploadProgress.total })}
                    {uploadProgress.failed > 0 && <span className="text-red-500">{t("failedCount", { count: uploadProgress.failed })}</span>}
                  </div>
                  <div className="mx-auto mt-3 h-2 w-64 max-w-full overflow-hidden rounded-full bg-warm-200">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <svg className="mx-auto h-8 w-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-gray-700">
                    {draggingOver ? t("dropPhotosHere") : t("dragPhotosOrClick")}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">{t("photoFormats")}</p>
                </>
              )}
            </div>

            {/* Header bar */}
            {localItems.length > 0 && (
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-sm text-gray-500">
                  {localItems.filter((p) => !p._uploading).length !== 1 ? t("photoCountPlural", { count: localItems.filter((p) => !p._uploading).length }) : t("photoCount", { count: localItems.filter((p) => !p._uploading).length })}{!selectMode && t("dragToReorder")}
                  {selectMode && selectedIds.size > 0 && t("selectedCount", { count: selectedIds.size })}
                </p>
                <div className="flex items-center gap-2">
                  {selectMode ? (
                    <>
                      <button
                        onClick={() => setSelectedIds(new Set(filteredPortfolio.filter((p) => !p._uploading).map((p) => p.id)))}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        {t("selectAll")}
                      </button>
                      <button
                        onClick={deleteSelected}
                        disabled={selectedIds.size === 0}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40"
                      >
                        {t("deleteCount", { count: selectedIds.size })}
                      </button>
                      <button
                        onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        {t("cancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectMode(true)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      {t("select")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Filters — only show if there are tagged photos */}
            {(usedLocations.length > 0 || usedShootTypes.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setPortfolioFilter({ location: "", shootType: "" })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    !portfolioFilter.location && !portfolioFilter.shootType
                      ? "bg-primary-600 text-white" : "bg-warm-100 text-gray-500 hover:bg-warm-200"
                  }`}
                >
                  {t("allPhotos", { count: localItems.length })}
                </button>
                {usedLocations.map((slug) => (
                  <button
                    key={slug}
                    onClick={() => setPortfolioFilter((f) => ({ ...f, location: f.location === slug ? "" : slug }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      portfolioFilter.location === slug
                        ? "bg-primary-600 text-white" : "bg-warm-100 text-gray-600 hover:bg-warm-200"
                    }`}
                  >
                    {allLocations.find((l) => l.slug === slug)?.name || slug}
                  </button>
                ))}
                {usedShootTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setPortfolioFilter((f) => ({ ...f, shootType: f.shootType === type ? "" : type }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      portfolioFilter.shootType === type
                        ? "bg-accent-600 text-white" : "bg-warm-100 text-gray-600 hover:bg-warm-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}

            {/* Photo grid with drag & drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={filteredPortfolio.map((p) => p.id)} strategy={rectSortingStrategy}>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredPortfolio.map((item) => (
                    <SortablePhotoCard
                      key={item.id}
                      item={item}
                      allLocations={allLocations}
                      onDelete={deletePhoto}
                      onUpdateTag={updatePhotoTag}
                      selectMode={selectMode}
                      selected={selectedIds.has(item.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                  {localItems.length === 0 && (
                    <div className="col-span-full flex flex-col items-center py-12 text-center">
                      <svg className="h-12 w-12 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <h3 className="mt-4 font-semibold text-gray-900">{t("noPortfolioPhotos")}</h3>
                      <p className="mt-1 text-sm text-gray-500">{t("uploadBestWork")}</p>
                    </div>
                  )}
                  {localItems.length > 0 && filteredPortfolio.length === 0 && (
                    <div className="col-span-full py-8 text-center">
                      <p className="text-gray-400">{t("noPhotosMatchFilter")}</p>
                    </div>
                  )}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDragItem && (
                  <div className="rounded-xl border-2 border-primary-400 bg-white shadow-2xl ring-4 ring-primary-200/50" style={{ width: 200 }}>
                    <div className="aspect-square overflow-hidden rounded-t-xl bg-warm-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={activeDragItem.thumbnail_url ? `/api/img/${activeDragItem.thumbnail_url.replace("/uploads/", "")}?w=200&q=60&f=webp` : `/api/img/${activeDragItem.url.replace("/uploads/", "")}?w=200&q=60&f=webp`} alt={activeDragItem.caption || "Portfolio photo being dragged"} className="h-full w-full object-cover" />
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {/* === PACKAGES TAB === */}
        {activeTab === "packages" && (
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {t("createPackagesPrompt")}
              </p>
              <button
                onClick={openNewPackage}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                {t("addPackage")}
              </button>
            </div>

            {/* Package form — for new packages only (edit form renders inline below) */}
            {showPackageForm && !editingPackage && (
              <PackageFormInline
                title={t("newPackage")}
                pkgName={pkgName} setPkgName={setPkgName}
                pkgDesc={pkgDesc} setPkgDesc={setPkgDesc}
                pkgDuration={pkgDuration} setPkgDuration={setPkgDuration}
                pkgPhotos={pkgPhotos} setPkgPhotos={setPkgPhotos}
                pkgPrice={pkgPrice} setPkgPrice={setPkgPrice}
                pkgDeliveryDays={pkgDeliveryDays} setPkgDeliveryDays={setPkgDeliveryDays}
                pkgPopular={pkgPopular} setPkgPopular={setPkgPopular}
                pkgPublic={pkgPublic} setPkgPublic={setPkgPublic}
                pkgFeatures={pkgFeatures} setPkgFeatures={setPkgFeatures}
                saving={saving}
                isEdit={false}
                onSubmit={savePackage}
                onCancel={() => setShowPackageForm(false)}
                t={t}
                className="mt-6"
              />
            )}

            {/* Packages list with DnD */}
            {localPackages.length > 1 && (
              <p className="mt-4 text-xs text-gray-400">{t("dragToReorderPackages")}</p>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handlePkgDragStart}
              onDragEnd={handlePkgDragEnd}
            >
              <SortableContext items={localPackages.map((p) => p.id)} strategy={rectSortingStrategy}>
                <div className="mt-3 space-y-3">
                  {localPackages.map((pkg) => (
                    editingPackage?.id === pkg.id && showPackageForm ? (
                      <PackageFormInline
                        key={pkg.id}
                        title={t("editPackage")}
                        pkgName={pkgName} setPkgName={setPkgName}
                        pkgDesc={pkgDesc} setPkgDesc={setPkgDesc}
                        pkgDuration={pkgDuration} setPkgDuration={setPkgDuration}
                        pkgPhotos={pkgPhotos} setPkgPhotos={setPkgPhotos}
                        pkgPrice={pkgPrice} setPkgPrice={setPkgPrice}
                        pkgDeliveryDays={pkgDeliveryDays} setPkgDeliveryDays={setPkgDeliveryDays}
                        pkgPopular={pkgPopular} setPkgPopular={setPkgPopular}
                        pkgPublic={pkgPublic} setPkgPublic={setPkgPublic}
                        pkgFeatures={pkgFeatures} setPkgFeatures={setPkgFeatures}
                        saving={saving}
                        isEdit={true}
                        onSubmit={savePackage}
                        onCancel={() => setShowPackageForm(false)}
                        t={t}
                      />
                    ) : (
                      <SortablePackageCard
                        key={pkg.id}
                        pkg={pkg}
                        onEdit={openEditPackage}
                        onDelete={deletePackage}
                      />
                    )
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activePkgDragItem && (
                  <div className="rounded-xl border-2 border-primary-400 bg-white p-4 shadow-2xl ring-4 ring-primary-200/50">
                    <span className="font-bold">{activePkgDragItem.name}</span>
                    <span className="ml-2 text-gray-500">&euro;{activePkgDragItem.price}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
            {localPackages.length === 0 && !showPackageForm && (
              <div className="mt-6 rounded-xl border-2 border-dashed border-warm-300 p-12 text-center">
                <p className="text-gray-400">{t("noPackagesYet")}</p>
              </div>
            )}
          </div>
        )}

        {/* === BOOKINGS TAB === */}
        {activeTab === "bookings" && (
          <div>
            {bookings.length > 0 ? (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} onUpdate={() => router.refresh()} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-warm-300 p-12 text-center">
                <p className="text-gray-400">{t("noBookingsYet")}</p>
              </div>
            )}
          </div>
        )}

      </div>
      {modal}
    </div>
  );
}

function PackageFormInline({
  title, pkgName, setPkgName, pkgDesc, setPkgDesc, pkgDuration, setPkgDuration,
  pkgPhotos, setPkgPhotos, pkgPrice, setPkgPrice, pkgDeliveryDays, setPkgDeliveryDays,
  pkgPopular, setPkgPopular, pkgPublic, setPkgPublic,
  pkgFeatures, setPkgFeatures,
  saving, isEdit, onSubmit, onCancel, t, className = "",
}: {
  title: string;
  pkgName: string; setPkgName: (v: string) => void;
  pkgDesc: string; setPkgDesc: (v: string) => void;
  pkgDuration: string; setPkgDuration: (v: string) => void;
  pkgPhotos: string; setPkgPhotos: (v: string) => void;
  pkgPrice: string; setPkgPrice: (v: string) => void;
  pkgDeliveryDays: string; setPkgDeliveryDays: (v: string) => void;
  pkgPopular: boolean; setPkgPopular: (v: boolean) => void;
  pkgPublic: boolean; setPkgPublic: (v: boolean) => void;
  pkgFeatures: string[]; setPkgFeatures: (v: string[]) => void;
  saving: boolean; isEdit: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any; className?: string;
}) {
  return (
    <form onSubmit={onSubmit} className={`rounded-xl border border-primary-200 bg-white p-6 space-y-4 ring-2 ring-primary-100 ${className}`}>
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("packageName")}
            <span className="ml-1.5 text-xs font-normal text-amber-600">{t("packageNameHintEnglish")}</span>
          </label>
          <input type="text" value={pkgName} onChange={(e) => setPkgName(e.target.value)} required
            placeholder={t("packageNamePlaceholder")}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("description")}
            <span className="ml-1.5 text-xs font-normal text-amber-600">{t("descriptionHintEnglish")}</span>
          </label>
          <textarea value={pkgDesc} onChange={(e) => setPkgDesc(e.target.value.slice(0, 500))} rows={4}
            placeholder={t("descriptionPlaceholder")}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
          <p className="mt-1 text-xs text-gray-400">{pkgDesc.length}/500</p>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What&apos;s included
            <span className="ml-1.5 text-xs font-normal text-amber-600">{t("packageNameHintEnglish")}</span>
          </label>
          <div className="space-y-2">
            {pkgFeatures.map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-primary-400 text-sm">&#x2713;</span>
                <input
                  type="text"
                  value={feature}
                  onChange={(e) => {
                    const updated = [...pkgFeatures];
                    updated[i] = e.target.value;
                    setPkgFeatures(updated);
                  }}
                  placeholder="e.g. 30 professionally edited photos"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200"
                />
                <button type="button" onClick={() => setPkgFeatures(pkgFeatures.filter((_, j) => j !== i))}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-400 transition">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPkgFeatures([...pkgFeatures, ""])}
            className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add feature
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("duration")}</label>
          <select value={pkgDuration} onChange={(e) => setPkgDuration(e.target.value)} required
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 bg-white">
            <option value="">{t("selectDuration")}</option>
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.minutes} value={opt.minutes}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("numberOfPhotos")}</label>
          <input type="number" value={pkgPhotos} onChange={(e) => setPkgPhotos(e.target.value)} required min="1"
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("priceEur")}</label>
          <input type="number" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} required
            min={pkgDuration ? (getPricingForDuration(parseInt(pkgDuration))?.minPrice || 1) : 1} step="1"
            placeholder={t("pricePlaceholder")}
            className={`mt-1 block w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 ${
              pkgPrice && pkgDuration && getPricingForDuration(parseInt(pkgDuration)) && parseFloat(pkgPrice) < getPricingForDuration(parseInt(pkgDuration))!.minPrice
                ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                : "border-gray-300 focus:border-primary-500 focus:ring-primary-200"
            }`} />
          {pkgDuration && getPricingForDuration(parseInt(pkgDuration)) && (
            <div className="mt-2 flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <span className="text-amber-600 text-sm font-medium">Min &euro;{getPricingForDuration(parseInt(pkgDuration))!.minPrice}</span>
              <span className="text-gray-300">|</span>
              <span className="text-emerald-600 text-sm font-medium">Recommended &euro;{getPricingForDuration(parseInt(pkgDuration))!.recommendedPrice}</span>
            </div>
          )}
          {pkgPrice && pkgDuration && getPricingForDuration(parseInt(pkgDuration)) && parseFloat(pkgPrice) < getPricingForDuration(parseInt(pkgDuration))!.minPrice && (
            <p className="mt-1 text-xs text-red-500 font-medium">
              Price cannot be below the minimum of &euro;{getPricingForDuration(parseInt(pkgDuration))!.minPrice} for this duration
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">{t("priceHint")}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("deliveryTimeDays")}</label>
          <input type="number" value={pkgDeliveryDays} onChange={(e) => setPkgDeliveryDays(e.target.value)} min="1" max="90"
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
          <p className="mt-1 text-xs text-gray-400">{t("deliveryTimeHint")}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-warm-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">{t("markAsMostPopular")}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("highlightedOnProfile")}</p>
          </div>
          <button type="button" role="switch" aria-checked={pkgPopular} onClick={() => setPkgPopular(!pkgPopular)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${pkgPopular ? "bg-primary-600" : "bg-gray-200"}`}>
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${pkgPopular ? "translate-x-[22px]" : "translate-x-[2px]"} mt-[2px]`} />
          </button>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-warm-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">{t("showOnProfile")}</p>
            <p className="text-xs text-gray-400 mt-0.5">{pkgPublic ? t("visibleToEveryone") : t("privateOnlyViaLink")}</p>
          </div>
          <button type="button" role="switch" aria-checked={pkgPublic} onClick={() => setPkgPublic(!pkgPublic)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${pkgPublic ? "bg-primary-600" : "bg-gray-200"}`}>
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${pkgPublic ? "translate-x-[22px]" : "translate-x-[2px]"} mt-[2px]`} />
          </button>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
          {saving ? t("saving") : isEdit ? t("updatePackage") : t("createPackage")}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

function SortablePackageCard({
  pkg,
  onEdit,
  onDelete,
}: {
  pkg: Package;
  onEdit: (pkg: Package) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("photographerDashboard");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pkg.id });
  const pricing = getPricingForDuration(pkg.duration_minutes);
  const belowMin = pricing ? Number(pkg.price) < pricing.minPrice : false;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`group rounded-xl border bg-white p-4 ${belowMin ? "border-red-300 bg-red-50/30" : "border-warm-200"}`}>
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        <div
          className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-300 transition hover:bg-warm-100 hover:text-gray-500 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 truncate">{pkg.name}</h3>
            {pkg.is_popular && (
              <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-600">{t("popular")}</span>
            )}
            {!pkg.is_public && (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{t("privateBadge")}</span>
            )}
            {belowMin && (
              <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                Below minimum (€{pricing!.minPrice})
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-400">
            {formatDuration(pkg.duration_minutes)} &middot; {pkg.num_photos} {t("photosDot")} &middot; {t("dayDelivery", { days: pkg.delivery_days || 7 })}
          </p>
        </div>

        {/* Price + actions */}
        <div className="flex shrink-0 items-center gap-3">
          <p className={`text-lg font-bold ${belowMin ? "text-red-600" : "text-gray-900"}`}>&euro;{Math.round(Number(pkg.price))}</p>
          <button onClick={() => onEdit(pkg)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-warm-100 hover:text-primary-600" title={t("editTooltip")}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={() => onDelete(pkg.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500" title={t("deleteTooltip")}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function SortablePhotoCard({
  item,
  allLocations,
  onDelete,
  onUpdateTag,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: {
  item: PortfolioItem;
  allLocations: LocationOption[];
  onDelete: (id: string) => void;
  onUpdateTag: (id: string, field: "location_slug" | "shoot_type", value: string) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const t = useTranslations("photographerDashboard");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: selectMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`group overflow-hidden rounded-xl border bg-white ${selected ? "border-primary-500 ring-2 ring-primary-300" : "border-warm-200"}`}>
      {/* Image — drag handle or select */}
      <div
        className={`relative aspect-square bg-warm-100 ${selectMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
        {...(selectMode ? { onClick: () => onToggleSelect?.(item.id) } : { ...attributes, ...listeners })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item._preview || item._uploading ? (item._preview || item.url) : (item.thumbnail_url ? `/api/img/${item.thumbnail_url.replace("/uploads/", "")}?w=400&q=75&f=webp` : `/api/img/${item.url.replace("/uploads/", "")}?w=400&q=75&f=webp`)}
          alt={item.caption || ""}
          loading="lazy"
          className="h-full w-full object-cover pointer-events-none select-none"
        />
        {item._uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
        {selectMode ? (
          <div className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 ${selected ? "border-primary-500 bg-primary-500" : "border-white bg-white/70"}`}>
            {selected && (
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>
      {/* Tags — not draggable */}
      <div className="flex flex-col gap-1.5 p-2.5">
        <select
          value={item.location_slug || ""}
          onChange={(e) => onUpdateTag(item.id, "location_slug", e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full rounded border border-warm-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-primary-400"
        >
          <option value="">{t("locationTag")}</option>
          {allLocations.map((l) => (
            <option key={l.slug} value={l.slug}>{l.name}</option>
          ))}
        </select>
        <select
          value={item.shoot_type || ""}
          onChange={(e) => onUpdateTag(item.id, "shoot_type", e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full rounded border border-warm-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-primary-400"
        >
          <option value="">{t("shootTypeTag")}</option>
          {SHOOT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  delivered: "bg-accent-100 text-accent-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const TIME_LABEL_KEYS: Record<string, string> = {
  sunrise: "timeSunrise",
  morning: "timeMorning",
  midday: "timeMidday",
  afternoon: "timeAfternoon",
  golden_hour: "timeGoldenHour",
  sunset: "timeSunset",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: "statusPending",
  confirmed: "statusConfirmed",
  completed: "statusCompleted",
  delivered: "statusDelivered",
  cancelled: "statusCancelled",
};

function BookingCard({ booking, onUpdate }: { booking: Booking; onUpdate: () => void }) {
  const t = useTranslations("photographerDashboard");
  const locale = useLocale();
  const dateLocale = locale === "pt" ? "pt-PT" : "en-US";
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status: string) {
    setUpdating(true);
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdating(false);
    if (res.ok) onUpdate();
  }

  return (
    <div className="rounded-xl border border-warm-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar src={booking.client_avatar} fallback={booking.client_name} size="md" />
          <div>
            <p className="font-semibold text-gray-900">{booking.client_name}</p>
            <p className="text-sm text-gray-500">{booking.client_email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[booking.status] || STATUS_COLORS.pending}`}>
            {STATUS_LABEL_KEYS[booking.status] ? t(STATUS_LABEL_KEYS[booking.status]) : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </span>
          {booking.payment_status === "paid" && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">{t("paid")}</span>
          )}
          {booking.status !== "cancelled" && booking.total_price && booking.payment_status !== "paid" && booking.status !== "pending" && (
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">{t("unpaid")}</span>
          )}
          {booking.delivery_accepted && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{t("accepted")}</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
        {booking.package_name && <span>{booking.package_name}</span>}
        {booking.shoot_date && (
          <span>{new Date(booking.shoot_date).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })}</span>
        )}
        {booking.shoot_time && <span>{TIME_LABEL_KEYS[booking.shoot_time] ? t(TIME_LABEL_KEYS[booking.shoot_time]) : booking.shoot_time}</span>}
        {booking.total_price && <span>&euro;{Math.round(Number(booking.total_price))}</span>}
      </div>

      {booking.message && (
        <p className="mt-3 text-sm text-gray-600 italic">&ldquo;{booking.message}&rdquo;</p>
      )}

      <div className="mt-4 flex gap-3">
        {booking.status === "pending" && (
          <>
            <button
              onClick={() => updateStatus("confirmed")}
              disabled={updating}
              className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
            >
              {t("confirm")}
            </button>
            <button
              onClick={() => updateStatus("cancelled")}
              disabled={updating}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("decline")}
            </button>
          </>
        )}

        {booking.status === "confirmed" && (
          <button
            onClick={() => updateStatus("completed")}
            disabled={updating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t("markAsCompleted")}
          </button>
        )}
        <a
          href={`/dashboard/messages?chat=${booking.id}`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          {t("message")}
        </a>
      </div>
    </div>
  );
}

function getCroppedBlob(imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error("Canvas is empty")); }, "image/jpeg", 0.92);
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

function AvatarUpload({ initialUrl, fallbackChar, onMessage }: { initialUrl: string | null; fallbackChar: string; onMessage: (msg: string) => void }) {
  const t = useTranslations("photographerDashboard");
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);

  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => { setPreviewUrl(initialUrl); }, [initialUrl]);

  const onCropComplete = useCallback((_: unknown, pixels: { x: number; y: number; width: number; height: number }) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { onMessage(t("fileTooLarge", { size: 10 })); e.target.value = ""; return; }
    if (!file.type.startsWith("image/") && !file.name.match(/\.(heic|heif)$/i)) { onMessage(t("onlyImagesAllowed")); e.target.value = ""; return; }
    let processed: File | Blob = file;
    try { processed = await convertHeicIfNeeded(file); } catch { /* use original */ }
    setCropSrc(URL.createObjectURL(processed));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    e.target.value = "";
  }

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels) return;
    setUploading(true);
    onMessage(t("uploadingPhoto"));
    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
      setPreviewUrl(URL.createObjectURL(blob));
      setCropSrc(null);
      const formData = new FormData();
      formData.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/dashboard/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);
        onMessage(t("photoUpdated"));
      } else {
        const err = await res.json().catch(() => null);
        setPreviewUrl(initialUrl);
        onMessage(err?.error || t("uploadFailed"));
      }
    } catch {
      setPreviewUrl(initialUrl);
      onMessage(t("uploadFailedConnection"));
    }
    setUploading(false);
  }

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t("profilePhoto")}</label>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600 overflow-hidden">
            {previewUrl ? <img src={previewUrl} alt="Profile photo preview" className="h-full w-full object-cover" /> : fallbackChar}
          </div>
          <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            {uploading ? t("uploading") : t("uploadPhoto")}
            <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleFileSelect} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Crop Modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCropSrc(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-warm-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">{t("adjustYourPhoto")}</h3>
              <p className="text-xs text-gray-400 mt-1">{t("adjustPhotoHint")}</p>
            </div>
            <div className="relative h-72 sm:h-80 bg-gray-900">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="px-6 py-3 border-t border-warm-100 bg-warm-50">
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-primary-600"
                />
                <svg className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" /></svg>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-warm-200 px-6 py-4">
              <button type="button" onClick={() => setCropSrc(null)} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                {t("cancel")}
              </button>
              <button type="button" onClick={handleCropConfirm} disabled={uploading} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
                {uploading ? t("uploading") : t("savePhoto")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CoverUpload({ initialUrl, initialPositionY, onMessage }: { initialUrl: string | null; initialPositionY: number; onMessage: (msg: string) => void }) {
  const t = useTranslations("photographerDashboard");
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [positionY, setPositionY] = useState(initialPositionY);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartPos = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setPreviewUrl(initialUrl); }, [initialUrl]);
  useEffect(() => { setPositionY(initialPositionY); }, [initialPositionY]);

  function savePosition(y: number) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/dashboard/cover-position", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cover_position_y: y }),
        });
        if (res.ok) onMessage(t("coverPositionSaved"));
        else onMessage(t("failedToSavePosition"));
      } catch {
        onMessage(t("failedToSavePosition"));
      }
    }, 600);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!previewUrl) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartPos.current = positionY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging || !containerRef.current) return;
    const containerHeight = containerRef.current.offsetHeight;
    const deltaPct = ((dragStartY.current - e.clientY) / containerHeight) * 50;
    setPositionY(Math.round(Math.min(100, Math.max(0, dragStartPos.current + deltaPct))));
  }

  function handlePointerUp() {
    if (isDragging) {
      setIsDragging(false);
      savePosition(positionY);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { onMessage(t("fileTooLarge", { size: 10 })); e.target.value = ""; return; }
    if (!file.type.startsWith("image/") && !file.name.match(/\.(heic|heif)$/i)) { onMessage(t("onlyImagesAllowed")); e.target.value = ""; return; }

    let processed = file;
    try { processed = await convertHeicIfNeeded(file); } catch { /* use original */ }

    setPreviewUrl(URL.createObjectURL(processed));
    setPositionY(50);
    const formData = new FormData();
    formData.append("file", processed);
    formData.append("type", "cover");
    setUploading(true);
    onMessage(t("uploadingCover"));

    try {
      const res = await fetch("/api/dashboard/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);
        onMessage(t("coverUploaded"));
      } else {
        const err = await res.json().catch(() => null);
        setPreviewUrl(initialUrl);
        setPositionY(initialPositionY);
        onMessage(err?.error || t("uploadFailed"));
      }
    } catch {
      setPreviewUrl(initialUrl);
      setPositionY(initialPositionY);
      onMessage(t("uploadFailedConnection"));
    }
    setUploading(false);
    e.target.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{t("coverImage")}</label>
      <p className="text-xs text-gray-400 mb-2">
        {t("coverHintLandscape")}
      </p>

      {/* Preview frame — same aspect ratio as photographer card (2:1) */}
      <div className="mb-3">
        <p className="text-[10px] text-gray-400 mb-1">{t("coverPreviewLabel")}</p>
        <div
          ref={containerRef}
          className={`relative w-full max-w-md overflow-hidden rounded-xl bg-warm-100 touch-none ${previewUrl ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
          style={{ aspectRatio: "2 / 1" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {previewUrl ? (
            <OptimizedImage
              src={previewUrl}
              alt="Cover"
              width={800}
              className="h-full w-full pointer-events-none select-none"
              style={{ objectPosition: `center ${positionY}%` }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-300 to-primary-600 text-sm text-white/60">
              {t("noCover")}
            </div>
          )}
          {previewUrl && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[10px] text-white/80 backdrop-blur-sm">
              {t("dragToReposition")}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 text-center">
          {uploading ? t("uploading") : t("uploadCover")}
          <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
