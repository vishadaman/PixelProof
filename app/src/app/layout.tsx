// =============================================================================
// ROOT LAYOUT
// =============================================================================
// This is the root layout for the Next.js App Router.
// All pages are wrapped with this layout and SessionProvider.

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { LayoutNavbar } from '@/components/LayoutNavbar';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PixelProof - Design QA Automation',
  description: 'Automated visual regression testing and design system compliance for web applications',
  keywords: ['design qa', 'visual regression', 'accessibility', 'figma', 'testing'],
  authors: [{ name: 'PixelProof Team' }],
  // TODO: Add OpenGraph and Twitter card metadata for production
  // openGraph: {
  //   title: 'PixelProof',
  //   description: '...',
  //   images: ['/og-image.png'],
  // },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 antialiased">
        {/* Wrap everything in SessionProvider */}
        <Providers>
          {/* Simple Navbar showing auth state */}
          <LayoutNavbar />
          {/* Main content */}
          {children}
        </Providers>
      </body>
    </html>
  );
}

