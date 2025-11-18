// =============================================================================
// ENVIRONMENT VARIABLES VALIDATION
// =============================================================================
// This module validates and exports type-safe environment variables.
// Uses Zod for runtime validation to catch misconfigurations early.
//
// IMPORTANT: Only variables prefixed with NEXT_PUBLIC_ are exposed to the browser.
// Server-only variables (e.g., API keys) should NOT have this prefix.

import { z } from 'zod';

// -----------------------------------------------------------------------------
// SCHEMA DEFINITIONS
// -----------------------------------------------------------------------------

/**
 * Client-side environment variables (available in browser)
 * These are embedded at build time and cannot be changed without rebuilding
 */
const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
});

/**
 * Server-side environment variables (Node.js only)
 * These can include sensitive data like API keys
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // TODO: Add server-only secrets here
  // NEXTAUTH_SECRET: z.string().min(32),
  // NEXTAUTH_URL: z.string().url(),
  // DATABASE_URL: z.string().url().optional(),
});

// -----------------------------------------------------------------------------
// VALIDATION & EXPORT
// -----------------------------------------------------------------------------

/**
 * Validate client environment variables
 * This runs on both server and client
 */
const _clientEnv = clientSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!_clientEnv.success) {
  console.error('❌ Invalid client environment variables:', _clientEnv.error.flatten().fieldErrors);
  throw new Error('Invalid client environment variables');
}

/**
 * Validate server environment variables
 * This only runs on the server (Node.js)
 */
let _serverEnv: z.infer<typeof serverSchema>;

if (typeof window === 'undefined') {
  const parsed = serverSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    // Add other server vars here
  });

  if (!parsed.success) {
    console.error('❌ Invalid server environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid server environment variables');
  }

  _serverEnv = parsed.data;
} else {
  // On client, create a dummy object (these values won't be accessed)
  _serverEnv = {} as z.infer<typeof serverSchema>;
}

/**
 * Typed environment variables
 * Usage:
 *   import { env } from '@/lib/env';
 *   console.log(env.NEXT_PUBLIC_API_URL);
 */
export const env = {
  ..._clientEnv.data,
  ..._serverEnv,
} as const;

// Type-only export for use in other modules
export type Env = typeof env;

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/**
 * Check if we're in development mode
 */
export const isDev = env.NODE_ENV === 'development';

/**
 * Check if we're in production mode
 */
export const isProd = env.NODE_ENV === 'production';

/**
 * Check if we're running on the server
 */
export const isServer = typeof window === 'undefined';

/**
 * Check if we're running on the client
 */
export const isClient = typeof window !== 'undefined';

