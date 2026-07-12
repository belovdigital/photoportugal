import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne, query } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { uploadToS3, deleteFromS3, getPresignedUrl, isS3Path, s3KeyFromPath } from "@/lib/s3";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per delivery photo (high-res RAW exports)
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB per delivery video (h264 at ~5-10MB/s)
const MAX_DELIVERY_PHOTOS = 500; // max items per delivery (photos + videos combined) — raised from 200 after Isa hit it generously delivering 222 photos for an Essential package
const MAX_DELIVERY_VIDEOS = 10; // hard cap on videos to keep total ZIP / storage in check
const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";


// GET: List delivery photos for a booking
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authFromRequest(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = authUser.id;

  const booking = await queryOne<{ client_id: string; photographer_user_id: string; status: string; delivery_token: string | null }>(
    `SELECT b.client_id, u.id as photographer_user_id, b.status, b.delivery_token
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`, [id]
  );

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.client_id !== userId && booking.photographer_user_id !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }



  const rawPhotos = await query<{
    id: string; url: string; thumbnail_url: string | null; preview_url: string | null;
    filename: string; file_size: number; sort_order: number; created_at: string;
    media_type: string; duration_seconds: number | null; width: number | null; height: number | null;
  }>(
    `SELECT id, url, thumbnail_url, preview_url, filename, file_size, sort_order, created_at,
            COALESCE(media_type, 'image') as media_type, duration_seconds, width, height
     FROM delivery_photos WHERE booking_id = $1 ORDER BY sort_order, created_at`,
    [id]
  );

  // Resolve S3 URLs to presigned URLs for display
  const { getPresignedUrl, isS3Path, s3KeyFromPath } = await import("@/lib/s3");
  const photos = await Promise.all(rawPhotos.map(async (photo) => {
    let url = photo.url;
    let thumb = photo.thumbnail_url;
    if (isS3Path(url)) url = await getPresignedUrl(s3KeyFromPath(url), 3600);
    if (thumb && isS3Path(thumb)) thumb = await getPresignedUrl(s3KeyFromPath(thumb), 3600);
    return { ...photo, url, thumbnail_url: thumb };
  }));

  // Title and message are surfaced so the photographer's deliver UI can
  // pre-fill them on edit (and the client gallery renders the headline).
  const messageRow = await queryOne<{ delivery_title: string | null; delivery_message: string | null }>(
    "SELECT delivery_title, delivery_message FROM bookings WHERE id = $1",
    [id]
  );

  return NextResponse.json({
    photos,
    delivery_token: booking.delivery_token,
    status: booking.status,
    delivery_title: messageRow?.delivery_title ?? null,
    delivery_message: messageRow?.delivery_message ?? null,
  });
}

