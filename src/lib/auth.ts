import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { queryOne, query } from "./db";

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

        const user = await queryOne<{
          id: string;
          email: string;
          name: string;
          password_hash: string;
          role: string;
          avatar_url: string | null;
        }>(
          "SELECT id, email, name, password_hash, role, avatar_url FROM users WHERE email = $1",
          [credentials.email]
        );

        if (!user || !user.password_hash) return null;

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
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      const productionUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || baseUrl;
      // Relative URLs — prefix with production URL
      if (url.startsWith("/")) return `${productionUrl}${url}`;
      // Same origin — allow
      try {
        if (new URL(url).origin === new URL(productionUrl).origin) return url;
      } catch {}
      return productionUrl;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email;
        if (!email) return false;

        // Check if user exists
        const existing = await queryOne<{ id: string; role: string }>(
          "SELECT id, role FROM users WHERE email = $1",
          [email]
        );

        if (existing) {
          // Update google_id if not set
          await query(
            "UPDATE users SET google_id = COALESCE(google_id, $1), avatar_url = COALESCE(avatar_url, $2), email_verified = TRUE WHERE email = $3",
            [account.providerAccountId, user.image, email]
          );
        } else {
          // New user — will be created with default 'client' role
          // They can choose role on the onboarding page
          await query(
            "INSERT INTO users (email, name, google_id, avatar_url, role, email_verified) VALUES ($1, $2, $3, $4, 'client', TRUE)",
            [email, user.name, account.providerAccountId, user.image]
          );
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // Fresh login — get role from DB
        const dbUser = await queryOne<{ id: string; role: string }>(
          "SELECT id, role FROM users WHERE email = $1",
          [user.email!]
        );
        if (dbUser) {
          token.role = dbUser.role;
          token.id = dbUser.id;
        }
      }
      // Allow role update via update() call
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    newUser: "/auth/onboarding",
  },
  session: {
    strategy: "jwt",
  },
});
