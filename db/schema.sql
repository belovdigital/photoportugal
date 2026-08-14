-- db/schema.sql — generated from PT production on 2026-08-14.
-- DO NOT EDIT BY HAND. Refresh: scripts/refresh-schema.sh
-- Field semantics and the fields that lie: docs/DOMAIN.md
--
-- PostgreSQL database dump
--

\restrict doFWyfVd2JwUtAEOqgS4Nlobxr9HmY5Opb9eVODA1jbviwjolM5dPGcFRszWuYg

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'inquiry',
    'delivered',
    'disputed',
    'refunded',
    'unmatched'
);


--
-- Name: gift_card_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gift_card_tier AS ENUM (
    'express',
    'full'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'refunded',
    'failed',
    'partially_refunded'
);


--
-- Name: photographer_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.photographer_plan AS ENUM (
    'free',
    'pro',
    'premium'
);


--
-- Name: plan_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_type AS ENUM (
    'free',
    'pro',
    'premium'
);


--
-- Name: portfolio_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.portfolio_type AS ENUM (
    'photo',
    'video'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'client',
    'photographer',
    'admin'
);


--
-- Name: populate_message_conversation_keys(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.populate_message_conversation_keys() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.client_id IS NULL OR NEW.photographer_id IS NULL THEN
    IF NEW.booking_id IS NOT NULL THEN
      SELECT b.client_id, b.photographer_id
        INTO NEW.client_id, NEW.photographer_id
        FROM bookings b WHERE b.id = NEW.booking_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: snapshot_extra_photo_price(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.snapshot_extra_photo_price() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE payout INTEGER;
BEGIN
  IF NEW.extra_photo_payout_cents IS NULL AND NEW.photographer_id IS NOT NULL THEN
    SELECT extra_photo_payout_cents INTO payout
      FROM photographer_profiles WHERE id = NEW.photographer_id;
    IF payout IS NOT NULL THEN
      NEW.extra_photo_payout_cents := payout;
      -- +25%, rounded UP to the nearest 10 cents. Mirrors
      -- clientExtraPriceCents() in src/lib/extras-pricing.ts; if one changes,
      -- the other must.
      NEW.extra_photo_price_cents := CEIL(ROUND(payout * 1.25) / 10.0) * 10;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: touch_warnings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_warnings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ad_pageviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_pageviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text,
    path text NOT NULL,
    utm_source text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ad_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    landing_page text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    gclid text
);


--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    entity_name text,
    details text,
    admin_email text DEFAULT 'admin'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_generations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    session_id character varying(64) NOT NULL,
    ip inet,
    email character varying(255),
    scene_id character varying(50) NOT NULL,
    reference_image_key text,
    result_image_key text,
    cost_cents integer,
    user_agent text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now(),
    result_image_keys text[],
    result_scene_ids text[],
    user_id uuid
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(255) NOT NULL,
    title character varying(500) NOT NULL,
    excerpt text,
    content text NOT NULL,
    cover_image_url text,
    meta_title character varying(200),
    meta_description character varying(300),
    target_keywords text,
    author character varying(200) DEFAULT 'Photo Portugal'::character varying,
    is_published boolean DEFAULT false,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    scheduled_at timestamp with time zone,
    category character varying(50),
    locale character varying(5) DEFAULT 'en'::character varying,
    translation_group text
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    photographer_id uuid,
    package_id uuid,
    location_slug character varying(100),
    status public.booking_status DEFAULT 'pending'::public.booking_status,
    shoot_date date,
    shoot_time character varying(50),
    message text,
    total_price numeric(10,2),
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    group_size integer DEFAULT 1,
    occasion character varying(100),
    reminder_sent boolean DEFAULT false,
    review_requested boolean DEFAULT false,
    stripe_payment_intent_id character varying(255),
    service_fee numeric(10,2) DEFAULT 0,
    platform_fee numeric(10,2) DEFAULT 0,
    payout_amount numeric(10,2) DEFAULT 0,
    delivery_token character varying(64),
    delivery_password character varying(64),
    delivery_expires_at timestamp with time zone,
    payment_url text,
    delivery_accepted boolean DEFAULT false,
    delivery_accepted_at timestamp with time zone,
    payout_transferred boolean DEFAULT false,
    payment_reminder_sent boolean DEFAULT false,
    shoot_reminder_sent boolean DEFAULT false,
    delivery_reminder_sent boolean DEFAULT false,
    trustpilot_sent boolean DEFAULT false,
    proposed_date date,
    proposed_by character varying(20),
    date_note text,
    flexible_date_from date,
    flexible_date_to date,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    zip_path text,
    zip_size bigint,
    zip_ready boolean DEFAULT false,
    session_reminder_sent boolean DEFAULT false,
    delivery_review_reminder_sent boolean DEFAULT false,
    location_detail text,
    converted_to_booking_id uuid,
    proposed_time character varying(50),
    payment_final_reminder_sent boolean DEFAULT false,
    gclid character varying(255),
    confirmed_at timestamp with time zone,
    reminder_6h_sent boolean DEFAULT false,
    reminder_12h_sent boolean DEFAULT false,
    reminder_24h_sent boolean DEFAULT false,
    review_sms_sent boolean DEFAULT false,
    archived boolean DEFAULT false,
    client_followup_sent boolean DEFAULT false,
    client_followup_7d_sent boolean DEFAULT false,
    client_followup_14d_alerted boolean DEFAULT false,
    delivery_title character varying(200),
    delivery_message text,
    cancelled_at timestamp with time zone,
    cancelled_by character varying(20),
    cancelled_reason text,
    payment_critical_reminder_sent boolean DEFAULT false NOT NULL,
    review_chat_sent boolean DEFAULT false,
    delivery_expiry_warning_sent boolean DEFAULT false,
    stripe_amount_subtotal_cents integer,
    stripe_amount_paid_cents integer,
    stripe_amount_discount_cents integer,
    stripe_currency character varying(10),
    stripe_promo_code text,
    stripe_coupon_name text,
    stripe_coupon_percent_off numeric,
    group_size_is_estimate boolean DEFAULT false,
    delivery_password_plain character varying(200),
    is_gift boolean DEFAULT false,
    gift_recipient_name text,
    gift_recipient_email text,
    gift_recipient_phone text,
    gift_recipient_user_id uuid,
    gift_reveal_at timestamp with time zone,
    gift_reveal_sent_at timestamp with time zone,
    gift_card_id uuid,
    concierge_chat_id uuid,
    social_permission_email_sent_at timestamp with time zone,
    soft_followup_sent boolean DEFAULT false,
    assigned_by uuid,
    assigned_at timestamp with time zone,
    admin_notes text,
    blind_booking boolean DEFAULT false NOT NULL,
    auto_refund_at timestamp with time zone,
    blind_admin_nudge_12h_sent boolean DEFAULT false NOT NULL,
    blind_admin_nudge_6h_sent boolean DEFAULT false NOT NULL,
    blind_admin_nudge_1h_sent boolean DEFAULT false NOT NULL,
    client_sms_opt_in boolean DEFAULT false NOT NULL,
    peek_token text,
    peek_shared_at timestamp with time zone,
    visitor_id text,
    delivery_accept_reminder_5d_sent boolean DEFAULT false,
    delivery_accept_reminder_12d_sent boolean DEFAULT false,
    promised_photos integer,
    offer_nudge_sent boolean DEFAULT false,
    offer_nudge_admin_alerted boolean DEFAULT false,
    extras_gift_slots integer DEFAULT 0 NOT NULL,
    extra_photo_payout_cents integer,
    extra_photo_price_cents integer,
    social_consent boolean,
    social_consent_at timestamp with time zone,
    country character varying(2) DEFAULT 'pt'::character varying NOT NULL,
    invoicexpress_invoice_id text,
    invoicexpress_state text,
    invoicexpress_issued_at timestamp with time zone
);


--
-- Name: COLUMN bookings.stripe_amount_subtotal_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.stripe_amount_subtotal_cents IS 'Stripe Checkout subtotal before discounts, in minor currency units.';


--
-- Name: COLUMN bookings.stripe_amount_paid_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.stripe_amount_paid_cents IS 'Actual amount paid in Stripe Checkout after discounts/taxes, in minor currency units.';


--
-- Name: COLUMN bookings.stripe_amount_discount_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.stripe_amount_discount_cents IS 'Total Stripe Checkout discount amount, in minor currency units.';


--
-- Name: COLUMN bookings.stripe_promo_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.stripe_promo_code IS 'Customer-entered Stripe promotion code, when available.';


--
-- Name: COLUMN bookings.group_size_is_estimate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.group_size_is_estimate IS 'TRUE when the selected group size represents a lower-bound value such as 9+ rather than an exact count.';


--
-- Name: COLUMN bookings.delivery_accept_reminder_5d_sent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.delivery_accept_reminder_5d_sent IS 'Client accept-delivery nudge ~5 days after delivery (cron reminders §3d)';


--
-- Name: COLUMN bookings.delivery_accept_reminder_12d_sent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.delivery_accept_reminder_12d_sent IS 'Final client accept-delivery nudge ~12 days after delivery (cron reminders §3d)';


--
-- Name: COLUMN bookings.promised_photos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.promised_photos IS 'Photo count the assigned photographer committed to deliver (blind/no-package bookings); feeds the delivery guard';


--
-- Name: COLUMN bookings.extra_photo_payout_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.extra_photo_payout_cents IS 'Snapshot of the photographer rate at booking time. NULL = resolve from profile.';