// POST: Upload delivery photos or share with client
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authFromRequest(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = authUser.id;

  const booking = await queryOne<{
    photographer_id: string; photographer_user_id: string; client_id: string;
    status: string; delivery_accepted: boolean;
    photographer_name: string; shoot_date: string | null;
  }>(
    `SELECT b.photographer_id, u.id as photographer_user_id, b.client_id, b.status,
            COALESCE(b.delivery_accepted, FALSE) as delivery_accepted,
            u.name as photographer_name, b.shoot_date::text as shoot_date
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`, [id]
  );

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.photographer_user_id !== userId) {
    return NextResponse.json({ error: "Only the photographer can upload delivery photos" }, { status: 403 });
  }
  if (!["completed", "delivered"].includes(booking.status)) {
    return NextResponse.json({ error: "Booking must be completed first" }, { status: 400 });
  }
  if (booking.delivery_accepted) {
    return NextResponse.json({ error: "Delivery has been accepted by the client and can no longer be modified" }, { status: 400 });
  }



  const contentType = req.headers.get("content-type") || "";

  // Check if this is a "share" action (JSON body)
  if (contentType.includes("application/json")) {
    const body = await req.json();

    // Save-only action — photographer types title/message before sharing.
    // Persists without flipping booking status or generating a token.
    if (body.action === "save_message") {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : null;
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 1500) : null;
      await queryOne(
        "UPDATE bookings SET delivery_title = $1, delivery_message = $2 WHERE id = $3 RETURNING id",
        [title, message, id]
      );
      return NextResponse.json({ success: true });
    }

    // ── Sneak peek — optional early preview, NOT a delivery ─────────
    // Flags the currently-uploaded images (1-10, photos only) as peek and
    // mints a passwordless shareable /peek/{token} link. Deliberately does
    // NOT touch status / delivery_token / deadlines — the delivery clock
    // keeps ticking and accept/ZIP/tips stay locked until the real share.
    if (body.action === "share_peek") {
      if (booking.status !== "completed") {
        return NextResponse.json({ error: "Sneak peek is only available before the full delivery" }, { status: 400 });
      }
      const existing = await queryOne<{ peek_shared_at: string | null; peek_token: string | null }>(
        "SELECT peek_shared_at, peek_token FROM bookings WHERE id = $1",
        [id]
      );
      if (existing?.peek_shared_at) {
        return NextResponse.json({ error: "Sneak peek already shared", peek_token: existing.peek_token }, { status: 409 });
      }
      const imgs = await queryOne<{ count: string }>(
        "SELECT COUNT(*) as count FROM delivery_photos WHERE booking_id = $1 AND COALESCE(media_type, 'image') <> 'video'",
        [id]
      );
      const imgCount = parseInt(imgs?.count || "0");
      if (imgCount < 1 || imgCount > 10) {
        return NextResponse.json({ error: "A sneak peek is 1-10 photos" }, { status: 400 });
      }

      const peekToken = crypto.randomBytes(32).toString("hex");
      // Videos are excluded — they aren't watermarked and would leak the
      // final asset; the clean 1200px thumbnail is the peek's max quality.
      await queryOne(
        `UPDATE delivery_photos SET is_peek = TRUE
          WHERE booking_id = $1 AND COALESCE(media_type, 'image') <> 'video' RETURNING id`,
        [id]
      );
      const updated = await queryOne<{ id: string }>(
        `UPDATE bookings SET peek_token = $1, peek_shared_at = NOW()
          WHERE id = $2 AND peek_shared_at IS NULL RETURNING id`,
        [peekToken, id]
      );
      if (!updated) {
        return NextResponse.json({ error: "Sneak peek already shared" }, { status: 409 });
      }

      const peekUrl = `${BASE_URL}/peek/${peekToken}`;

      // Chat message — plain text (typed payload prefixes render raw on
      // mobile app builds that don't know them).
      try {
        const photogFirst = booking.photographer_name.split(" ")[0];
        await queryOne(
          `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE)`,
          [id, userId, `✨ ${photogFirst} shared a sneak peek — ${imgCount} ${imgCount === 1 ? "photo" : "photos"} while the full gallery is being edited: ${peekUrl}`]
        );
      } catch (e) {
        console.error("[delivery/share_peek] chat message error:", e);
      }

      // Client email — 5-locale, soft expectation-setting.
      try {
        const details = await queryOne<{ client_email: string; client_name: string; photographer_name: string; shoot_date: string | null; delivery_days: number | null; num_photos: number | null }>(
          `SELECT cu.email as client_email, cu.name as client_name, pu.name as photographer_name,
                  b.shoot_date::text as shoot_date, p.delivery_days, p.num_photos
           FROM bookings b
           JOIN users cu ON cu.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           LEFT JOIN packages p ON p.id = b.package_id
           WHERE b.id = $1`, [id]
        );
        if (details) {
          const { sendEmail, emailLayout, emailButton } = await import("@/lib/email");
          const { getUserLocaleByEmail, pickT } = await import("@/lib/email-locale");
          const loc = await getUserLocaleByEmail(details.client_email);
          const cFirst = details.client_name.split(" ")[0];
          const pFirst = details.photographer_name.split(" ")[0];
          const expected = details.shoot_date
            ? new Date(new Date(details.shoot_date).getTime() + (details.delivery_days || 7) * 86400000)
            : null;
          const expStr = expected ? expected.toLocaleDateString(loc === "en" ? "en-GB" : loc, { day: "numeric", month: "long" }) : null;
          const T = pickT({
            en: { subject: `✨ ${pFirst} shared a sneak peek of your photos`, body: `${pFirst} picked ${imgCount} favourite${imgCount === 1 ? "" : "s"} from your session while editing the rest of your gallery.`, expect: expStr ? `Your full gallery${details.num_photos ? ` of ~${details.num_photos} photos` : ""} is expected by ~${expStr}.` : "", cta: "See the sneak peek", share: "Feel free to share the link with family and friends!" },
            pt: { subject: `✨ ${pFirst} partilhou uma prévia das suas fotos`, body: `${pFirst} escolheu ${imgCount} ${imgCount === 1 ? "favorita" : "favoritas"} da sua sessão enquanto edita o resto da galeria.`, expect: expStr ? `A sua galeria completa${details.num_photos ? ` com ~${details.num_photos} fotos` : ""} deverá chegar por volta de ${expStr}.` : "", cta: "Ver a prévia", share: "Partilhe o link com família e amigos à vontade!" },
            de: { subject: `✨ ${pFirst} hat eine Vorschau Ihrer Fotos geteilt`, body: `${pFirst} hat ${imgCount} Favorit${imgCount === 1 ? "en" : "en"} aus Ihrer Session ausgewählt, während der Rest der Galerie bearbeitet wird.`, expect: expStr ? `Ihre vollständige Galerie${details.num_photos ? ` mit ~${details.num_photos} Fotos` : ""} wird etwa am ${expStr} erwartet.` : "", cta: "Vorschau ansehen", share: "Teilen Sie den Link gerne mit Familie und Freunden!" },
            es: { subject: `✨ ${pFirst} compartió un adelanto de tus fotos`, body: `${pFirst} eligió ${imgCount} favorita${imgCount === 1 ? "" : "s"} de tu sesión mientras edita el resto de la galería.`, expect: expStr ? `Tu galería completa${details.num_photos ? ` de ~${details.num_photos} fotos` : ""} llegará alrededor del ${expStr}.` : "", cta: "Ver el adelanto", share: "¡Comparte el enlace con familia y amigos!" },
            fr: { subject: `✨ ${pFirst} a partagé un aperçu de vos photos`, body: `${pFirst} a choisi ${imgCount} favorite${imgCount === 1 ? "" : "s"} de votre séance pendant que le reste de la galerie est en cours de retouche.`, expect: expStr ? `Votre galerie complète${details.num_photos ? ` de ~${details.num_photos} photos` : ""} est attendue vers le ${expStr}.` : "", cta: "Voir l’aperçu", share: "Partagez le lien avec votre famille et vos amis !" },
          }, loc);
          await sendEmail(
            details.client_email,
            T.subject,
            emailLayout(`
              <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1F1F1F;">✨ ${T.subject.replace("✨ ", "")}</h2>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${cFirst},</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
              ${T.expect ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#6B7280;">${T.expect}</p>` : ""}
              ${emailButton(peekUrl, T.cta)}
              <p style="margin:16px 0 0;font-size:13px;color:#9CA3AF;">${T.share}</p>
            `, loc)
          );
        }
      } catch (e) {
        console.error("[delivery/share_peek] email error:", e);
      }

      import("@/lib/telegram").then(({ sendTelegram }) =>
        sendTelegram(`✨ <b>Sneak peek shared</b>\nBooking: <code>${id.slice(0, 8)}</code>\nPhotos: ${imgCount}\n${peekUrl}`, "bookings")
      ).catch(() => {});

      return NextResponse.json({ success: true, peek_token: peekToken, peek_url: peekUrl, count: imgCount });
    }

    if (body.action === "share") {
      const password = body.password?.trim();
      if (!password || password.length < 4) {
        return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
      }

      const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : null;
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 1500) : null;

      // Don't let the photographer deliver fewer photos than the paid package
      // promised. The booking's package.num_photos is the agreed minimum.
      // Videos are extras and don't count toward the photo minimum (schema:
      // media_type 'image' for photos, 'video' for videos). If the booking has
      // no package / no num_photos (e.g. legacy or unassigned), we can't
      // enforce a number, so we skip the check.
      const pkg = await queryOne<{ num_photos: number | null }>(
        `SELECT p.num_photos
           FROM bookings b JOIN packages p ON p.id = b.package_id
          WHERE b.id = $1`,
        [id]
      );
      const requiredPhotos = pkg?.num_photos && Number(pkg.num_photos) > 0 ? Number(pkg.num_photos) : 0;
      const deliveredCnt = await queryOne<{ photos: string }>(
        `SELECT COUNT(*) FILTER (WHERE media_type <> 'video') AS photos
           FROM delivery_photos WHERE booking_id = $1`,
        [id]
      );
      const uploadedPhotos = parseInt(deliveredCnt?.photos || "0");
      if (requiredPhotos > 0) {
        if (uploadedPhotos < requiredPhotos) {
          return NextResponse.json({
            error: `This package includes ${requiredPhotos} photos, but you've added ${uploadedPhotos}. Upload at least ${requiredPhotos} photos before delivering to the client.`,
            code: "insufficient_photos",
            required: requiredPhotos,
            uploaded: uploadedPhotos,
          }, { status: 400 });
        }
      } else if (uploadedPhotos < 20 && body.confirm_small !== true) {
        // Blind/custom bookings carry no package minimum, which used to
        // disable the guard entirely. A tiny "full gallery" is almost always
        // a mistake — 2026-07-12: a photographer shared a 7-photo sneak peek
        // and 43 seconds later delivered the same 7 photos as the full
        // gallery; the client accepted and the payout auto-released. Force an
        // explicit second confirmation for small no-package deliveries.
        return NextResponse.json({
          error: `Only ${uploadedPhotos} photos are uploaded. If this is really the FULL gallery (not a sneak peek), confirm again.`,
          code: "small_delivery_confirm",
          uploaded: uploadedPhotos,
        }, { status: 409 });
      }

      // Generate delivery token and mark as delivered
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
      const { hash: bcryptHash } = await import("bcryptjs");
      const hashedPassword = await bcryptHash(password, 10);

      // Add 'delivered' to enum if not exists
      try {
        await queryOne("ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'delivered' AFTER 'completed'", []);
      } catch {}

      await queryOne(
        `UPDATE bookings
           SET status = 'delivered',
               delivery_token = $1, delivery_password = $2, delivery_password_plain = $3,
               delivery_expires_at = $4,
               delivery_title = $5, delivery_message = $6
         WHERE id = $7 RETURNING id`,
        [token, hashedPassword, password, expiresAt.toISOString(), title, message, id]
      );

      const deliveryUrl = `${BASE_URL}/delivery/${token}`;

      const photoCount = await queryOne<{ count: string }>(
        "SELECT COUNT(*) as count FROM delivery_photos WHERE booking_id = $1", [id]
      );
      const count = photoCount?.count || "0";

      // Auto-send message in booking chat with link + password
      try {

        await queryOne(
          `INSERT INTO messages (booking_id, sender_id, text, is_system) VALUES ($1, $2, $3, TRUE)`,
          [id, userId, `DELIVERY:${count}:${deliveryUrl}:${password}`]
        );
      } catch (e) {
        console.error("[delivery] chat message error:", e);
      }

      // Send email to client with gallery link and password
      try {
        const details = await queryOne<{ client_email: string; client_name: string; photographer_name: string }>(
          `SELECT u.email as client_email, u.name as client_name, pu.name as photographer_name
           FROM bookings b
           JOIN users u ON u.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           WHERE b.id = $1`, [id]
        );

        if (details) {
          const firstName = details.client_name?.split(" ")[0] || "there";
          await sendEmail(
            details.client_email,
            `${details.photographer_name} has uploaded your photo previews — please review`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Your Photo Previews Are Ready!</h2>
              <p>Hi ${firstName},</p>
              <p><strong>${details.photographer_name}</strong> has uploaded <strong>${count} photo previews</strong> from your session for you to review.</p>
              <p>Please take a moment to browse through them. The previews include a watermark — this is normal and will be removed once you approve the delivery.</p>

              <div style="margin: 20px 0; padding: 16px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                <p style="margin: 0 0 8px 0; font-weight: bold; color: #166534;">What to do:</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr><td style="padding: 4px 0; color: #166534; font-weight: bold; vertical-align: top;">1.</td><td style="padding: 4px 8px;">Open the gallery and review your photos</td></tr>
                  <tr><td style="padding: 4px 0; color: #166534; font-weight: bold; vertical-align: top;">2.</td><td style="padding: 4px 8px;">If you're happy, click <strong>"Accept Delivery"</strong></td></tr>
                  <tr><td style="padding: 4px 0; color: #166534; font-weight: bold; vertical-align: top;">3.</td><td style="padding: 4px 8px;">You'll get full-resolution photos without watermarks + a ZIP download</td></tr>
                </table>
              </div>

              <div style="margin: 16px 0; padding: 16px; background: #faf8f5; border-radius: 8px; border: 1px solid #e8e0d8;">
                <p style="margin: 0 0 4px 0; font-size: 13px; color: #5f4a3d;"><strong>Gallery Password:</strong></p>
                <p style="margin: 0; font-size: 24px; font-family: monospace; color: #C94536; letter-spacing: 3px;"><strong>${password}</strong></p>
              </div>

              <p><a href="${deliveryUrl}" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Review Your Photos</a></p>

              <p style="margin-top: 16px; font-size: 13px; color: #666;">Not happy with the results? You can report an issue directly from the gallery and our team will help resolve it within 48 hours.</p>
              <p style="font-size: 12px; color: #999;">This gallery is available until ${expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>
              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>`
          );
        }
      } catch (e) {
        console.error("[delivery] email error:", e);
      }

      // Notify client (SMS + push) about delivery
      try {
        const deliveryDetails = await queryOne<{
          client_id: string; client_phone: string | null; photographer_name: string;
        }>(
          `SELECT b.client_id, cu.phone as client_phone, pu.name as photographer_name
           FROM bookings b
           JOIN users cu ON cu.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           WHERE b.id = $1`,
          [id]
        );
        if (deliveryDetails?.client_phone) {
          const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
            "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
            [deliveryDetails.client_id]
          );
          if (smsPrefs?.sms_bookings !== false) {
            const { getUserLocaleById, pickT } = await import("@/lib/email-locale");
            const cLocale = await getUserLocaleById(deliveryDetails.client_id);
            const smsBody = pickT({
              en: `Photo Portugal: Your photos from ${deliveryDetails.photographer_name} are ready! Check your email for the gallery link.`,
              pt: `Photo Portugal: As suas fotos de ${deliveryDetails.photographer_name} estão prontas! Veja o link da galeria no seu email.`,
              de: `Photo Portugal: Ihre Fotos von ${deliveryDetails.photographer_name} sind bereit! Galerie-Link finden Sie in Ihrer E-Mail.`,
              fr: `Photo Portugal : Vos photos de ${deliveryDetails.photographer_name} sont prêtes ! Le lien de la galerie est dans votre e-mail.`,
            }, cLocale);
            sendSMS(
              deliveryDetails.client_phone,
              smsBody
            ).catch(err => console.error("[sms] error:", err));
          }
        }
        // Push to client — tap → booking detail (delivery card lives there)
        if (deliveryDetails?.client_id) {
          const photogFirst = (deliveryDetails.photographer_name || "").split(" ")[0] || "Your photographer";
          import("@/lib/push").then(m =>
            m.sendPushNotification(
              deliveryDetails.client_id,
              `📸 ${photogFirst} delivered your photos`,
              "Your gallery is ready — tap to view.",
              { type: "booking", bookingId: id, channelId: "bookings", categoryId: "DELIVERY" }
            )
          ).catch(err => console.error("[delivery] push error:", err));
          import("@/lib/realtime").then((m) =>
            m.notifyUser(deliveryDetails.client_id, "delivery_uploaded", { bookingId: id })
          );
        }
      } catch (smsErr) {
        console.error("[delivery] whatsapp/sms error:", smsErr);
      }

      // Telegram: notify admin of photo delivery
      try {
        const tgNames = await queryOne<{ photographer_name: string; client_name: string }>(
          `SELECT pu.name as photographer_name, cu.name as client_name
           FROM bookings b
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           JOIN users cu ON cu.id = b.client_id
           WHERE b.id = $1`, [id]
        );
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`🎁 <b>Photos Delivered!</b>\n\n${tgNames?.photographer_name || "Photographer"} delivered ${count} photos to ${tgNames?.client_name || "Client"}`, "bookings");
        }).catch((err) => console.error("[delivery] telegram error:", err));
      } catch {}

      return NextResponse.json({ success: true, token, deliveryUrl });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // File upload
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      const singleFile = formData.get("file") as File;
      if (singleFile) files.push(singleFile);
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Validate all files upfront before writing any to disk
    const ALLOWED_IMG_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif", "tiff"];
    const ALLOWED_VID_EXT = ["mp4", "mov", "webm", "m4v"];
    const rejectedFiles: string[] = [];

    function classify(file: File): "image" | "video" | null {
      const t = file.type || "";
      if (t.startsWith("image/")) return "image";
      if (t.startsWith("video/")) return "video";
      // Some browsers omit `type` for HEIC etc — fall back to extension.
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (ALLOWED_IMG_EXT.includes(ext)) return "image";
      if (ALLOWED_VID_EXT.includes(ext)) return "video";
      return null;
    }

    for (const file of files) {
      const kind = classify(file);
      if (!kind) {
        rejectedFiles.push(`"${file.name}" — unsupported file type (type: ${file.type || "unknown"})`);
        continue;
      }
      const rawExt = (file.name.split(".").pop() || "").toLowerCase();
      const allowedExt = kind === "video" ? ALLOWED_VID_EXT : ALLOWED_IMG_EXT;
      if (!rawExt || !allowedExt.includes(rawExt)) {
        rejectedFiles.push(`"${file.name}" — unsupported .${rawExt || "unknown"}. ${kind === "video" ? "Video formats" : "Photo formats"}: ${allowedExt.join(", ")}`);
        continue;
      }
      const sizeLimit = kind === "video" ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
      if (file.size > sizeLimit) {
        rejectedFiles.push(`"${file.name}" — file too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${kind === "video" ? "video" : "photo"}: ${sizeLimit / 1024 / 1024}MB`);
        continue;
      }
    }

    if (rejectedFiles.length === files.length) {
      return NextResponse.json({
        error: "All files were rejected",
        details: rejectedFiles,
      }, { status: 400 });
    }

    const currentCounts = await queryOne<{ total: string; videos: string }>(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE media_type = 'video') as videos
       FROM delivery_photos WHERE booking_id = $1`,
      [id]
    );
    let sortOrder = parseInt(currentCounts?.total || "0");
    let videoCount = parseInt(currentCounts?.videos || "0");

    if (sortOrder >= MAX_DELIVERY_PHOTOS) {
      return NextResponse.json({ error: `Delivery limit reached (max ${MAX_DELIVERY_PHOTOS} items)` }, { status: 403 });
    }

    // Pretty download filename builder. Strips spaces/diacritics from the
    // photographer's name, attaches the booking's short id (first 8 hex
    // chars of the UUID — uniquely identifies the session even if a
    // photographer has many deliveries), and a zero-padded sequence so
    // client downloads get
    //   PhotoPortugal_KateBelova_8938ac94_001.jpg
    // instead of the photographer's original `IMG_5821.HEIC`. Sequence
    // tracks the position WITHIN this delivery (sortOrder + 1) — gaps
    // can appear if the photographer deletes items, that's fine.
    const sanitizedPhotographer = (booking.photographer_name || "Photographer")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "");
    const bookingShort = id.replace(/-/g, "").slice(0, 8);
    function prettyDownloadName(seq: number, ext: string): string {
      const padded = String(seq).padStart(3, "0");
      return `PhotoPortugal_${sanitizedPhotographer}_${bookingShort}_${padded}.${ext}`;
    }

    // Per-file processing errors (S3 outage, sharp OOM, DB hiccup, etc.)
    // are collected here so we can:
    //   1. log them with full file context (name, size, kind) — makes it
    //      possible to grep logs when a photographer says "uploads kept
    //      failing" and we need to know why
    //   2. tell the client which specific files failed so the UI shows the
    //      real reason, not the generic "(likely too large)" guess
    //   3. ping admin (email + telegram) so we hear about it without
    //      waiting for the photographer to complain
    const processingErrors: { filename: string; size: number; kind: "image" | "video"; reason: string }[] = [];

    const uploaded = [];
    for (const file of files) {
      const kind = classify(file);
      if (!kind) continue;
      const rawExt = (file.name.split(".").pop() || "").toLowerCase();
      const allowedExt = kind === "video" ? ALLOWED_VID_EXT : ALLOWED_IMG_EXT;
      if (!rawExt || !allowedExt.includes(rawExt)) continue;
      const sizeLimit = kind === "video" ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
      if (file.size > sizeLimit) continue;
      if (kind === "video" && videoCount >= MAX_DELIVERY_VIDEOS) {
        rejectedFiles.push(`"${file.name}" — video limit reached (max ${MAX_DELIVERY_VIDEOS} per delivery)`);
        continue;
      }

      const ext = rawExt;
      const filename = `${crypto.randomUUID()}.${ext}`;
      const downloadName = prettyDownloadName(sortOrder + 1, ext);

      // Wrap the WHOLE per-file pipeline (buffer read → S3 upload →
      // preview generation → DB insert) so one bad file doesn't kill
      // the whole batch. arrayBuffer() itself can throw for corrupt
      // FormData blobs, so it's inside the try.
      try {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Upload original to R2
      const s3Key = `delivery/${id}/${filename}`;
      const contentType = file.type || (kind === "video" ? `video/${ext}` : `image/${ext}`);
      await uploadToS3(s3Key, buffer, contentType);
      const url = `s3://${s3Key}`;

      if (kind === "video") {
        // Process video: extract metadata + a poster thumbnail via ffmpeg.
        // The thumbnail acts as the gallery preview and the <video poster>;
        // we don't generate a watermarked preview track — videos download
        // as-is. (Watermarking via ffmpeg is doable but expensive at upload
        // time; the gallery is password-protected anyway.)
        let thumbnailUrl: string | null = null;
        let videoWidth: number | null = null;
        let videoHeight: number | null = null;
        let durationSeconds: number | null = null;
        try {
          const { processVideoUpload } = await import("@/lib/video-processor");
          const meta = await processVideoUpload(buffer, file.name);
          videoWidth = meta.width || null;
          videoHeight = meta.height || null;
          durationSeconds = meta.duration || null;
          const thumbS3Key = `delivery/${id}/thumb_${crypto.randomUUID()}.jpg`;
          await uploadToS3(thumbS3Key, meta.thumbnailBuffer, "image/jpeg");
          thumbnailUrl = `s3://${thumbS3Key}`;
        } catch (vidErr) {
          console.error("[delivery] video processing error:", vidErr);
          // Continue without thumbnail — gallery will fall back to a generic video icon.
        }

        const item = await queryOne<{ id: string }>(
          `INSERT INTO delivery_photos
             (booking_id, url, thumbnail_url, filename, file_size, sort_order, media_type, duration_seconds, width, height)
           VALUES ($1, $2, $3, $4, $5, $6, 'video', $7, $8, $9) RETURNING id`,
          [id, url, thumbnailUrl, downloadName, file.size, sortOrder++, durationSeconds, videoWidth, videoHeight]
        );
        videoCount++;

        const publicUrl = await getPresignedUrl(s3KeyFromPath(url), 3600);
        const publicThumb = thumbnailUrl ? await getPresignedUrl(s3KeyFromPath(thumbnailUrl), 3600) : null;
        uploaded.push({
          id: item?.id, url: publicUrl, thumbnail_url: publicThumb, filename: downloadName, file_size: file.size,
          media_type: "video", duration_seconds: durationSeconds, width: videoWidth, height: videoHeight,
        });
        continue;
      }

      // image branch — generate watermarked preview as before, PLUS a
      // clean 1200px thumbnail (no watermark) used by the gallery grid
      // after delivery is accepted. Without the clean thumb we'd either
      // (a) ship watermarked thumbnails to paying clients post-accept,
      // or (b) the previous "fall back to original" behaviour that
      // dragged 89×15MB into mobile Safari and OOM'd the page.
      let previewUrl: string | null = null;
      let cleanThumbUrl: string | null = null;
      try {
        const previewFilename = `preview_${crypto.randomUUID()}.jpg`;
        const watermarkPath = path.join(process.cwd(), "public", "icon-512.png");

        const { data: previewBuffer, info: previewInfo } = await sharp(buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .jpeg({ quality: 60 })
          .toBuffer({ resolveWithObject: true });

        // Upload the CLEAN 1200px buffer FIRST, before we composite the
        // watermark on top of it. Same pixels we already computed —
        // zero extra Sharp work, just one additional S3 PUT. Wrapped in
        // its own try so a failed clean-thumb upload doesn't poison
        // the (more important) watermarked preview path below.
        try {
          const thumbKey = `delivery/${id}/thumb_${crypto.randomUUID()}.jpg`;
          await uploadToS3(thumbKey, previewBuffer, "image/jpeg");
          cleanThumbUrl = `s3://${thumbKey}`;
        } catch (thumbErr) {
          console.error("[delivery] clean thumb upload error:", thumbErr);
        }

        const previewWidth = previewInfo.width || 1200;
        const previewHeight = previewInfo.height || 800;
        const wmSize = Math.min(previewWidth, previewHeight, 256);
        const watermark = await sharp(watermarkPath)
          .resize({ width: wmSize, height: wmSize, fit: "inside" })
          .ensureAlpha()
          .composite([{
            input: Buffer.from([255, 255, 255, Math.round(255 * 0.3)]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: "dest-in",
          }])
          .toBuffer();

        const previewFinal = await sharp(previewBuffer)
          .composite([{ input: watermark, gravity: "centre" }])
          .jpeg({ quality: 60 })
          .toBuffer();

        const previewS3Key = `delivery/${id}/${previewFilename}`;
        await uploadToS3(previewS3Key, previewFinal, "image/jpeg");
        previewUrl = `s3://${previewS3Key}`;
      } catch (previewErr) {
        console.error("[delivery] preview generation error:", previewErr);
      }

      const item = await queryOne<{ id: string }>(
        `INSERT INTO delivery_photos (booking_id, url, preview_url, thumbnail_url, filename, file_size, sort_order, media_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'image') RETURNING id`,
        [id, url, previewUrl, cleanThumbUrl, downloadName, file.size, sortOrder++]
      );

      const publicUrl = isS3Path(url) ? await getPresignedUrl(s3KeyFromPath(url), 3600) : url;
      uploaded.push({ id: item?.id, url: publicUrl, filename: downloadName, file_size: file.size, media_type: "image" });
      } catch (perFileErr) {
        // Per-file processing failure (S3, sharp, DB). Log with full
        // context so we can diagnose without the photographer having to
        // re-create the failure. Push to processingErrors and continue
        // — the rest of the batch should still go through.
        const reason = perFileErr instanceof Error ? perFileErr.message : String(perFileErr);
        console.error(`[delivery] per-file upload error: file="${file.name}" size=${file.size} kind=${kind} booking=${id} reason="${reason}"`, perFileErr);
        processingErrors.push({ filename: file.name, size: file.size, kind, reason });
        rejectedFiles.push(`"${file.name}" — upload failed (${reason.slice(0, 100)})`);
      }
    }

    // If anything failed at the per-file processing level (not just
    // size/MIME), surface it to admin so we hear about it without
    // waiting for the photographer to complain. Skipping when the only
    // failures are clean size/MIME rejections — those are user error,
    // not server error.
    if (processingErrors.length > 0) {
      import("@/lib/email").then(async ({ sendEmail, getAdminEmail }) => {
        const adminEmail = await getAdminEmail();
        const photographer = booking.photographer_name || "(unknown)";
        const lines = processingErrors.map((e) =>
          `<li><code>${e.filename}</code> — ${(e.size / 1024 / 1024).toFixed(1)}MB ${e.kind}: ${e.reason.replace(/[<>]/g, "")}</li>`
        ).join("");
        sendEmail(
          adminEmail,
          `[delivery upload] ${processingErrors.length} file(s) failed for ${photographer}`,
          `<div style="font-family: sans-serif; max-width: 600px;">
            <h2>Delivery upload — per-file failures</h2>
            <p><strong>Photographer:</strong> ${photographer}</p>
            <p><strong>Booking:</strong> <code>${id}</code></p>
            <p><strong>Outcome:</strong> ${uploaded.length} uploaded, ${processingErrors.length} failed</p>
            <ul>${lines}</ul>
            <p><a href="https://photoportugal.com/admin">Open admin →</a></p>
          </div>`
        ).catch((e) => console.error("[delivery] admin email error:", e));
      }).catch((e) => console.error("[delivery] admin email import error:", e));
      import("@/lib/telegram").then(({ sendTelegram }) => {
        const head = `⚠️ <b>Delivery upload failures</b>\n\n${booking.photographer_name || "(unknown)"} — ${processingErrors.length} file(s) failed, ${uploaded.length} ok`;
        const detail = processingErrors.slice(0, 5).map((e) =>
          `• <code>${e.filename}</code> (${(e.size / 1024 / 1024).toFixed(1)}MB): ${e.reason.replace(/[<>]/g, "").slice(0, 80)}`
        ).join("\n");
        sendTelegram(`${head}\n\n${detail}`, "alerts");
      }).catch((e) => console.error("[delivery] telegram error:", e));
    }

    return NextResponse.json({
      success: true,
      uploaded,
      count: uploaded.length,
      ...(rejectedFiles.length > 0 ? { rejected: rejectedFiles } : {}),
    });
  } catch (error) {
    console.error("[delivery] upload error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/bookings/:id/delivery", method: req.method, statusCode: 500 }); } catch {}
    // Top-level catch — fires when the WHOLE request failed (formData
    // parse, auth, DB connection blip etc.). Also alert admin so we
    // notice these silent infrastructure failures.
    try {
      const { sendEmail, getAdminEmail } = await import("@/lib/email");
      const adminEmail = await getAdminEmail();
      const msg = error instanceof Error ? error.message : String(error);
      sendEmail(
        adminEmail,
        `[delivery upload] Hard 500 on booking ${id}`,
        `<div style="font-family: sans-serif; max-width: 600px;">
          <h2>Delivery upload — hard failure</h2>
          <p><strong>Booking:</strong> <code>${id}</code></p>
          <p><strong>Error:</strong> ${msg.replace(/[<>]/g, "")}</p>
          <p>Photographer's whole upload batch was rejected. Check the photoportugal-blue logs for context.</p>
          <p><a href="https://photoportugal.com/admin">Open admin →</a></p>
        </div>`
      ).catch(() => {});
    } catch {}
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// DELETE: Remove a delivery photo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await authFromRequest(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = authUser.id;
  const { searchParams } = new URL(req.url);
  const photoId = searchParams.get("photoId");

  if (!photoId) return NextResponse.json({ error: "photoId required" }, { status: 400 });

  const booking = await queryOne<{ photographer_user_id: string; delivery_accepted: boolean }>(
    `SELECT u.id as photographer_user_id, COALESCE(b.delivery_accepted, FALSE) as delivery_accepted
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`, [id]
  );

  if (!booking || booking.photographer_user_id !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (booking.delivery_accepted) {
    return NextResponse.json({ error: "Delivery has been accepted by the client and can no longer be modified" }, { status: 400 });
  }

  const photo = await queryOne<{ url: string; preview_url: string | null }>(
    "DELETE FROM delivery_photos WHERE id = $1 AND booking_id = $2 RETURNING url, preview_url",
    [photoId, id]
  );

  if (photo) {
    await deleteDeliveryFile(photo.url);
    if (photo.preview_url) await deleteDeliveryFile(photo.preview_url);
  }

  return NextResponse.json({ success: true });
}

const R2_PUBLIC_PREFIX = "https://files.photoportugal.com/";

/**
 * Delete a delivery photo from whichever backend it lives on. Three forms
 * coexist during the migration window:
 *   - `s3://bucket/key` — early R2 uploads tagged with the s3 scheme
 *   - `https://files.photoportugal.com/key` — current R2 uploads + everything
 *     migrated from /uploads in stage 2
 *   - `/uploads/...` — leftover legacy rows on local disk
 * Best-effort: if any of these throw we swallow it so DB row deletion still
 * succeeds (orphan blob is a disk-space issue, not a correctness one).
 */
async function deleteDeliveryFile(url: string): Promise<void> {
  if (!url) return;
  try {
    if (isS3Path(url)) {
      await deleteFromS3(s3KeyFromPath(url));
    } else if (url.startsWith(R2_PUBLIC_PREFIX)) {
      await deleteFromS3(url.slice(R2_PUBLIC_PREFIX.length));
    } else if (url.startsWith("/uploads/")) {
      await unlink(path.join(UPLOAD_DIR, url.replace("/uploads/", "")));
    }
  } catch { /* swallow — orphan blob is acceptable */ }
}
