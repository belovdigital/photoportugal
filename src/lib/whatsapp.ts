import twilio from "twilio";
import { sendSMS } from "@/lib/sms";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+15559471898";

// Template SIDs mapped to event names
const TEMPLATES: Record<string, { sid: string; vars: number }> = {
  booking_confirmed:    { sid: "HX34411e36e91668702608fc2850339874", vars: 2 },
  new_message:          { sid: "HX80d159528e70ef29415973e4b66c96f6", vars: 1 },
  photos_delivered:     { sid: "HX15408f0e538f05d18fe87114e70dc333", vars: 1 },
  new_booking_request:  { sid: "HX2b194fd0a2d202cc71769128a70246b9", vars: 1 },
  shoot_reminder:       { sid: "HX6e11ae2e2fa132674d528e56d3adf7e4", vars: 1 },
  payment_received:     { sid: "HXea3d6a4e9b9c4948a072297ac08352fc", vars: 2 },
  profile_approved:     { sid: "HX14259461edffe78f6040fb300a9304d0", vars: 0 },
  admin_new_booking:    { sid: "HXac36b1be25adfe7773e7dceffbbac15e", vars: 3 },
};

/**
 * Send a WhatsApp template message. Falls back to SMS on failure.
 * @param to - Phone number (e.g. "+351912345678")
 * @param template - Template name from TEMPLATES
 * @param variables - Template variable values in order
 * @param smsFallbackText - Text to send via SMS if WhatsApp fails
 */
export async function sendWhatsApp(
  to: string,
  template: keyof typeof TEMPLATES,
  variables: string[],
  smsFallbackText: string
): Promise<"whatsapp" | "sms" | false> {
  if (!accountSid || !authToken) {
    console.warn("[whatsapp] Twilio not configured");
    return false;
  }

  const tmpl = TEMPLATES[template];
  if (!tmpl) {
    console.warn(`[whatsapp] Unknown template "${template}", falling back to SMS`);
    const sent = await sendSMS(to, smsFallbackText);
    return sent ? "sms" : false;
  }

  try {
    const client = twilio(accountSid, authToken);

    const contentVariables: Record<string, string> = {};
    variables.forEach((v, i) => {
      contentVariables[String(i + 1)] = v;
    });

    await client.messages.create({
      to: `whatsapp:${to}`,
      from: whatsappFrom.startsWith("whatsapp:") ? whatsappFrom : `whatsapp:${whatsappFrom}`,
      contentSid: tmpl.sid,
      contentVariables: JSON.stringify(contentVariables),
    });

    console.log(`[whatsapp] Sent "${template}" to ${to}`);
    return "whatsapp";
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    // 63016 = template not approved or outside session window without template
    // 63001 = channel not enabled
    // 63003 = outside 24h window
    console.warn(`[whatsapp] Failed "${template}" to ${to}: ${err.code} ${err.message || ""}. Falling back to SMS.`);

    const sent = await sendSMS(to, smsFallbackText);
    return sent ? "sms" : false;
  }
}

/**
 * Send WhatsApp to all admin phones with SMS fallback.
 */
export async function sendAdminWhatsApp(
  template: keyof typeof TEMPLATES,
  variables: string[],
  smsFallbackText: string
) {
  const { getAdminPhones } = await import("@/lib/sms");
  const phones = await getAdminPhones();
  for (const phone of phones) {
    sendWhatsApp(phone, template, variables, smsFallbackText).catch(err =>
      console.error("[admin-whatsapp] error:", err)
    );
  }
}