--
-- Name: COLUMN bookings.extra_photo_price_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.extra_photo_price_cents IS 'Snapshot of the client price at booking time. NULL = derive from the payout.';


--
-- Name: bookings_pi_repair_20260805; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings_pi_repair_20260805 (
    id uuid,
    wrong_pi character varying(255),
    stripe_amount_paid_cents integer,
    captured_at timestamp with time zone
);


--
-- Name: business_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_inquiries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_name character varying(200) NOT NULL,
    contact_name character varying(200) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    event_type character varying(100),
    event_date date,
    location character varying(200),
    headcount character varying(50),
    message text,
    source character varying(50) DEFAULT 'business_page'::character varying NOT NULL,
    photographer_id uuid,
    status character varying(20) DEFAULT 'new'::character varying NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_busy_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_busy_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    source_uid text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_busy_slots_check CHECK ((ends_at > starts_at))
);


--
-- Name: calendar_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    type text NOT NULL,
    display_name text NOT NULL,
    google_email text,
    google_refresh_token text,
    google_access_token text,
    google_access_token_expires_at timestamp with time zone,
    selected_calendar_ids text[],
    ical_url text,
    is_active boolean DEFAULT true NOT NULL,
    last_synced_at timestamp with time zone,
    last_sync_error text,
    last_sync_event_count integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sync_error_since timestamp with time zone,
    sync_error_notified_at timestamp with time zone,
    CONSTRAINT calendar_connections_check CHECK ((((type = 'google'::text) AND (google_refresh_token IS NOT NULL) AND (ical_url IS NULL)) OR ((type = 'ical'::text) AND (ical_url IS NOT NULL) AND (google_refresh_token IS NULL)))),
    CONSTRAINT calendar_connections_type_check CHECK ((type = ANY (ARRAY['google'::text, 'ical'::text])))
);


--
-- Name: chat_chip_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_chip_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid,
    client_id uuid,
    booking_id uuid,
    last_message_id uuid,
    last_message_text text,
    chips_offered text[] NOT NULL,
    chip_chosen text,
    outcome text NOT NULL,
    intent_snapshot jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: concierge_chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_chats (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    visitor_id character varying(255),
    user_id uuid,
    email character varying(255),
    first_name character varying(100),
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    matched_photographer_ids uuid[],
    outcome character varying(50),
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    gclid text,
    country character varying(2),
    language character varying(10),
    total_tokens integer DEFAULT 0,
    total_cost_usd numeric(10,4) DEFAULT 0,
    inquiry_booking_ids uuid[],
    match_request_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source character varying(20),
    page_context text,
    archived boolean DEFAULT false,
    phone text,
    phone_captured_at timestamp with time zone,
    followups_sent jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_chip text,
    occasion character varying(50)
);


--
-- Name: COLUMN concierge_chats.phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.concierge_chats.phone IS 'Visitor phone for WhatsApp follow-up. Captured via the post-match CTA, not normalised.';


--
-- Name: COLUMN concierge_chats.phone_captured_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.concierge_chats.phone_captured_at IS 'When the phone was first saved. NULL until visitor opts in.';


--
-- Name: COLUMN concierge_chats.followups_sent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.concierge_chats.followups_sent IS 'Stage → ISO timestamp of which follow-up emails have already been sent. Set by /api/cron/concierge-followups.';


--
-- Name: COLUMN concierge_chats.source_chip; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.concierge_chats.source_chip IS 'Verbatim chip text the visitor clicked to start the chat (from ConciergeInvitePlaque). NULL when chat started via free-text input.';


--
-- Name: concierge_exclusion_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_exclusion_events (
    id bigint NOT NULL,
    chat_id uuid NOT NULL,
    photographer_id uuid NOT NULL,
    reason character varying(40) NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: concierge_exclusion_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.concierge_exclusion_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.concierge_exclusion_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: concierge_recommendation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_recommendation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id uuid NOT NULL,
    photographer_id uuid NOT NULL,
    rank smallint NOT NULL,
    strategy text NOT NULL,
    fit_score real,
    session_count_at_time integer,
    review_count_at_time integer,
    is_featured_at_time boolean,
    is_verified_at_time boolean,
    traffic_segment text,
    shown_at timestamp with time zone DEFAULT now() NOT NULL,
    clicked_profile_at timestamp with time zone,
    message_started_at timestamp with time zone,
    booking_created_at timestamp with time zone,
    paid_at timestamp with time zone
);


--
-- Name: delivery_extra_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_extra_purchases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    delivery_photo_id uuid NOT NULL,
    photo_filename text,
    client_id uuid,
    photographer_id uuid,
    amount_cents integer NOT NULL,
    platform_fee_cents integer NOT NULL,
    payout_cents integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    transferred boolean DEFAULT false NOT NULL,
    stripe_session_id text,
    stripe_payment_intent_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    CONSTRAINT delivery_extra_purchases_amount_split CHECK ((amount_cents = (platform_fee_cents + payout_cents)))
);


--
-- Name: delivery_extras_zip; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_extras_zip (
    booking_id uuid NOT NULL,
    zip_path text,
    zip_size bigint,
    ready boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: delivery_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_photos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    booking_id uuid NOT NULL,
    url text NOT NULL,
    filename character varying(255) NOT NULL,
    file_size integer DEFAULT 0,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    preview_url text,
    media_type character varying(10) DEFAULT 'image'::character varying NOT NULL,
    thumbnail_url text,
    duration_seconds integer,
    width integer,
    height integer,
    is_peek boolean DEFAULT false NOT NULL,
    is_included boolean DEFAULT true NOT NULL,
    purchased_at timestamp with time zone
);


--
-- Name: dismissed_photographer_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dismissed_photographer_tasks (
    photographer_id uuid NOT NULL,
    task_key text NOT NULL,
    state_snapshot text,
    dismissed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disputes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    booking_id uuid NOT NULL,
    client_id uuid NOT NULL,
    photographer_id uuid NOT NULL,
    reason character varying(50) NOT NULL,
    description text NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    resolution character varying(20),
    resolution_note text,
    refund_amount numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone
);


--
-- Name: error_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.error_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fingerprint text NOT NULL,
    path text,
    method text,
    status_code integer,
    error_class text,
    error_message text,
    error_stack text,
    user_id uuid,
    user_email text,
    user_role text,
    request_query text,
    request_body jsonb,
    user_agent text,
    ip text,
    referrer text,
    email_sent_at timestamp with time zone,
    email_count integer DEFAULT 0 NOT NULL,
    occurrence_count integer DEFAULT 1 NOT NULL,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    notes text
);


--
-- Name: gift_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    tier public.gift_card_tier NOT NULL,
    amount numeric(10,2) NOT NULL,
    photographer_payout numeric(10,2) NOT NULL,
    status text DEFAULT 'purchased'::text NOT NULL,
    buyer_user_id uuid,
    buyer_name text NOT NULL,
    buyer_email text NOT NULL,
    stripe_payment_intent_id text,
    stripe_checkout_session_id text,
    recipient_name text NOT NULL,
    recipient_email text NOT NULL,
    recipient_phone text,
    recipient_user_id uuid,
    personal_message text,
    booking_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    claimed_at timestamp with time zone,
    redeemed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    expiry_warning_30d_sent boolean DEFAULT false,
    expiry_warning_7d_sent boolean DEFAULT false,
    expiry_warning_1d_sent boolean DEFAULT false,
    CONSTRAINT gift_cards_status_check CHECK ((status = ANY (ARRAY['purchased'::text, 'sent'::text, 'claimed'::text, 'redeemed'::text, 'expired'::text, 'refunded'::text])))
);


--
-- Name: issued_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issued_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    photographer_id uuid,
    client_id uuid,
    amount_eur numeric(10,2) NOT NULL,
    document_date date NOT NULL,
    invoicexpress_invoice_id text,
    state text DEFAULT 'claiming'::text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    issued_at timestamp with time zone
);


--
-- Name: keyword_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.keyword_snapshots (
    id integer NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    top3 integer DEFAULT 0,
    top10 integer DEFAULT 0,
    top20 integer DEFAULT 0,
    top100 integer DEFAULT 0,
    total integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    queries jsonb
);


--
-- Name: keyword_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.keyword_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: keyword_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.keyword_snapshots_id_seq OWNED BY public.keyword_snapshots.id;


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    slug character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    region character varying(255) NOT NULL,
    description text,
    long_description text,
    cover_image text,
    lat numeric(9,6),
    lng numeric(9,6),
    seo_title character varying(255),
    seo_description text
);


--
-- Name: makealbum_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.makealbum_orders (
    id character varying(64) NOT NULL,
    makealbum_order_id character varying(128) NOT NULL,
    makealbum_album_id character varying(128) NOT NULL,
    title text,
    page_count integer,
    amount_cents integer NOT NULL,
    currency character varying(8) DEFAULT 'EUR'::character varying NOT NULL,
    customer_email character varying(255),
    customer_name character varying(255),
    success_url text NOT NULL,
    cancel_url text NOT NULL,
    webhook_url text NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    stripe_session_id character varying(128),
    stripe_payment_intent_id character varying(128),
    shipping_address jsonb,
    webhook_delivered_at timestamp with time zone,
    webhook_attempts integer DEFAULT 0 NOT NULL,
    webhook_last_error text,
    raw_request jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone
);


