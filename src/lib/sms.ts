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
  } catch (error) {
    console.error("[sms] Failed to send SMS:", error);
    return false;
  }
}
