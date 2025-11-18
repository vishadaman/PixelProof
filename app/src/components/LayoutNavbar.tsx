// =============================================================================
// LAYOUT NAVBAR COMPONENT
// =============================================================================
// Simple navbar that shows authentication state
// - Signed in: Avatar/Name + "Projects" + "New Project" + "Sign out"
// - Signed out: "Sign in"

'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export function LayoutNavbar() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              PixelProof
            </span>
          </Link>

          {/* Right Side - Auth State */}
          <div className="flex items-center gap-4">
            {/* Loading State */}
            {loading && (
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            )}

            {/* Signed Out State */}
            {!loading && !session && (
              <Link
                href="/auth/signin"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Sign in
              </Link>
            )}

            {/* Signed In State */}
            {!loading && session && (
              <>
                {/* Projects Link */}
                <Link
                  href="/projects"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Projects
                </Link>

                {/* New Project Link */}
                <Link
                  href="/projects/new"
                  className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  New Project
                </Link>

                {/* User Info + Sign Out */}
                <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
                  {/* Avatar */}
                  {session.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      className="w-8 h-8 rounded-full ring-2 ring-gray-200"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                      </span>
                    </div>
                  )}

                  {/* Name */}
                  <span className="text-sm font-medium text-gray-900 hidden sm:inline">
                    {session.user?.name || session.user?.email?.split('@')[0] || 'User'}
                  </span>

                  {/* Sign Out Button */}
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