--
-- Name: managed_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.managed_locations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    slug character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    region character varying(255) NOT NULL,
    description text,
    long_description text,
    cover_image_url text,
    lat numeric(10,6),
    lng numeric(10,6),
    seo_title character varying(500),
    seo_description text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: manual_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    booking_id uuid,
    amount_cents integer NOT NULL,
    currency character varying(3) DEFAULT 'EUR'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reference text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: match_request_photographers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_request_photographers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_request_id uuid NOT NULL,
    photographer_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    price integer,
    num_photos integer
);


--
-- Name: match_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    location_slug character varying(100) NOT NULL,
    shoot_date date,
    flexible_date_from date,
    flexible_date_to date,
    date_flexible boolean DEFAULT false,
    shoot_type character varying(100),
    group_size integer DEFAULT 2,
    budget_range character varying(50),
    message text,
    status character varying(20) DEFAULT 'new'::character varying NOT NULL,
    admin_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    matched_at timestamp with time zone,
    shoot_time character varying(50),
    user_id uuid,
    chosen_photographer_id uuid,
    booking_id uuid,
    choice_reminder_sent boolean DEFAULT false,
    sms_consent boolean DEFAULT true,
    source character varying(50)
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    booking_id uuid,
    sender_id uuid NOT NULL,
    text text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    media_url text,
    is_system boolean DEFAULT false,
    client_id uuid,
    photographer_id uuid,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    original_text text,
    detected_language text,
    translated_text text,
    translated_to_lang text,
    translated_at timestamp with time zone,
    translation_skip_reason text,
    CONSTRAINT messages_content_check CHECK (((text IS NOT NULL) OR (media_url IS NOT NULL)))
);


--
-- Name: not_found_paths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.not_found_paths (
    path text NOT NULL,
    hits integer DEFAULT 1 NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_referrer text,
    last_user_agent text,
    ignored boolean DEFAULT false NOT NULL,
    suggested_target text
);


--
-- Name: notification_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel character varying(20) NOT NULL,
    recipient character varying(255) NOT NULL,
    event character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'sent'::character varying NOT NULL,
    error_code character varying(20),
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    user_id uuid NOT NULL,
    email_bookings boolean DEFAULT true,
    email_messages boolean DEFAULT true,
    email_reviews boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    sms_bookings boolean DEFAULT true,
    telegram_enabled boolean DEFAULT false
);


--
-- Name: notification_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    channel character varying(10) NOT NULL,
    recipient character varying(255) NOT NULL,
    subject character varying(500),
    body text NOT NULL,
    dedup_key character varying(255) NOT NULL,
    recipient_timezone character varying(50) DEFAULT 'Europe/Lisbon'::character varying NOT NULL,
    send_after timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    recipient_id uuid,
    message_id uuid,
    booking_id uuid,
    event_kind character varying(40),
    cancel_reason character varying(40),
    alerted_at timestamp with time zone,
    reply_to character varying(255),
    CONSTRAINT notification_queue_channel_check CHECK (((channel)::text = ANY (ARRAY[('sms'::character varying)::text, ('email'::character varying)::text]))),
    CONSTRAINT notification_queue_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('sent'::character varying)::text, ('failed'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    photographer_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    duration_minutes integer NOT NULL,
    num_photos integer NOT NULL,
    price integer NOT NULL,
    is_popular boolean DEFAULT false,
    "order" integer DEFAULT 0,
    delivery_days integer DEFAULT 7,
    sort_order integer DEFAULT 0,
    is_public boolean DEFAULT false NOT NULL,
    features text[] DEFAULT '{}'::text[],
    name_pt character varying(255),
    name_de character varying(255),
    name_es character varying(255),
    name_fr character varying(255),
    description_pt text,
    description_de text,
    description_es text,
    description_fr text,
    translations_updated_at timestamp with time zone,
    translations_dirty boolean DEFAULT true NOT NULL,
    custom_for_user_id uuid,
    is_group_package boolean DEFAULT false NOT NULL,
    slug character varying(120),
    tier public.gift_card_tier,
    revoked_at timestamp with time zone,
    name_it text,
    description_it text
);


--
-- Name: partner_outreach; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_outreach (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name character varying(200) NOT NULL,
    website character varying(500),
    email character varying(255),
    contact_name character varying(200),
    segment character varying(40) DEFAULT 'other'::character varying NOT NULL,
    region character varying(100),
    status character varying(20) DEFAULT 'new'::character varying NOT NULL,
    notes text,
    last_contacted_at timestamp with time zone,
    contact_count integer DEFAULT 0 NOT NULL,
    their_link_url character varying(500),
    our_link_url character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    osm_ref character varying(40),
    language character varying(5)
);


--
-- Name: photographer_daily_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographer_daily_stats (
    photographer_id uuid NOT NULL,
    date date NOT NULL,
    profile_views integer DEFAULT 0 NOT NULL,
    unique_visitors integer DEFAULT 0 NOT NULL,
    returning_visitors integer DEFAULT 0 NOT NULL,
    card_impressions integer DEFAULT 0 NOT NULL,
    card_clicks integer DEFAULT 0 NOT NULL,
    photo_opens integer DEFAULT 0 NOT NULL,
    concierge_impressions integer DEFAULT 0 NOT NULL,
    concierge_clicks integer DEFAULT 0 NOT NULL,
    gsc_impressions integer,
    gsc_clicks integer,
    gsc_position real,
    inquiries integer DEFAULT 0 NOT NULL,
    paid_bookings integer DEFAULT 0 NOT NULL,
    countries jsonb DEFAULT '{}'::jsonb NOT NULL,
    devices jsonb DEFAULT '{}'::jsonb NOT NULL,
    sources jsonb DEFAULT '{}'::jsonb NOT NULL,
    intents jsonb DEFAULT '{}'::jsonb NOT NULL,
    surfaces jsonb DEFAULT '{}'::jsonb NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    book_opens integer DEFAULT 0 NOT NULL,
    missed_matches jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: photographer_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographer_events (
    id bigint NOT NULL,
    photographer_id uuid NOT NULL,
    visitor_id character varying(36) NOT NULL,
    event_type character varying(20) NOT NULL,
    surface character varying(30),
    item_id uuid,
    "position" smallint,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photographer_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['card_impression'::character varying, 'card_click'::character varying, 'photo_open'::character varying, 'book_open'::character varying])::text[])))
);


