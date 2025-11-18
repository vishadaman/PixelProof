// =============================================================================
// NAVBAR COMPONENT
// =============================================================================
// Main navigation bar with logo, links, and user menu

'use client';

import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';

export function Navbar() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              {/* TODO: Add actual logo */}
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                PixelProof
              </span>
            </Link>

            {/* Main Navigation */}
            <div className="hidden md:flex items-center ml-10 gap-6">
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/projects">Projects</NavLink>
              <NavLink href="/runs">Runs</NavLink>
              <NavLink href="/findings">Findings</NavLink>
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Trigger Run Button */}
            {session && (
              <button className="btn-primary text-sm">
                + New Run
              </button>
            )}

            {/* User Menu */}
            {loading && (
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            )}

            {!loading && !session && (
              <button
                onClick={() => signIn()}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Sign In
              </button>
            )}

            {!loading && session && (
              <div className="flex items-center gap-3">
                {/* User Info */}
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {session.user?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
                
                <div className="hidden md:block text-sm">
                  <div className="font-medium text-gray-900">
                    {session.user?.name || 'User'}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {session.user?.email}
                  </div>
                </div>

                {/* Sign Out */}
                <button
                  onClick={() => signOut()}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// -----------------------------------------------------------------------------
// NAV LINK COMPONENT
// -----------------------------------------------------------------------------

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

function NavLink({ href, children }: NavLinkProps) {
  // TODO: Use usePathname() from next/navigation to highlight active link
  return (
    <Link
      href={href}
      className="text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm"
    >
      {children}
    </Link>
  );
}

