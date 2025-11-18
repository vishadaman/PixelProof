// =============================================================================
// MIDDLEWARE - AUTH GUARD
// =============================================================================
// Protects routes that require authentication
// Redirects unauthenticated users to the sign-in page

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  // This function is called if the user IS authenticated
  function middleware(req) {
    // You can add additional logic here if needed
    // For example, role-based access control
    return NextResponse.next();
  },
  {
    callbacks: {
      // This callback determines if the user is authorized
      // Return true to allow access, false to redirect to sign-in
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

// Configure which routes require authentication
export const config = {
  matcher: [
    // Protect these routes
    '/dashboard/:path*',
    '/projects/:path*',
    '/runs/:path*',
    '/findings/:path*',
    '/settings/:path*',
    
    // Note: The home page (/) is public and handled separately
    // API routes under /api/auth/* are excluded by default
  ],
};

