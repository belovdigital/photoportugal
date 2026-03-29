export interface User {
  id: string;
  email: string;
  name: string;
  role: "client" | "photographer" | "admin";
  avatar_url: string | null;
  created_at: string;
}

export const SHOOT_TYPES = [
  "Couples",
  "Family",
  "Solo Portrait",
  "Engagement",
  "Proposal",
  "Honeymoon",
  "Wedding",
  "Maternity",
  "Friends Trip",
  "Anniversary",
  "Elopement",
  "Birthday",
  "Kids Birthday",
  "Studio Portrait",
  "Content Creator",
] as const;

export type ShootType = (typeof SHOOT_TYPES)[number];

export const LANGUAGES = [
  "English",
  "Portuguese",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Dutch",
  "Russian",
  "Ukrainian",
  "Polish",
  "Romanian",
  "Czech",
  "Greek",
  "Hungarian",
  "Bulgarian",
  "Croatian",
  "Serbian",
  "Arabic",
  "Hebrew",
  "Persian",
  "Turkish",
  "Hindi",
  "Bengali",
  "Thai",
  "Vietnamese",
  "Indonesian",
  "Malay",
  "Korean",
  "Chinese",
  "Japanese",
  "Swedish",
  "Danish",
  "Norwegian",
  "Finnish",
] as const;

export interface PhotographerProfile {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  tagline: string;
  bio: string;
  avatar_url: string | null;
  cover_url: string | null;
  cover_position_y: number;
  languages: string[];
  hourly_rate: number;
  currency: string;
  locations: Location[];
  packages: Package[];
  shoot_types: string[];
  experience_years: number;
  is_verified: boolean;
  is_featured: boolean;
  is_founding: boolean;
  plan: "free" | "pro" | "premium";
  rating: number;
  review_count: number;
  session_count: number;
  created_at: string;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  num_photos: number;
  price: number;
  is_popular: boolean;
}

export interface PortfolioItem {
  id: string;
  photographer_id: string;
  type: "photo" | "video";
  url: string;
  thumbnail_url: string;
  caption: string | null;
  location_slug: string | null;
  sort_order: number;
}

export interface Location {
  id: string;
  slug: string;
  name: string;
  region: string;
  description: string;
  long_description: string;
  cover_image: string;
  gallery_images: string[];
  lat: number;
  lng: number;
  photographer_count: number;
  seo_title: string;
  seo_description: string;
  /** Portuguese (pt-PT) translations */
  description_pt?: string;
  long_description_pt?: string;
  seo_title_pt?: string;
  seo_description_pt?: string;
}

export interface Booking {
  id: string;
  client_id: string;
  photographer_id: string;
  location_slug: string | null;
  package_id: string | null;
  shoot_date: string | null;
  shoot_time: string | null;
  message: string | null;
  status: "inquiry" | "pending" | "confirmed" | "completed" | "delivered" | "cancelled" | "disputed";
  total_price: number | null;
  created_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  client_id: string;
  photographer_id: string;
  client_name: string;
  client_avatar: string | null;
  rating: number;
  title: string;
  text: string;
  photos: string[];
  photos_public: boolean;
  is_verified: boolean;
  created_at: string;
}