--
-- Name: photographer_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.photographer_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.photographer_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: photographer_location_coverage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographer_location_coverage (
    photographer_id uuid NOT NULL,
    node_slug character varying(100) NOT NULL,
    source character varying(30) DEFAULT 'dashboard'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: photographer_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographer_locations (
    photographer_id uuid NOT NULL,
    location_slug character varying(100) NOT NULL
);


--
-- Name: photographer_profile_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographer_profile_changes (
    id bigint NOT NULL,
    photographer_id uuid NOT NULL,
    field character varying(40) NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: photographer_profile_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.photographer_profile_changes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.photographer_profile_changes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: photographer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographer_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    slug character varying(255) NOT NULL,
    tagline character varying(500),
    bio text,
    avatar_url text,
    cover_url text,
    languages text[] DEFAULT '{}'::text[],
    hourly_rate numeric(10,2),
    currency character varying(3) DEFAULT 'EUR'::character varying,
    experience_years integer DEFAULT 0,
    is_verified boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    plan public.photographer_plan DEFAULT 'free'::public.photographer_plan,
    rating numeric(2,1) DEFAULT 0,
    review_count integer DEFAULT 0,
    session_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    shoot_types text[] DEFAULT '{}'::text[],
    is_approved boolean DEFAULT false,
    stripe_account_id character varying(255),
    stripe_onboarding_complete boolean DEFAULT false,
    verification_requested_at timestamp without time zone,
    phone_number character varying(20),
    phone_verified boolean DEFAULT false,
    phone_verification_code character varying(6),
    phone_verification_sent_at timestamp without time zone,
    cover_position_y integer DEFAULT 50,
    is_founding boolean DEFAULT false,
    early_bird_tier character varying(20),
    early_bird_expires_at timestamp with time zone,
    registration_number integer,
    stripe_subscription_id text,
    stripe_price_id text,
    is_test boolean DEFAULT false,
    checklist_notified boolean DEFAULT false,
    checklist_deadline_emailed boolean DEFAULT false,
    telegram_chat_id text,
    avg_response_minutes integer,
    revision_status character varying(20),
    career_start_year integer,
    tagline_pt character varying(500),
    tagline_de character varying(500),
    tagline_es character varying(500),
    tagline_fr character varying(500),
    bio_pt text,
    bio_de text,
    bio_es text,
    bio_fr text,
    translations_updated_at timestamp with time zone,
    translations_dirty boolean DEFAULT true NOT NULL,
    min_lead_time_hours integer DEFAULT 0 NOT NULL,
    calendar_buffer_minutes integer DEFAULT 60 NOT NULL,
    accepts_gift_cards boolean DEFAULT true,
    getting_started_seen_at timestamp with time zone,
    weekly_digest_sent_at timestamp with time zone,
    payout_iban text,
    payout_holder text,
    payout_tax_id text,
    payout_details_updated_at timestamp with time zone,
    approval_requested_at timestamp with time zone,
    stripe_deadline_at timestamp with time zone,
    stripe_nudge_d1_sent boolean DEFAULT false NOT NULL,
    stripe_nudge_d4_sent boolean DEFAULT false NOT NULL,
    stripe_nudge_d6_sent boolean DEFAULT false NOT NULL,
    stripe_overdue_admin_notified boolean DEFAULT false NOT NULL,
    stripe_hidden_at timestamp with time zone,
    bank_country_confirmed_at timestamp with time zone,
    extra_photo_payout_cents integer DEFAULT 500 NOT NULL,
    bio_it text,
    tagline_it text,
    country character varying(2) DEFAULT 'pt'::character varying NOT NULL,
    stage_one_ready_at timestamp with time zone,
    submit_nudge_d1_sent boolean DEFAULT false NOT NULL,
    submit_nudge_d3_sent boolean DEFAULT false NOT NULL,
    plan_expiry_warned_at timestamp with time zone,
    CONSTRAINT photographer_profiles_calendar_buffer_minutes_check CHECK (((calendar_buffer_minutes >= 0) AND (calendar_buffer_minutes <= 1440)))
);


--
-- Name: COLUMN photographer_profiles.extra_photo_payout_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.photographer_profiles.extra_photo_payout_cents IS 'What the photographer receives per extra photo sold. Client price is derived.';


--
-- Name: photographer_unavailability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographer_unavailability (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    photographer_id uuid NOT NULL,
    date_from date NOT NULL,
    date_to date NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: photographer_visitor_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographer_visitor_days (
    photographer_id uuid NOT NULL,
    visitor_id character varying(36) NOT NULL,
    date date NOT NULL
);


--
-- Name: photographer_visitor_first_seen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographer_visitor_first_seen (
    photographer_id uuid NOT NULL,
    visitor_id character varying(36) NOT NULL,
    first_date date NOT NULL
);


--
-- Name: photographer_warnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographer_warnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    photographer_id uuid NOT NULL,
    category character varying(40) NOT NULL,
    severity character varying(10) DEFAULT 'minor'::character varying NOT NULL,
    title character varying(200) NOT NULL,
    comment text NOT NULL,
    incident_date date NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    issued_by_email character varying(255) NOT NULL,
    issued_by_name character varying(120),
    related_booking_id uuid,
    reporter_email character varying(255),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    resolution_note text,
    resolved_at timestamp with time zone,
    resolved_by_email character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photographer_warnings_category_check CHECK (((category)::text = ANY ((ARRAY['no-show'::character varying, 'late-delivery'::character varying, 'unresponsive'::character varying, 'quality'::character varying, 'billing'::character varying, 'conduct'::character varying, 'policy'::character varying, 'safety'::character varying, 'misrepresentation'::character varying, 'availability-conflict'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT photographer_warnings_check CHECK ((incident_date <= ((issued_at AT TIME ZONE 'UTC'::text))::date)),
    CONSTRAINT photographer_warnings_comment_check CHECK (((length(comment) >= 5) AND (length(comment) <= 4000))),
    CONSTRAINT photographer_warnings_severity_check CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'minor'::character varying, 'major'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT photographer_warnings_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'resolved'::character varying, 'overturned'::character varying])::text[])))
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    key character varying(100) NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: popup_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.popup_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_id character varying(36),
    event_type character varying(20) NOT NULL,
    page_path text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: portfolio_item_daily_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio_item_daily_stats (
    item_id uuid NOT NULL,
    photographer_id uuid NOT NULL,
    date date NOT NULL,
    opens integer DEFAULT 0 NOT NULL
);


--
-- Name: portfolio_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    photographer_id uuid NOT NULL,
    type character varying(10) DEFAULT 'photo'::character varying NOT NULL,
    url text NOT NULL,
    thumbnail_url text,
    caption text,
    location_slug character varying(100),
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    shoot_type character varying(50),
    width integer,
    height integer
);


--
-- Name: profile_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    photographer_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    round integer DEFAULT 1 NOT NULL,
    admin_note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profile_revisions_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('submitted'::character varying)::text, ('approved'::character varying)::text])))
);


--
-- Name: promo_codes_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_codes_meta (
    code text NOT NULL,
    notes text,
    created_by_email text,
    source text DEFAULT 'admin_panel'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: redirects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redirects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_host text NOT NULL,
    source_path text NOT NULL,
    target_url text NOT NULL,
    status_code smallint DEFAULT 301 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT redirects_status_code_check CHECK ((status_code = ANY (ARRAY[301, 302, 307, 308])))
);


