import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!accountSid || !authToken || !phoneNumber) {
    console.warn("[sms] Twilio not configured — missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER");
    return false;
  }

  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      body: message,
      from: phoneNumber,
      to,
    });
    console.log(`[sms] Sent SMS to ${to}`);
    return true;
  } catch (error: unknown) {
    // Parse Twilio-specific error codes for better diagnostics
    const twilioError = error as { code?: number; status?: number; message?: string };
    if (twilioError.code === 21211) {
      console.warn(`[sms] Invalid phone number "${to}" — Twilio error 21211. Message not sent.`);
    } else if (twilioError.code === 21614) {
      console.warn(`[sms] Phone "${to}" is not SMS-capable — Twilio error 21614. Message not sent.`);
    } else if (twilioError.status === 429) {
      console.error(`[sms] CRITICAL: Twilio rate limit hit (429) sending to "${to}". Check usage and limits.`);
    } else {
      console.error(`[sms] Failed to send SMS to "${to}":`, twilioError.code || "", twilioError.message || error);
    }
    return false;
  }
}
