// =============================================================================
// NEXTAUTH API ROUTE
// =============================================================================
// Handles all authentication routes: /api/auth/*
// Supports GitHub and Bitbucket OAuth providers

import NextAuth, { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// NextAuth configuration
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  
  providers: [
    // GitHub OAuth Provider
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),
    
    // Bitbucket OAuth Provider (Custom)
    // Callback route: /api/auth/callback/bitbucket (handled by NextAuth)
    {
      id: "bitbucket",
      name: "Bitbucket",
      type: "oauth",
      authorization: {
        url: "https://bitbucket.org/site/oauth2/authorize",
        params: {
          scope: "account email", // Profile and email access
        },
      },
      token: "https://bitbucket.org/site/oauth2/access_token",
      userinfo: "https://api.bitbucket.org/2.0/user",
      profile(profile: any) {
        return {
          id: profile.uuid || profile.account_id,
          name: profile.display_name,
          email: profile.email,
          image: profile.links?.avatar?.href,
        };
      },
      clientId: process.env.BITBUCKET_CLIENT_ID || "",
      clientSecret: process.env.BITBUCKET_CLIENT_SECRET || "",
    },
  ],
  
  // Custom pages
  pages: {
    signIn: "/auth/signin",
  },
  
  // Callbacks for profile/email normalization
  callbacks: {
    // Called when JWT is created or updated
    async jwt({ token, user, account, profile }) {
      // Add user ID to token on first sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      
      // Add OAuth access token to JWT (useful for API calls to GitHub/Bitbucket)
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      
      // Normalize profile data
      if (profile) {
        // GitHub and Bitbucket have different profile structures
        // Ensure we have consistent email/name
        token.email = token.email || profile.email || null;
      }
      
      return token;
    },
    
    // Called whenever session is checked
    async session({ session, token }) {
      // Add user ID, access token, and provider to session
      if (token && session.user) {
        session.user.id = token.id as string;
        (session as any).accessToken = token.accessToken;
        (session as any).provider = token.provider;
      }
      
      return session;
    },
  },
  
  // Session strategy (JWT works better with serverless)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // Secret for JWT signing
  secret: process.env.NEXTAUTH_SECRET,
  
  // Enable debug in development
  debug: process.env.NODE_ENV === "development",
};

// Create NextAuth handler
const handler = NextAuth(authOptions);

// Export as GET and POST handlers for App Router
export { handler as GET, handler as POST };