--
-- Name: region_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.region_pricing (
    id integer NOT NULL,
    region character varying(50) NOT NULL,
    occasion character varying(50) NOT NULL,
    duration_minutes integer NOT NULL,
    price_eur integer NOT NULL,
    sample_size integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: region_pricing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.region_pricing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: region_pricing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.region_pricing_id_seq OWNED BY public.region_pricing.id;


--
-- Name: review_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_photos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    review_id uuid NOT NULL,
    url text NOT NULL,
    is_public boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    booking_id uuid,
    client_id uuid,
    photographer_id uuid NOT NULL,
    rating integer NOT NULL,
    title character varying(255),
    text text,
    photos_public boolean DEFAULT false,
    is_verified boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    is_approved boolean DEFAULT false,
    client_name_override character varying(255),
    video_url text,
    client_country_override character varying(2),
    title_pt character varying(255),
    title_de character varying(255),
    title_es character varying(255),
    title_fr character varying(255),
    text_pt text,
    text_de text,
    text_es text,
    text_fr text,
    source_locale character varying(5),
    translations_updated_at timestamp with time zone,
    translations_dirty boolean DEFAULT true NOT NULL,
    promo_code text,
    promo_code_id text,
    rejected_at timestamp with time zone,
    text_it text,
    title_it text,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: saved_photographers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_photographers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    photographer_id uuid,
    visitor_id character varying(36),
    locale character varying(5),
    user_agent text,
    utm_source character varying(100),
    utm_medium character varying(100),
    utm_campaign character varying(255),
    email_sent boolean DEFAULT false,
    contacted_at timestamp with time zone,
    converted_user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: slug_redirects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slug_redirects (
    old_slug character varying(255) NOT NULL,
    photographer_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: stripe_payment_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_payment_fees (
    payment_intent_id text NOT NULL,
    fee_cents integer NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE stripe_payment_fees; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_payment_fees IS 'What Stripe charged to take one payment, from balance_transaction.fee. Read by the admin revenue KPI, the revenue chart and the daily digest. Deliberately NOT a column on bookings — see migration 013.';


--
-- Name: tips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tips (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    booking_id uuid NOT NULL,
    client_id uuid,
    photographer_id uuid,
    amount_cents integer NOT NULL,
    platform_fee_cents integer NOT NULL,
    payout_cents integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    transferred boolean DEFAULT false NOT NULL,
    stripe_session_id text,
    stripe_payment_intent_id text,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password_hash character varying(255),
    role public.user_role,
    avatar_url text,
    google_id character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_verified boolean DEFAULT false,
    last_seen_at timestamp with time zone,
    stripe_customer_id character varying(255),
    is_banned boolean DEFAULT false,
    password_reset_token character varying(255),
    password_reset_expires timestamp with time zone,
    email_verification_token text,
    email_verification_expires timestamp with time zone,
    first_name character varying(255),
    last_name character varying(255),
    phone character varying(20),
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    visitor_id character varying(36),
    last_message_sms_at timestamp with time zone,
    push_token text,
    push_platform character varying(10),
    apple_id character varying(255),
    admin_notified boolean DEFAULT false,
    locale character varying(5),
    active_gift_card_id uuid,
    is_test_account boolean DEFAULT false NOT NULL,
    deactivated_at timestamp with time zone,
    country character varying(2) DEFAULT 'pt'::character varying NOT NULL
);


--
-- Name: v_photographer_warning_counts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_photographer_warning_counts AS
 SELECT photographer_id,
    count(*) FILTER (WHERE ((status)::text = 'active'::text)) AS open_count,
    count(*) FILTER (WHERE (((status)::text = 'active'::text) AND ((severity)::text = 'critical'::text))) AS critical_open_count,
    count(*) FILTER (WHERE (((status)::text = 'active'::text) AND ((severity)::text = 'major'::text))) AS major_open_count,
    max(issued_at) FILTER (WHERE ((status)::text = 'active'::text)) AS last_warning_at
   FROM public.photographer_warnings
  GROUP BY photographer_id;


--
-- Name: video_call_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_call_rooms (
    room_sid text NOT NULL,
    room text NOT NULL,
    identities text[] DEFAULT '{}'::text[] NOT NULL,
    egress_started boolean DEFAULT false NOT NULL,
    egressed_tracks text[] DEFAULT '{}'::text[] NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    notified boolean DEFAULT false NOT NULL
);


--
-- Name: visitor_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitor_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_id character varying(36) NOT NULL,
    user_id uuid,
    referrer text,
    utm_source character varying(100),
    utm_medium character varying(100),
    utm_campaign character varying(255),
    utm_term character varying(255),
    landing_page character varying(500),
    user_agent character varying(500),
    device_type character varying(20),
    country character varying(2),
    language character varying(10),
    screen_width integer,
    started_at timestamp with time zone DEFAULT now(),
    last_activity_at timestamp with time zone DEFAULT now(),
    pageviews jsonb DEFAULT '[]'::jsonb,
    pageview_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    gclid text,
    ab_hero character varying(1),
    is_bot boolean DEFAULT false NOT NULL
);


--
-- Name: wishlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    photographer_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: keyword_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keyword_snapshots ALTER COLUMN id SET DEFAULT nextval('public.keyword_snapshots_id_seq'::regclass);


--
-- Name: region_pricing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_pricing ALTER COLUMN id SET DEFAULT nextval('public.region_pricing_id_seq'::regclass);


--
-- Name: ad_pageviews ad_pageviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_pageviews
    ADD CONSTRAINT ad_pageviews_pkey PRIMARY KEY (id);


--
-- Name: ad_visits ad_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_visits
    ADD CONSTRAINT ad_visits_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: ai_generations ai_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: business_inquiries business_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_inquiries
    ADD CONSTRAINT business_inquiries_pkey PRIMARY KEY (id);


--
-- Name: calendar_busy_slots calendar_busy_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_busy_slots
    ADD CONSTRAINT calendar_busy_slots_pkey PRIMARY KEY (id);


--
-- Name: calendar_connections calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_pkey PRIMARY KEY (id);


--
-- Name: chat_chip_feedback chat_chip_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_chip_feedback
    ADD CONSTRAINT chat_chip_feedback_pkey PRIMARY KEY (id);


--
-- Name: concierge_chats concierge_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_chats
    ADD CONSTRAINT concierge_chats_pkey PRIMARY KEY (id);


--
-- Name: concierge_exclusion_events concierge_exclusion_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_exclusion_events
    ADD CONSTRAINT concierge_exclusion_events_pkey PRIMARY KEY (id);


--
-- Name: concierge_recommendation_events concierge_recommendation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_recommendation_events
    ADD CONSTRAINT concierge_recommendation_events_pkey PRIMARY KEY (id);


--
-- Name: delivery_extra_purchases delivery_extra_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_extra_purchases
    ADD CONSTRAINT delivery_extra_purchases_pkey PRIMARY KEY (id);


--
-- Name: delivery_extras_zip delivery_extras_zip_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_extras_zip
    ADD CONSTRAINT delivery_extras_zip_pkey PRIMARY KEY (booking_id);


--
-- Name: delivery_photos delivery_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_photos
    ADD CONSTRAINT delivery_photos_pkey PRIMARY KEY (id);


--
-- Name: dismissed_photographer_tasks dismissed_photographer_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_photographer_tasks
    ADD CONSTRAINT dismissed_photographer_tasks_pkey PRIMARY KEY (photographer_id, task_key);


--
-- Name: disputes disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_pkey PRIMARY KEY (id);


--
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- Name: gift_cards gift_cards_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_code_key UNIQUE (code);


--
-- Name: gift_cards gift_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_pkey PRIMARY KEY (id);


--
-- Name: issued_documents issued_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issued_documents
    ADD CONSTRAINT issued_documents_pkey PRIMARY KEY (id);


--
-- Name: keyword_snapshots keyword_snapshots_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keyword_snapshots
    ADD CONSTRAINT keyword_snapshots_date_key UNIQUE (date);


--
-- Name: keyword_snapshots keyword_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keyword_snapshots
    ADD CONSTRAINT keyword_snapshots_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: locations locations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_slug_key UNIQUE (slug);


--
-- Name: makealbum_orders makealbum_orders_makealbum_order_id_makealbum_album_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.makealbum_orders
    ADD CONSTRAINT makealbum_orders_makealbum_order_id_makealbum_album_id_key UNIQUE (makealbum_order_id, makealbum_album_id);


--
-- Name: makealbum_orders makealbum_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.makealbum_orders
    ADD CONSTRAINT makealbum_orders_pkey PRIMARY KEY (id);


--
-- Name: managed_locations managed_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managed_locations
    ADD CONSTRAINT managed_locations_pkey PRIMARY KEY (id);


--
-- Name: managed_locations managed_locations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managed_locations
    ADD CONSTRAINT managed_locations_slug_key UNIQUE (slug);


--
-- Name: manual_payouts manual_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_payouts
    ADD CONSTRAINT manual_payouts_pkey PRIMARY KEY (id);


--
-- Name: match_request_photographers match_request_photographers_match_request_id_photographer_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_request_photographers
    ADD CONSTRAINT match_request_photographers_match_request_id_photographer_i_key UNIQUE (match_request_id, photographer_id);


--
-- Name: match_request_photographers match_request_photographers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_request_photographers
    ADD CONSTRAINT match_request_photographers_pkey PRIMARY KEY (id);


--
-- Name: match_requests match_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_requests
    ADD CONSTRAINT match_requests_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: not_found_paths not_found_paths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.not_found_paths
    ADD CONSTRAINT not_found_paths_pkey PRIMARY KEY (path);


--
-- Name: notification_logs notification_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: notification_queue notification_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: partner_outreach partner_outreach_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_outreach
    ADD CONSTRAINT partner_outreach_pkey PRIMARY KEY (id);


--
-- Name: photographer_daily_stats photographer_daily_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_daily_stats
    ADD CONSTRAINT photographer_daily_stats_pkey PRIMARY KEY (photographer_id, date);


--
-- Name: photographer_events photographer_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_events
    ADD CONSTRAINT photographer_events_pkey PRIMARY KEY (id);


--
-- Name: photographer_location_coverage photographer_location_coverage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_location_coverage
    ADD CONSTRAINT photographer_location_coverage_pkey PRIMARY KEY (photographer_id, node_slug);


--
-- Name: photographer_locations photographer_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_locations
    ADD CONSTRAINT photographer_locations_pkey PRIMARY KEY (photographer_id, location_slug);


--
-- Name: photographer_profile_changes photographer_profile_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_profile_changes
    ADD CONSTRAINT photographer_profile_changes_pkey PRIMARY KEY (id);


--
-- Name: photographer_profiles photographer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_profiles
    ADD CONSTRAINT photographer_profiles_pkey PRIMARY KEY (id);


--
-- Name: photographer_profiles photographer_profiles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_profiles
    ADD CONSTRAINT photographer_profiles_slug_key UNIQUE (slug);


--
-- Name: photographer_profiles photographer_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_profiles
    ADD CONSTRAINT photographer_profiles_user_id_key UNIQUE (user_id);


--
-- Name: photographer_unavailability photographer_unavailability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_unavailability
    ADD CONSTRAINT photographer_unavailability_pkey PRIMARY KEY (id);


--
-- Name: photographer_visitor_days photographer_visitor_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_visitor_days
    ADD CONSTRAINT photographer_visitor_days_pkey PRIMARY KEY (photographer_id, date, visitor_id);


--
-- Name: photographer_visitor_first_seen photographer_visitor_first_seen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_visitor_first_seen
    ADD CONSTRAINT photographer_visitor_first_seen_pkey PRIMARY KEY (photographer_id, visitor_id);


--
-- Name: photographer_warnings photographer_warnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_warnings
    ADD CONSTRAINT photographer_warnings_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);


--
-- Name: popup_events popup_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.popup_events
    ADD CONSTRAINT popup_events_pkey PRIMARY KEY (id);


--
-- Name: portfolio_item_daily_stats portfolio_item_daily_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_item_daily_stats
    ADD CONSTRAINT portfolio_item_daily_stats_pkey PRIMARY KEY (item_id, date);


--
-- Name: portfolio_items portfolio_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_items
    ADD CONSTRAINT portfolio_items_pkey PRIMARY KEY (id);


--
-- Name: profile_revisions profile_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_revisions
    ADD CONSTRAINT profile_revisions_pkey PRIMARY KEY (id);


--
-- Name: promo_codes_meta promo_codes_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes_meta
    ADD CONSTRAINT promo_codes_meta_pkey PRIMARY KEY (code);


--
-- Name: redirects redirects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redirects
    ADD CONSTRAINT redirects_pkey PRIMARY KEY (id);


--
-- Name: redirects redirects_source_host_source_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redirects
    ADD CONSTRAINT redirects_source_host_source_path_key UNIQUE (source_host, source_path);


--
-- Name: region_pricing region_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_pricing
    ADD CONSTRAINT region_pricing_pkey PRIMARY KEY (id);


--
-- Name: region_pricing region_pricing_region_occasion_duration_minutes_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_pricing
    ADD CONSTRAINT region_pricing_region_occasion_duration_minutes_key UNIQUE (region, occasion, duration_minutes);


--
-- Name: review_photos review_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_photos
    ADD CONSTRAINT review_photos_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: saved_photographers saved_photographers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_photographers
    ADD CONSTRAINT saved_photographers_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: slug_redirects slug_redirects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slug_redirects
    ADD CONSTRAINT slug_redirects_pkey PRIMARY KEY (old_slug);


--
-- Name: stripe_payment_fees stripe_payment_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_payment_fees
    ADD CONSTRAINT stripe_payment_fees_pkey PRIMARY KEY (payment_intent_id);


--
-- Name: tips tips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tips
    ADD CONSTRAINT tips_pkey PRIMARY KEY (id);


--
-- Name: notification_queue uq_notification_dedup; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT uq_notification_dedup UNIQUE (dedup_key);


--
-- Name: users users_apple_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_apple_id_key UNIQUE (apple_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: video_call_rooms video_call_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_call_rooms
    ADD CONSTRAINT video_call_rooms_pkey PRIMARY KEY (room_sid);


--
-- Name: visitor_sessions visitor_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_sessions
    ADD CONSTRAINT visitor_sessions_pkey PRIMARY KEY (id);


--
-- Name: wishlists wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_pkey PRIMARY KEY (id);


--
-- Name: wishlists wishlists_user_id_photographer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_user_id_photographer_id_key UNIQUE (user_id, photographer_id);


--
-- Name: bookings_invoicexpress_invoice_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bookings_invoicexpress_invoice_id_key ON public.bookings USING btree (invoicexpress_invoice_id) WHERE (invoicexpress_invoice_id IS NOT NULL);


--
-- Name: idx_ad_pageviews_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_pageviews_created ON public.ad_pageviews USING btree (created_at DESC);


--
-- Name: idx_ad_pageviews_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_pageviews_session ON public.ad_pageviews USING btree (session_id);


--
-- Name: idx_ad_visits_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_visits_created ON public.ad_visits USING btree (created_at DESC);


--
-- Name: idx_ai_gens_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_gens_email ON public.ai_generations USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: idx_ai_gens_ip_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_gens_ip_recent ON public.ai_generations USING btree (ip, created_at DESC);


--
-- Name: idx_ai_gens_session_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_gens_session_recent ON public.ai_generations USING btree (session_id, created_at DESC);


--
-- Name: idx_ai_gens_user_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_gens_user_recent ON public.ai_generations USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.admin_audit_log USING btree (created_at DESC);


--
-- Name: idx_blog_posts_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_category ON public.blog_posts USING btree (category) WHERE (is_published = true);


--
-- Name: idx_blog_posts_locale_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_locale_published ON public.blog_posts USING btree (locale, is_published) WHERE (is_published = true);


--
-- Name: idx_blog_posts_translation_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_translation_group ON public.blog_posts USING btree (translation_group) WHERE (translation_group IS NOT NULL);


--
-- Name: idx_bookings_auto_refund; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_auto_refund ON public.bookings USING btree (auto_refund_at) WHERE ((auto_refund_at IS NOT NULL) AND (status = 'unmatched'::public.booking_status));


--
-- Name: idx_bookings_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_client ON public.bookings USING btree (client_id);


--
-- Name: idx_bookings_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_client_id ON public.bookings USING btree (client_id);


--
-- Name: idx_bookings_concierge_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_concierge_chat ON public.bookings USING btree (concierge_chat_id) WHERE (concierge_chat_id IS NOT NULL);


--
-- Name: idx_bookings_delivery_accepted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_delivery_accepted ON public.bookings USING btree (delivery_accepted) WHERE (delivery_accepted = false);


--
-- Name: idx_bookings_gift_card; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_gift_card ON public.bookings USING btree (gift_card_id) WHERE (gift_card_id IS NOT NULL);


--
-- Name: idx_bookings_gift_recipient_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_gift_recipient_user ON public.bookings USING btree (gift_recipient_user_id) WHERE (gift_recipient_user_id IS NOT NULL);


--
-- Name: idx_bookings_gift_reveal_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_gift_reveal_pending ON public.bookings USING btree (gift_reveal_at) WHERE ((is_gift = true) AND (gift_reveal_sent_at IS NULL) AND (gift_reveal_at IS NOT NULL));


--
-- Name: idx_bookings_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_payment_status ON public.bookings USING btree (payment_status);


--
-- Name: idx_bookings_peek_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bookings_peek_token ON public.bookings USING btree (peek_token) WHERE (peek_token IS NOT NULL);


--
-- Name: idx_bookings_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_photographer ON public.bookings USING btree (photographer_id);


--
-- Name: idx_bookings_photographer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_photographer_id ON public.bookings USING btree (photographer_id);


--
-- Name: idx_bookings_social_permission_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_social_permission_pending ON public.bookings USING btree (delivery_accepted_at) WHERE ((delivery_accepted_at IS NOT NULL) AND (social_permission_email_sent_at IS NULL));


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);


--
-- Name: idx_bookings_unmatched; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_unmatched ON public.bookings USING btree (created_at DESC) WHERE (status = 'unmatched'::public.booking_status);


--
-- Name: idx_business_inquiries_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_inquiries_created ON public.business_inquiries USING btree (created_at DESC);


--
-- Name: idx_business_inquiries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_inquiries_status ON public.business_inquiries USING btree (status);


--
-- Name: idx_busy_slots_ends_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_busy_slots_ends_at ON public.calendar_busy_slots USING btree (ends_at);


--
-- Name: idx_busy_slots_photographer_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_busy_slots_photographer_range ON public.calendar_busy_slots USING btree (photographer_id, starts_at, ends_at);


--
-- Name: idx_calendar_connections_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_connections_photographer ON public.calendar_connections USING btree (photographer_id) WHERE (is_active = true);


--
-- Name: idx_chip_feedback_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chip_feedback_photographer ON public.chat_chip_feedback USING btree (photographer_id, created_at DESC);


--
-- Name: idx_chip_feedback_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chip_feedback_recent ON public.chat_chip_feedback USING btree (created_at DESC);


--
-- Name: idx_concierge_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_created ON public.concierge_chats USING btree (created_at DESC);


--
-- Name: idx_concierge_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_email ON public.concierge_chats USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: idx_concierge_exclusions_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_exclusions_occurred ON public.concierge_exclusion_events USING btree (occurred_at);


--
-- Name: idx_concierge_exclusions_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_exclusions_photographer ON public.concierge_exclusion_events USING btree (photographer_id, occurred_at DESC);


--
-- Name: idx_concierge_exclusions_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_concierge_exclusions_unique ON public.concierge_exclusion_events USING btree (chat_id, photographer_id, reason);


--
-- Name: idx_concierge_occasion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_occasion ON public.concierge_chats USING btree (occasion) WHERE (occasion IS NOT NULL);


--
-- Name: idx_concierge_rec_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_rec_chat ON public.concierge_recommendation_events USING btree (chat_id);


--
-- Name: idx_concierge_rec_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_rec_photographer ON public.concierge_recommendation_events USING btree (photographer_id, shown_at DESC);


--
-- Name: idx_concierge_rec_shown; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_rec_shown ON public.concierge_recommendation_events USING btree (shown_at DESC);


--
-- Name: idx_concierge_rec_strategy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_rec_strategy ON public.concierge_recommendation_events USING btree (strategy, shown_at DESC);


--
-- Name: idx_concierge_visitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_visitor ON public.concierge_chats USING btree (visitor_id);


--
-- Name: idx_delivery_photos_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_photos_booking ON public.delivery_photos USING btree (booking_id);


--
-- Name: idx_delivery_photos_booking_included; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_photos_booking_included ON public.delivery_photos USING btree (booking_id) WHERE (is_included = true);


--
-- Name: idx_delivery_photos_purchased; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_photos_purchased ON public.delivery_photos USING btree (booking_id) WHERE (purchased_at IS NOT NULL);


--
-- Name: idx_disputes_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_booking ON public.disputes USING btree (booking_id);


--
-- Name: idx_disputes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_status ON public.disputes USING btree (status);


--
-- Name: idx_error_logs_fingerprint_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_fingerprint_recent ON public.error_logs USING btree (fingerprint, last_seen DESC) WHERE (resolved_at IS NULL);


--
-- Name: idx_error_logs_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_last_seen ON public.error_logs USING btree (last_seen DESC);


--
-- Name: idx_error_logs_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_unresolved ON public.error_logs USING btree (resolved_at) WHERE (resolved_at IS NULL);


--
-- Name: idx_extra_purchase_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extra_purchase_booking ON public.delivery_extra_purchases USING btree (booking_id);


--
-- Name: idx_extra_purchase_one_paid_per_photo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_extra_purchase_one_paid_per_photo ON public.delivery_extra_purchases USING btree (delivery_photo_id) WHERE ((status)::text = 'paid'::text);


--
-- Name: idx_extra_purchase_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extra_purchase_order ON public.delivery_extra_purchases USING btree (order_id);


--
-- Name: idx_extra_purchase_untransferred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extra_purchase_untransferred ON public.delivery_extra_purchases USING btree (paid_at) WHERE (((status)::text = 'paid'::text) AND (transferred = false));


--
-- Name: idx_gift_cards_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_cards_code ON public.gift_cards USING btree (code);


--
-- Name: idx_gift_cards_pending_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_cards_pending_expiry ON public.gift_cards USING btree (expires_at) WHERE (status = ANY (ARRAY['sent'::text, 'claimed'::text]));


--
-- Name: idx_gift_cards_recipient_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_cards_recipient_user ON public.gift_cards USING btree (recipient_user_id);


--
-- Name: idx_gift_cards_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_cards_status ON public.gift_cards USING btree (status);


--
-- Name: idx_makealbum_orders_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_makealbum_orders_status_created ON public.makealbum_orders USING btree (status, created_at DESC);


--
-- Name: idx_makealbum_orders_stripe_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_makealbum_orders_stripe_session ON public.makealbum_orders USING btree (stripe_session_id);


--
-- Name: idx_managed_locations_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managed_locations_active ON public.managed_locations USING btree (is_active);


--
-- Name: idx_managed_locations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managed_locations_slug ON public.managed_locations USING btree (slug);


--
-- Name: idx_manual_payouts_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manual_payouts_photographer ON public.manual_payouts USING btree (photographer_id);


--
-- Name: idx_manual_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manual_payouts_status ON public.manual_payouts USING btree (status);


--
-- Name: idx_match_requests_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_requests_created ON public.match_requests USING btree (created_at DESC);


--
-- Name: idx_match_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_requests_status ON public.match_requests USING btree (status);


--
-- Name: idx_match_requests_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_requests_user ON public.match_requests USING btree (user_id);


--
-- Name: idx_messages_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_booking ON public.messages USING btree (booking_id);


--
-- Name: idx_messages_booking_id_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_booking_id_created ON public.messages USING btree (booking_id, created_at);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (client_id, photographer_id, created_at) WHERE ((client_id IS NOT NULL) AND (photographer_id IS NOT NULL));


--
-- Name: idx_messages_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_deleted_at ON public.messages USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_unread ON public.messages USING btree (photographer_id, client_id, read_at) WHERE (read_at IS NULL);


--
-- Name: idx_messages_untranslated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_untranslated ON public.messages USING btree (created_at DESC) WHERE ((detected_language IS NULL) AND (text IS NOT NULL));


--
-- Name: idx_mrp_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrp_request ON public.match_request_photographers USING btree (match_request_id);


--
-- Name: idx_not_found_paths_hits; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_not_found_paths_hits ON public.not_found_paths USING btree (hits DESC) WHERE (NOT ignored);


--
-- Name: idx_not_found_paths_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_not_found_paths_last_seen ON public.not_found_paths USING btree (last_seen_at DESC);


--
-- Name: idx_notif_logs_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_logs_channel ON public.notification_logs USING btree (channel, created_at DESC);


--
-- Name: idx_notif_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_logs_created ON public.notification_logs USING btree (created_at DESC);


--
-- Name: idx_notif_queue_message_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_queue_message_pending ON public.notification_queue USING btree (recipient_id, channel, booking_id) WHERE (((status)::text = 'pending'::text) AND ((event_kind)::text = 'new_message'::text));


--
-- Name: idx_notification_prefs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_prefs_user ON public.notification_preferences USING btree (user_id);


--
-- Name: idx_notification_queue_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_created ON public.notification_queue USING btree (created_at);


--
-- Name: idx_notification_queue_dead_unalerted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_dead_unalerted ON public.notification_queue USING btree (channel, created_at) WHERE (((status)::text = 'failed'::text) AND (alerted_at IS NULL));


--
-- Name: idx_notification_queue_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_queue_pending ON public.notification_queue USING btree (status, send_after) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_packages_custom_for; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packages_custom_for ON public.packages USING btree (custom_for_user_id) WHERE (custom_for_user_id IS NOT NULL);


--
-- Name: idx_packages_one_tier_per_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_packages_one_tier_per_photographer ON public.packages USING btree (photographer_id, tier) WHERE (tier IS NOT NULL);


--
-- Name: idx_packages_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packages_photographer ON public.packages USING btree (photographer_id);


--
-- Name: idx_packages_photographer_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packages_photographer_slug ON public.packages USING btree (photographer_id, slug);


--
-- Name: idx_partner_outreach_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_outreach_created ON public.partner_outreach USING btree (created_at DESC);


--
-- Name: idx_partner_outreach_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_partner_outreach_email ON public.partner_outreach USING btree (lower((email)::text)) WHERE (email IS NOT NULL);


--
-- Name: idx_partner_outreach_osm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_outreach_osm ON public.partner_outreach USING btree (osm_ref) WHERE (osm_ref IS NOT NULL);


--
-- Name: idx_partner_outreach_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_outreach_status ON public.partner_outreach USING btree (status);


--
-- Name: idx_photographer_daily_stats_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photographer_daily_stats_date ON public.photographer_daily_stats USING btree (date);


--
-- Name: idx_photographer_events_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photographer_events_occurred ON public.photographer_events USING btree (occurred_at);


--
-- Name: idx_photographer_events_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photographer_events_photographer ON public.photographer_events USING btree (photographer_id, occurred_at DESC);


--
-- Name: idx_photographer_location_coverage_node; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photographer_location_coverage_node ON public.photographer_location_coverage USING btree (node_slug);


--
-- Name: idx_photographer_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photographer_plan ON public.photographer_profiles USING btree (plan);


--
-- Name: idx_photographer_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photographer_rating ON public.photographer_profiles USING btree (rating DESC);


--
-- Name: idx_photographer_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photographer_slug ON public.photographer_profiles USING btree (slug);


--
-- Name: idx_photographer_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photographer_user ON public.photographer_profiles USING btree (user_id);


--
-- Name: idx_photographer_visitor_days_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photographer_visitor_days_lookup ON public.photographer_visitor_days USING btree (photographer_id, date);


--
-- Name: idx_photoloc_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_photoloc_location ON public.photographer_locations USING btree (location_slug);


--
-- Name: idx_pkg_translations_dirty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pkg_translations_dirty ON public.packages USING btree (translations_dirty) WHERE (translations_dirty = true);


--
-- Name: idx_popup_events_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_popup_events_occurred ON public.popup_events USING btree (occurred_at DESC);


--
-- Name: idx_popup_events_type_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_popup_events_type_occurred ON public.popup_events USING btree (event_type, occurred_at DESC);


--
-- Name: idx_portfolio_item_daily_stats_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portfolio_item_daily_stats_photographer ON public.portfolio_item_daily_stats USING btree (photographer_id, date);


--
-- Name: idx_portfolio_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portfolio_photographer ON public.portfolio_items USING btree (photographer_id);


--
-- Name: idx_pp_stage_one_ready; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pp_stage_one_ready ON public.photographer_profiles USING btree (stage_one_ready_at) WHERE ((is_approved = false) AND (approval_requested_at IS NULL));


--
-- Name: idx_pp_stripe_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pp_stripe_deadline ON public.photographer_profiles USING btree (stripe_deadline_at) WHERE (stripe_deadline_at IS NOT NULL);


--
-- Name: idx_pp_stripe_hidden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pp_stripe_hidden ON public.photographer_profiles USING btree (stripe_hidden_at) WHERE (stripe_hidden_at IS NOT NULL);


--
-- Name: idx_pp_translations_dirty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pp_translations_dirty ON public.photographer_profiles USING btree (translations_dirty) WHERE (translations_dirty = true);


--
-- Name: idx_profile_changes_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_changes_photographer ON public.photographer_profile_changes USING btree (photographer_id, occurred_at DESC);


--
-- Name: idx_profile_revisions_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_revisions_photographer ON public.profile_revisions USING btree (photographer_id);


--
-- Name: idx_profile_revisions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_revisions_status ON public.profile_revisions USING btree (status) WHERE ((status)::text <> 'approved'::text);


--
-- Name: idx_promo_codes_meta_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_meta_source ON public.promo_codes_meta USING btree (source);


--
-- Name: idx_redirects_host_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redirects_host_path ON public.redirects USING btree (source_host, source_path);


--
-- Name: idx_region_pricing_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_region_pricing_lookup ON public.region_pricing USING btree (region, occasion, duration_minutes);


--
-- Name: idx_rev_translations_dirty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rev_translations_dirty ON public.reviews USING btree (translations_dirty) WHERE (translations_dirty = true);


--
-- Name: idx_reviews_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_photographer ON public.reviews USING btree (photographer_id);


--
-- Name: idx_reviews_rejected_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_rejected_at ON public.reviews USING btree (rejected_at) WHERE (rejected_at IS NOT NULL);


--
-- Name: idx_saved_photographers_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_photographers_created ON public.saved_photographers USING btree (created_at DESC);


--
-- Name: idx_saved_photographers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_photographers_email ON public.saved_photographers USING btree (email);


--
-- Name: idx_saved_photographers_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_photographers_photographer ON public.saved_photographers USING btree (photographer_id);


--
-- Name: idx_tips_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tips_booking ON public.tips USING btree (booking_id);


--
-- Name: idx_tips_one_paid_per_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tips_one_paid_per_booking ON public.tips USING btree (booking_id) WHERE ((status)::text = 'paid'::text);


--
-- Name: idx_unavailability_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unavailability_dates ON public.photographer_unavailability USING btree (date_from, date_to);


--
-- Name: idx_unavailability_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unavailability_photographer ON public.photographer_unavailability USING btree (photographer_id);


--
-- Name: idx_users_active_gift_card; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active_gift_card ON public.users USING btree (active_gift_card_id) WHERE (active_gift_card_id IS NOT NULL);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_google_id ON public.users USING btree (google_id);


--
-- Name: idx_users_is_test_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_test_account ON public.users USING btree (is_test_account) WHERE (is_test_account = true);


--
-- Name: idx_users_locale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_locale ON public.users USING btree (locale) WHERE (locale IS NOT NULL);


--
-- Name: idx_vcr_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vcr_room ON public.video_call_rooms USING btree (room);


--
-- Name: idx_visitor_sessions_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_sessions_started ON public.visitor_sessions USING btree (started_at DESC);


--
-- Name: idx_visitor_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_sessions_user_id ON public.visitor_sessions USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_visitor_sessions_visitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_sessions_visitor_id ON public.visitor_sessions USING btree (visitor_id);


--
-- Name: idx_vs_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vs_started ON public.visitor_sessions USING btree (started_at DESC);


--
-- Name: idx_vs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vs_user_id ON public.visitor_sessions USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_vs_visitor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vs_visitor_id ON public.visitor_sessions USING btree (visitor_id);


--
-- Name: idx_warnings_by_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warnings_by_booking ON public.photographer_warnings USING btree (related_booking_id) WHERE (related_booking_id IS NOT NULL);


--
-- Name: idx_warnings_by_photographer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warnings_by_photographer ON public.photographer_warnings USING btree (photographer_id, issued_at DESC);


--
-- Name: idx_warnings_open_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warnings_open_queue ON public.photographer_warnings USING btree (severity, issued_at DESC) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_wishlists_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlists_user ON public.wishlists USING btree (user_id);


--
-- Name: issued_documents_source_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX issued_documents_source_key ON public.issued_documents USING btree (source_type, source_id);


--
-- Name: issued_documents_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX issued_documents_state_idx ON public.issued_documents USING btree (state) WHERE (state <> 'final'::text);


--
-- Name: uniq_calendar_connections_google_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_calendar_connections_google_email ON public.calendar_connections USING btree (photographer_id, google_email) WHERE ((type = 'google'::text) AND (google_email IS NOT NULL));


--
-- Name: uniq_calendar_connections_ical_url; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_calendar_connections_ical_url ON public.calendar_connections USING btree (photographer_id, ical_url) WHERE ((type = 'ical'::text) AND (ical_url IS NOT NULL));


--
-- Name: blog_posts blog_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: bookings bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: managed_locations managed_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER managed_locations_updated_at BEFORE UPDATE ON public.managed_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: photographer_profiles photographer_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER photographer_profiles_updated_at BEFORE UPDATE ON public.photographer_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: messages trg_populate_message_conv_keys; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_populate_message_conv_keys BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.populate_message_conversation_keys();


--
-- Name: bookings trg_snapshot_extra_photo_price; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_snapshot_extra_photo_price BEFORE INSERT OR UPDATE OF photographer_id ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.snapshot_extra_photo_price();


--
-- Name: users users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: photographer_warnings warnings_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER warnings_touch_updated_at BEFORE UPDATE ON public.photographer_warnings FOR EACH ROW EXECUTE FUNCTION public.touch_warnings_updated_at();


--
-- Name: ai_generations ai_generations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: bookings bookings_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: bookings bookings_concierge_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_concierge_chat_id_fkey FOREIGN KEY (concierge_chat_id) REFERENCES public.concierge_chats(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_converted_to_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_converted_to_booking_id_fkey FOREIGN KEY (converted_to_booking_id) REFERENCES public.bookings(id);


--
-- Name: bookings bookings_gift_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_gift_card_id_fkey FOREIGN KEY (gift_card_id) REFERENCES public.gift_cards(id);


--
-- Name: bookings bookings_gift_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_gift_recipient_user_id_fkey FOREIGN KEY (gift_recipient_user_id) REFERENCES public.users(id);


--
-- Name: bookings bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id);


--
-- Name: bookings bookings_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id);


