import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { db } from "@/db";
import { leaders } from "@/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const existing = await db
        .select()
        .from(leaders)
        .where(eq(leaders.email, user.email))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(leaders).values({
          email: user.email,
          name: user.name ?? null,
        });
      }

      return true;
    },
    async session({ session }) {
      if (!session.user.email) return session;

      const leader = await db
        .select()
        .from(leaders)
        .where(eq(leaders.email, session.user.email))
        .limit(1);

      if (leader.length > 0) {
        session.user.id = leader[0].id;
      }

      return session;
    },
  },
});