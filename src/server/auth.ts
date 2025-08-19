import { getServerSession, type NextAuthOptions } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "~/server/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "~/server/db/schema";
import { env } from "~/env";
import { eq } from "drizzle-orm";

export const ADMIN_EMAILS = (env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Use database sessions since we created the table
  session: { strategy: "database" },
  secret: env.AUTH_SECRET,
  providers: [
    GitHub({
      clientId: env.GITHUB_ID || "",
      clientSecret: env.GITHUB_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
    Google({
      clientId: env.GOOGLE_ID || "",
      clientSecret: env.GOOGLE_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // expose role on session.user
      if (session.user) {
        (session.user as any).id = user.id;
        (session.user as any).role = (user as any).role || "user";
      }
      return session;
    },
    async signIn({ user }) {
      // auto-elevate to admin if email matches list
      const email = user.email || "";
      if (email && ADMIN_EMAILS.includes(email)) {
        try {
          await db
            .update(users)
            .set({ role: "admin" })
            .where(eq(users.id, user.id as string));
        } catch {
          // noop
        }
      }
      return true;
    },
  },
};

export const getServerAuth = () => getServerSession(authOptions);
