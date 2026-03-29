import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { queryOne, query } from "./db";
import { sendWelcomeEmail, sendAdminNewClientNotification } from "./email";


export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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

          if (existing) {
            if (existing.is_banned) return false;
            await query(
              "UPDATE users SET google_id = COALESCE(google_id, $1), avatar_url = COALESCE(avatar_url, $2), email_verified = TRUE WHERE email = $3",
              [account.providerAccountId, user.image, email]
            );
          } else {
            const nameParts = (user.name || "").split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";
            await query(
              "INSERT INTO users (email, name, first_name, last_name, google_id, avatar_url, role, email_verified) VALUES ($1, $2, $3, $4, $5, $6, 'client', TRUE)",
              [email, user.name, firstName, lastName, account.providerAccountId, user.image]
            );
            // Send welcome + admin notification for new Google sign-ups
            // If user goes through set-role as photographer, photographer notification will also be sent there
            sendWelcomeEmail(email, user.name || "there", "client").catch((err) =>
              console.error("[auth] Failed to send welcome email:", err)
            );
            sendAdminNewClientNotification(user.name || "Unknown", email).catch((err) =>
              console.error("[auth] Failed to send admin client notification:", err)
            );
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
          const dbUser = await queryOne<{ id: string; role: string; is_banned: boolean }>(
            "SELECT id, role, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE email = $1",
            [user.email!]
          );
          if (dbUser) {
            token.role = dbUser.role;
            token.id = dbUser.id;
          }
        } catch (error) {
          console.error("[auth] jwt DB error:", error);
          token.role = "client";
        }
      }
      // Always verify user still exists and isn't banned
      if (token.id) {
        try {
          const exists = await queryOne<{ id: string; is_banned: boolean }>(
            "SELECT id, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE id = $1",
            [token.id as string]
          );
          if (!exists || exists.is_banned) {
            return { ...token, expired: true };
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
        (session.user as { role?: string }).role = token.role as string;
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