--
-- Name: business_inquiries business_inquiries_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_inquiries
    ADD CONSTRAINT business_inquiries_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE SET NULL;


--
-- Name: calendar_busy_slots calendar_busy_slots_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_busy_slots
    ADD CONSTRAINT calendar_busy_slots_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.calendar_connections(id) ON DELETE CASCADE;


--
-- Name: calendar_busy_slots calendar_busy_slots_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_busy_slots
    ADD CONSTRAINT calendar_busy_slots_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: calendar_connections calendar_connections_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: chat_chip_feedback chat_chip_feedback_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_chip_feedback
    ADD CONSTRAINT chat_chip_feedback_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: chat_chip_feedback chat_chip_feedback_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_chip_feedback
    ADD CONSTRAINT chat_chip_feedback_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_chip_feedback chat_chip_feedback_last_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_chip_feedback
    ADD CONSTRAINT chat_chip_feedback_last_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: chat_chip_feedback chat_chip_feedback_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_chip_feedback
    ADD CONSTRAINT chat_chip_feedback_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE SET NULL;


--
-- Name: concierge_chats concierge_chats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_chats
    ADD CONSTRAINT concierge_chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: concierge_exclusion_events concierge_exclusion_events_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_exclusion_events
    ADD CONSTRAINT concierge_exclusion_events_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: concierge_recommendation_events concierge_recommendation_events_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_recommendation_events
    ADD CONSTRAINT concierge_recommendation_events_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.concierge_chats(id) ON DELETE CASCADE;


