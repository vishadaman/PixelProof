// =============================================================================
// NEXTAUTH TYPE DEFINITIONS
// =============================================================================
// Extend NextAuth types to include custom fields

import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
    accessToken?: string;
    provider?: string;
  }

  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    email?: string | null;
    accessToken?: string;
    provider?: string;
  }
}

