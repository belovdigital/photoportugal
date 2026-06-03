import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { queryOne, query } from "./db";
import { sendWelcomeEmail } from "./email";


export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { prompt: "select_account" } },
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await queryOne<{
            id: string;
            email: string;
            name: string;
            password_hash: string;
            role: string;
            avatar_url: string | null;
            is_banned: boolean;
            email_verified: boolean;
          }>(
            "SELECT id, email, name, password_hash, role, avatar_url, COALESCE(is_banned, FALSE) as is_banned, COALESCE(email_verified, FALSE) as email_verified FROM users WHERE email = $1",
            [credentials.email]
          );

          if (!user || !user.password_hash) return null;
          if (user.is_banned) {
            throw new Error("Your account has been deactivated. Please contact support at info@photoportugal.com");
          }
          if (!user.email_verified) {
            throw new Error("Please verify your email address. Check your inbox for the verification link.");
          }

          const passwordMatch = await compare(
            credentials.password as string,
            user.password_hash
          );
          if (!passwordMatch) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.avatar_url,
          };
        } catch (error) {
          console.error("[auth] credentials authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async redirect({ url }) {
      const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";
      if (url.startsWith("/")) return `${base}${url}`;
      try {
        if (new URL(url).origin === new URL(base).origin) return url;
      } catch {}
      return base;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email;
        if (!email) return false;

        try {
          const existing = await queryOne<{ id: string; role: string; is_banned: boolean }>(
            "SELECT id, role, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE email = $1",
            [email]
          );

          // Upgrade Google's default 96-pixel avatar to 500-pixel so it
          // doesn't look pixelated in chat/zoom.
          const { normalizeAvatarUrl } = await import("@/lib/avatar-url");
          const avatarUrl = normalizeAvatarUrl(user.image);

          if (existing) {
            if (existing.is_banned) return false;
            await query(
              "UPDATE users SET google_id = COALESCE(google_id, $1), avatar_url = COALESCE(avatar_url, $2), email_verified = TRUE WHERE email = $3",
              [account.providerAccountId, avatarUrl, email]
            );
          } else {
            const nameParts = (user.name || "").split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";
            await query(
              "INSERT INTO users (email, name, first_name, last_name, google_id, avatar_url, role, email_verified) VALUES ($1, $2, $3, $4, $5, $6, NULL, TRUE)",
              [email, user.name, firstName, lastName, account.providerAccountId, avatarUrl]
            );
            // Welcome email + admin notification fire IMMEDIATELY now (used
            // to wait for set-role to avoid client→photographer dupes, but
            // that delayed Telegram pings by hours/days when users dropped
            // off the onboarding screen). The set-role endpoint now sends
            // a SECOND "Role changed to Photographer" alert only when the
            // user actually picks photographer — clients (95% case) stay
            // with the single instant ping they get here.
            const newUser = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
            if (newUser) {
              query("INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [newUser.id]).catch(() => {});
              import("@/lib/email").then(({ sendWelcomeEmail, sendAdminNewClientNotification }) => {
                sendWelcomeEmail(email, user.name || "there", "client").catch((err) =>
                  console.error("[auth] Google welcome email error:", err)
                );
                sendAdminNewClientNotification(user.name || "Unknown", email).catch((err) =>
                  console.error("[auth] Google admin email error:", err)
                );
              }).catch(() => {});
              import("@/lib/telegram").then(({ sendTelegram }) => {
                sendTelegram(`👤 <b>New Client (Google)</b>\n\n<b>Name:</b> ${user.name || "Unknown"}\n<b>Email:</b> ${email}`, "clients");
              }).catch((err) => console.error("[auth] Google telegram error:", err));
              query("UPDATE users SET admin_notified = TRUE WHERE id = $1", [newUser.id]).catch(() => {});
            }
          }
        } catch (error) {
          console.error("[auth] Google signIn DB error:", error);
          // Still allow sign-in even if DB update fails
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        try {
          const dbUser = await queryOne<{ id: string; role: string | null; is_banned: boolean }>(
            "SELECT id, role, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE email = $1",
            [user.email!]
          );
          if (dbUser) {
            token.role = dbUser.role;
            token.id = dbUser.id;
          }
        } catch (error) {
          console.error("[auth] jwt DB error:", error);
          token.role = null;
        }
      }
      // Always verify user still exists, isn't banned, and sync role from DB
      if (token.id) {
        try {
          const exists = await queryOne<{ id: string; role: string | null; is_banned: boolean }>(
            "SELECT id, role, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE id = $1",
            [token.id as string]
          );
          if (!exists || exists.is_banned) {
            return { ...token, expired: true };
          }
          // Keep role in sync with DB (handles admin role changes)
          if (exists.role && exists.role !== token.role) {
            token.role = exists.role;
          }
        } catch {}
      }
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      return token;
    },
    async session({ session, token }) {
      if ((token as { expired?: boolean }).expired) {
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        (session.user as { role?: string | null }).role = token.role as string | null;
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
});