--
-- Name: concierge_recommendation_events concierge_recommendation_events_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_recommendation_events
    ADD CONSTRAINT concierge_recommendation_events_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: delivery_extra_purchases delivery_extra_purchases_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_extra_purchases
    ADD CONSTRAINT delivery_extra_purchases_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: delivery_extra_purchases delivery_extra_purchases_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_extra_purchases
    ADD CONSTRAINT delivery_extra_purchases_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: delivery_extra_purchases delivery_extra_purchases_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_extra_purchases
    ADD CONSTRAINT delivery_extra_purchases_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id);


--
-- Name: delivery_extras_zip delivery_extras_zip_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_extras_zip
    ADD CONSTRAINT delivery_extras_zip_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: delivery_photos delivery_photos_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_photos
    ADD CONSTRAINT delivery_photos_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: dismissed_photographer_tasks dismissed_photographer_tasks_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_photographer_tasks
    ADD CONSTRAINT dismissed_photographer_tasks_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: disputes disputes_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: disputes disputes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: disputes disputes_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id);


--
-- Name: gift_cards gift_cards_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: gift_cards gift_cards_buyer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_buyer_user_id_fkey FOREIGN KEY (buyer_user_id) REFERENCES public.users(id);


--
-- Name: gift_cards gift_cards_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id);


