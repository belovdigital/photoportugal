import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";

function escapeHtml(value: string | null | undefined): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function notifyClientAboutPackageOffer({
  bookingId,
  clientId,
  photographerId,
  packageId,
  packageName,
  price,
  durationMinutes,
  numPhotos,
  photographerSlug,
  isCustom,
  description,
}: {
  bookingId: string;
  clientId: string;
  photographerId: string;
  packageId: string;
  packageName: string;
  price: number;
  durationMinutes: number;
  numPhotos: number;
  photographerSlug: string;
  isCustom: boolean;
  description?: string | null;
}) {
  const [client, photographer] = await Promise.all([
    queryOne<{ email: string; name: string; locale: string | null }>(
      "SELECT email, name, locale FROM users WHERE id = $1",
      [clientId]
    ),
    queryOne<{ name: string }>(
      `SELECT u.name
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.id = $1`,
      [photographerId]
    ),
  ]);

  if (!client?.email || !photographerSlug) return;

  const prefs = await queryOne<{ email_messages: boolean }>(
    "SELECT email_messages FROM notification_preferences WHERE user_id = $1",
    [clientId]
  );
  if (prefs?.email_messages === false) return;

  const { sendEmail, emailLayout, emailButton } = await import("@/lib/email");
  const { normalizeLocale, pickT, localizedUrl, formatPrice } = await import("@/lib/email-locale");

  const locale = normalizeLocale(client.locale);
  const photographerName = photographer?.name || "your photographer";
  const firstName = client.name.split(" ")[0] || "there";
  const priceText = formatPrice(price, locale);
  const bookingUrl = localizedUrl(`/book/${photographerSlug}?package=${encodeURIComponent(packageId)}`, locale);
  const messagesUrl = localizedUrl("/dashboard/messages", locale);
  const durationLabel = durationMinutes >= 60 && durationMinutes % 60 === 0
    ? `${durationMinutes / 60}h`
    : `${durationMinutes} min`;

  const T = pickT({
    en: {
      subject: isCustom ? `${photographerName} sent you a custom photoshoot proposal` : `${photographerName} sent you a photoshoot package`,
      h2: isCustom ? "Custom proposal sent" : "Package sent",
      greeting: `Hi ${firstName},`,
      intro: isCustom
        ? `<strong>${escapeHtml(photographerName)}</strong> created a custom photoshoot proposal for you.`
        : `<strong>${escapeHtml(photographerName)}</strong> shared a photoshoot package with you.`,
      details: "Package details:",
      book: "Book this package",
      messages: "Open messages",
    },
    pt: {
      subject: isCustom ? `${photographerName} enviou-lhe uma proposta personalizada` : `${photographerName} enviou-lhe um pacote fotográfico`,
      h2: isCustom ? "Proposta personalizada enviada" : "Pacote enviado",
      greeting: `Olá ${firstName},`,
      intro: isCustom
        ? `<strong>${escapeHtml(photographerName)}</strong> criou uma proposta fotográfica personalizada para si.`
        : `<strong>${escapeHtml(photographerName)}</strong> partilhou consigo um pacote fotográfico.`,
      details: "Detalhes do pacote:",
      book: "Reservar este pacote",
      messages: "Abrir mensagens",
    },
    de: {
      subject: isCustom ? `${photographerName} hat Ihnen ein individuelles Fotoshooting-Angebot gesendet` : `${photographerName} hat Ihnen ein Fotoshooting-Paket gesendet`,
      h2: isCustom ? "Individuelles Angebot gesendet" : "Paket gesendet",
      greeting: `Hallo ${firstName},`,
      intro: isCustom
        ? `<strong>${escapeHtml(photographerName)}</strong> hat ein individuelles Fotoshooting-Angebot für Sie erstellt.`
        : `<strong>${escapeHtml(photographerName)}</strong> hat Ihnen ein Fotoshooting-Paket gesendet.`,
      details: "Paketdetails:",
      book: "Dieses Paket buchen",
      messages: "Nachrichten öffnen",
    },
    es: {
      subject: isCustom ? `${photographerName} le envió una propuesta personalizada` : `${photographerName} le envió un paquete de sesión`,
      h2: isCustom ? "Propuesta personalizada enviada" : "Paquete enviado",
      greeting: `Hola ${firstName},`,
      intro: isCustom
        ? `<strong>${escapeHtml(photographerName)}</strong> creó una propuesta de sesión personalizada para usted.`
        : `<strong>${escapeHtml(photographerName)}</strong> compartió un paquete de sesión con usted.`,
      details: "Detalles del paquete:",
      book: "Reservar este paquete",
      messages: "Abrir mensajes",
    },
    fr: {
      subject: isCustom ? `${photographerName} vous a envoyé une proposition personnalisée` : `${photographerName} vous a envoyé un forfait photo`,
      h2: isCustom ? "Proposition personnalisée envoyée" : "Forfait envoyé",
      greeting: `Bonjour ${firstName},`,
      intro: isCustom
        ? `<strong>${escapeHtml(photographerName)}</strong> a créé une proposition de séance photo personnalisée pour vous.`
        : `<strong>${escapeHtml(photographerName)}</strong> vous a partagé un forfait photo.`,
      details: "Détails du forfait :",
      book: "Réserver ce forfait",
      messages: "Ouvrir les messages",
    },
  }, locale);

  const descriptionHtml = description
    ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#6B6055;font-style:italic;">"${escapeHtml(description)}"</p>`
    : "";

  await sendEmail(
    client.email,
    T.subject,
    emailLayout(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.intro}</p>
      <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#9B8E82;">${T.details}</p>
        <p style="margin:0;font-size:17px;font-weight:700;color:#1F1F1F;">${escapeHtml(packageName)}</p>
        ${descriptionHtml}
        <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#4A4A4A;">${durationLabel} · ${numPhotos} photos · <strong>${priceText}</strong></p>
      </div>
      ${emailButton(bookingUrl, T.book, "#16A34A")}
      ${emailButton(messagesUrl, T.messages)}
    `, locale)
  );

  try {
    const { notifyUser } = await import("@/lib/realtime");
    notifyUser(clientId, "package_offer", { bookingId, packageId, isCustom });
  } catch {}
}

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { booking_id, package_id } = await req.json();
  if (!booking_id || !package_id) {
    return NextResponse.json({ error: "booking_id and package_id required" }, { status: 400 });
  }

  // Verify user is the photographer in this booking
  const booking = await queryOne<{ photographer_id: string; photographer_user_id: string; client_id: string }>(
    `SELECT b.photographer_id, pp.user_id as photographer_user_id, b.client_id
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     WHERE b.id = $1`,
    [booking_id]
  );

  if (!booking || booking.photographer_user_id !== user.id) {
    return NextResponse.json({ error: "Only the photographer can share packages" }, { status: 403 });
  }

  // Get the package (must belong to this photographer)
  const pkg = await queryOne<{ id: string; name: string; price: number; duration_minutes: number; num_photos: number }>(
    "SELECT id, name, price, duration_minutes, num_photos FROM packages WHERE id = $1 AND photographer_id = $2",
    [package_id, booking.photographer_id]
  );

  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // Get photographer slug for the booking link
  const profile = await queryOne<{ slug: string }>(
    "SELECT slug FROM photographer_profiles WHERE id = $1",
    [booking.photographer_id]
  );

  const cardData = JSON.stringify({
    package_id: pkg.id,
    name: pkg.name,
    price: pkg.price,
    duration_minutes: pkg.duration_minutes,
    num_photos: pkg.num_photos,
    slug: profile?.slug || "",
    photographer_id: booking.photographer_id,
  });

  // Insert as a system message from the photographer
  const message = await queryOne<{ id: string; created_at: string }>(
    `INSERT INTO messages (booking_id, sender_id, text, is_system)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id, created_at`,
    [booking_id, user.id, `BOOKING_CARD:${cardData}`]
  );

  // Notify via WebSocket
  try {
    const senderInfo = await queryOne<{ name: string; avatar_url: string | null }>(
      "SELECT name, avatar_url FROM users WHERE id = $1", [user.id]
    );
    await queryOne("SELECT pg_notify('new_message', $1)", [
      JSON.stringify({
        booking_id,
        message: {
          id: message!.id,
          text: `BOOKING_CARD:${cardData}`,
          media_url: null,
          sender_id: user.id,
          sender_name: senderInfo?.name || "",
          sender_avatar: senderInfo?.avatar_url || null,
          created_at: message!.created_at,
          read_at: null,
          is_system: true,
        },
      }),
    ]);
  } catch {}

  // Telegram admin ping — photographer pushed a package to a client. Useful
  // as an early funnel signal: shares often precede bookings.
  (async () => {
    try {
      const names = await queryOne<{ photographer_name: string; client_name: string }>(
        `SELECT pu.name as photographer_name, cu.name as client_name
         FROM bookings b
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         JOIN users cu ON cu.id = b.client_id
         WHERE b.id = $1`,
        [booking_id]
      );
      if (names) {
        const { sendTelegram } = await import("@/lib/telegram");
        const lines = [
          `📦 <b>Package shared in chat</b>`,
          ``,
          `${names.photographer_name} → ${names.client_name}`,
          `<b>${pkg.name}</b> · €${Math.round(Number(pkg.price))}`,
          `${pkg.duration_minutes} min · ${pkg.num_photos} photos`,
        ];
        await sendTelegram(lines.join("\n"), "bookings");
      }
    } catch (err) {
      console.error("[share-package] telegram error:", err);
    }
  })().catch(() => {});

  notifyClientAboutPackageOffer({
    bookingId: booking_id,
    clientId: booking.client_id,
    photographerId: booking.photographer_id,
    packageId: pkg.id,
    packageName: pkg.name,
    price: Number(pkg.price),
    durationMinutes: Number(pkg.duration_minutes),
    numPhotos: Number(pkg.num_photos),
    photographerSlug: profile?.slug || "",
    isCustom: false,
  }).catch((err) => console.error("[share-package] client email error:", err));

  return NextResponse.json({
    success: true,
    message: {
      id: message!.id,
      text: `BOOKING_CARD:${cardData}`,
      media_url: null,
      sender_id: user.id,
      created_at: message!.created_at,
      read_at: null,
      is_system: true,
    },
  });
}

// GET: return photographer's packages for the share picker (only public
// ones — the custom-proposal flow uses its own POST below).
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookingId = req.nextUrl.searchParams.get("booking_id");
  if (!bookingId) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  const booking = await queryOne<{ photographer_id: string; photographer_user_id: string }>(
    `SELECT b.photographer_id, pp.user_id as photographer_user_id
     FROM bookings b JOIN photographer_profiles pp ON pp.id = b.photographer_id
     WHERE b.id = $1`,
    [bookingId]
  );

  if (!booking || booking.photographer_user_id !== user.id) {
    return NextResponse.json({ error: "Not the photographer" }, { status: 403 });
  }

  // Only the photographer's "regular" public packages — custom one-offs
  // are created on demand via PUT below, never re-shared from this list.
  const packages = await query<{ id: string; name: string; price: number; duration_minutes: number; num_photos: number }>(
    `SELECT id, name, price, duration_minutes, num_photos
     FROM packages
     WHERE photographer_id = $1 AND custom_for_user_id IS NULL
     ORDER BY sort_order, price`,
    [booking.photographer_id]
  );

  return NextResponse.json(packages);
}

// PUT: create a one-off custom proposal for this client and share it as a
// chat card in one shot. Body: { booking_id, name, price, duration_minutes,
// num_photos, description? }. The package row is private (is_public=FALSE)
// and tied to the client via custom_for_user_id — only that client can see
// it on /book/[slug] or create a booking against it.
export async function PUT(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    booking_id?: string;
    name?: unknown;
    price?: unknown;
    duration_minutes?: unknown;
    num_photos?: unknown;
    description?: unknown;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const bookingId = body.booking_id;
  if (!bookingId) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  // Same auth check as the regular share endpoint.
  const booking = await queryOne<{ photographer_id: string; photographer_user_id: string; client_id: string }>(
    `SELECT b.photographer_id, pp.user_id as photographer_user_id, b.client_id
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (!booking || booking.photographer_user_id !== user.id) {
    return NextResponse.json({ error: "Only the photographer can create a custom proposal" }, { status: 403 });
  }

  // Validate inputs. Bounds: price 1-99999€, duration 5-1440 min, photos
  // 1-9999. Name 3-80 chars. Description optional, max 500.
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  const durationMinutes = Number(body.duration_minutes);
  const numPhotos = Number(body.num_photos);
  const description = String(body.description ?? "").trim().slice(0, 500) || null;
  if (name.length < 3 || name.length > 80) {
    return NextResponse.json({ error: "Name must be 3-80 characters." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 1 || price > 99999) {
    return NextResponse.json({ error: "Price must be between €1 and €99,999." }, { status: 400 });
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) {
    return NextResponse.json({ error: "Duration must be 5-1440 minutes." }, { status: 400 });
  }
  if (!Number.isFinite(numPhotos) || numPhotos < 1 || numPhotos > 9999) {
    return NextResponse.json({ error: "Photo count must be 1-9999." }, { status: 400 });
  }

  // Insert as a private one-off targeted at this booking's client.
  // CRITICAL: is_public=FALSE explicitly. Production DB has the column
  // default at TRUE (schema drift vs schema.sql which says FALSE) so
  // omitting it here would leak the proposal to every visitor of /book.
  const pkg = await queryOne<{ id: string }>(
    `INSERT INTO packages (photographer_id, name, description, duration_minutes, num_photos, price,
                           is_public, is_popular, delivery_days, sort_order, custom_for_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE, FALSE, 7, 0, $7)
     RETURNING id`,
    [booking.photographer_id, name, description, Math.round(durationMinutes), Math.round(numPhotos), Math.round(price), booking.client_id]
  );
  if (!pkg) return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 });

  // Photographer slug for the booking link inside the card.
  const profile = await queryOne<{ slug: string }>(
    "SELECT slug FROM photographer_profiles WHERE id = $1",
    [booking.photographer_id]
  );

  // Same BOOKING_CARD payload as the public-package share, with `is_custom`
  // so the chat UI can render the small "Custom proposal" badge.
  const cardData = JSON.stringify({
    package_id: pkg.id,
    name,
    price: Math.round(price),
    duration_minutes: Math.round(durationMinutes),
    num_photos: Math.round(numPhotos),
    slug: profile?.slug || "",
    photographer_id: booking.photographer_id,
    is_custom: true,
    description,
  });

  const message = await queryOne<{ id: string; created_at: string }>(
    `INSERT INTO messages (booking_id, sender_id, text, is_system)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id, created_at`,
    [bookingId, user.id, `BOOKING_CARD:${cardData}`]
  );

  // WebSocket fan-out — same shape as the public-package share so the
  // chat UI doesn't need to differentiate at the transport level.
  try {
    const senderInfo = await queryOne<{ name: string; avatar_url: string | null }>(
      "SELECT name, avatar_url FROM users WHERE id = $1", [user.id]
    );
    await queryOne("SELECT pg_notify('new_message', $1)", [
      JSON.stringify({
        booking_id: bookingId,
        message: {
          id: message!.id,
          text: `BOOKING_CARD:${cardData}`,
          media_url: null,
          sender_id: user.id,
          sender_name: senderInfo?.name || "",
          sender_avatar: senderInfo?.avatar_url || null,
          created_at: message!.created_at,
          read_at: null,
          is_system: true,
        },
      }),
    ]);
  } catch {}

  // Telegram admin ping — custom one-off proposal. Same shape as the
  // public-package share but with a ✨ marker + the description so admins
  // can see how photographers are pricing custom asks.
  (async () => {
    try {
      const names = await queryOne<{ photographer_name: string; client_name: string }>(
        `SELECT pu.name as photographer_name, cu.name as client_name
         FROM bookings b
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         JOIN users cu ON cu.id = b.client_id
         WHERE b.id = $1`,
        [bookingId]
      );
      if (names) {
        const { sendTelegram } = await import("@/lib/telegram");
        const lines = [
          `✨ <b>Custom proposal sent</b>`,
          ``,
          `${names.photographer_name} → ${names.client_name}`,
          `<b>${name.replace(/[<>]/g, "")}</b> · €${Math.round(price)}`,
          `${Math.round(durationMinutes)} min · ${Math.round(numPhotos)} photos`,
        ];
        if (description) {
          lines.push(``, `<i>${description.replace(/[<>]/g, "")}</i>`);
        }
        await sendTelegram(lines.join("\n"), "bookings");
      }
    } catch (err) {
      console.error("[share-package custom] telegram error:", err);
    }
  })().catch(() => {});

  notifyClientAboutPackageOffer({
    bookingId,
    clientId: booking.client_id,
    photographerId: booking.photographer_id,
    packageId: pkg.id,
    packageName: name,
    price: Math.round(price),
    durationMinutes: Math.round(durationMinutes),
    numPhotos: Math.round(numPhotos),
    photographerSlug: profile?.slug || "",
    isCustom: true,
    description,
  }).catch((err) => console.error("[share-package custom] client email error:", err));

  return NextResponse.json({
    success: true,
    package_id: pkg.id,
    message: {
      id: message!.id,
      text: `BOOKING_CARD:${cardData}`,
      media_url: null,
      sender_id: user.id,
      created_at: message!.created_at,
      read_at: null,
      is_system: true,
    },
  });
}
