// =============================================================================
// HOME PAGE
// =============================================================================
// Landing page with different views for authenticated vs unauthenticated users

'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function HomePage() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Unauthenticated: Hero with "Sign in" CTA
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-6xl font-bold text-gray-900 mb-6">
              Automated Design QA for Your Web Apps
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Catch visual regressions, accessibility issues, and design system violations 
              before they ship. Compare Figma designs against live implementations automatically.
            </p>
            
            {/* Sign In CTA */}
            <Link
              href="/auth/signin"
              className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Sign In to Get Started
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated: Show "New Project" button
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome back, {session.user?.name || 'User'}! 👋
          </h1>
          <p className="text-xl text-gray-600 mb-10">
            Ready to create a new project?
          </p>
          
          {/* New Project Button */}
          <Link
            href="/projects/new"
            className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            <svg className="mr-2 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Link>
          
          {/* Or view projects link */}
          <div className="mt-6">
            <Link
              href="/projects"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              or view all projects →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