--
-- Name: issued_documents issued_documents_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issued_documents
    ADD CONSTRAINT issued_documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: issued_documents issued_documents_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issued_documents
    ADD CONSTRAINT issued_documents_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id);


--
-- Name: manual_payouts manual_payouts_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_payouts
    ADD CONSTRAINT manual_payouts_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: manual_payouts manual_payouts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_payouts
    ADD CONSTRAINT manual_payouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: manual_payouts manual_payouts_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_payouts
    ADD CONSTRAINT manual_payouts_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: match_request_photographers match_request_photographers_match_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_request_photographers
    ADD CONSTRAINT match_request_photographers_match_request_id_fkey FOREIGN KEY (match_request_id) REFERENCES public.match_requests(id) ON DELETE CASCADE;


--
-- Name: messages messages_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: messages messages_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: messages messages_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id);


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notification_queue notification_queue_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: notification_queue notification_queue_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_queue
    ADD CONSTRAINT notification_queue_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: packages packages_custom_for_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_custom_for_user_id_fkey FOREIGN KEY (custom_for_user_id) REFERENCES public.users(id);


--
-- Name: packages packages_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: photographer_daily_stats photographer_daily_stats_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_daily_stats
    ADD CONSTRAINT photographer_daily_stats_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: photographer_events photographer_events_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_events
    ADD CONSTRAINT photographer_events_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: photographer_location_coverage photographer_location_coverage_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_location_coverage
    ADD CONSTRAINT photographer_location_coverage_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: photographer_locations photographer_locations_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_locations
    ADD CONSTRAINT photographer_locations_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: photographer_profile_changes photographer_profile_changes_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_profile_changes
    ADD CONSTRAINT photographer_profile_changes_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: photographer_profiles photographer_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_profiles
    ADD CONSTRAINT photographer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: photographer_unavailability photographer_unavailability_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_unavailability
    ADD CONSTRAINT photographer_unavailability_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: photographer_visitor_days photographer_visitor_days_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_visitor_days
    ADD CONSTRAINT photographer_visitor_days_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: photographer_visitor_first_seen photographer_visitor_first_seen_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_visitor_first_seen
    ADD CONSTRAINT photographer_visitor_first_seen_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: photographer_warnings photographer_warnings_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_warnings
    ADD CONSTRAINT photographer_warnings_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: photographer_warnings photographer_warnings_related_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographer_warnings
    ADD CONSTRAINT photographer_warnings_related_booking_id_fkey FOREIGN KEY (related_booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: portfolio_item_daily_stats portfolio_item_daily_stats_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_item_daily_stats
    ADD CONSTRAINT portfolio_item_daily_stats_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.portfolio_items(id) ON DELETE CASCADE;


--
-- Name: portfolio_item_daily_stats portfolio_item_daily_stats_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_item_daily_stats
    ADD CONSTRAINT portfolio_item_daily_stats_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: portfolio_items portfolio_items_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_items
    ADD CONSTRAINT portfolio_items_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: profile_revisions profile_revisions_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_revisions
    ADD CONSTRAINT profile_revisions_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: review_photos review_photos_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_photos
    ADD CONSTRAINT review_photos_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: reviews reviews_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: reviews reviews_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id);


--
-- Name: saved_photographers saved_photographers_converted_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_photographers
    ADD CONSTRAINT saved_photographers_converted_user_id_fkey FOREIGN KEY (converted_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: saved_photographers saved_photographers_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_photographers
    ADD CONSTRAINT saved_photographers_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: slug_redirects slug_redirects_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slug_redirects
    ADD CONSTRAINT slug_redirects_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: tips tips_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tips
    ADD CONSTRAINT tips_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: tips tips_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tips
    ADD CONSTRAINT tips_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: tips tips_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tips
    ADD CONSTRAINT tips_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id);


--
-- Name: users users_active_gift_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_active_gift_card_id_fkey FOREIGN KEY (active_gift_card_id) REFERENCES public.gift_cards(id);


--
-- Name: visitor_sessions visitor_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_sessions
    ADD CONSTRAINT visitor_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wishlists wishlists_photographer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_photographer_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographer_profiles(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict doFWyfVd2JwUtAEOqgS4Nlobxr9HmY5Opb9eVODA1jbviwjolM5dPGcFRszWuYg

