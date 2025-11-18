// =============================================================================
// API STATUS ENDPOINT
// =============================================================================
// Simple health check endpoint to verify the Next.js API routes are working.
// This is useful for monitoring and debugging.

import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic'; // Disable static optimization for this route

/**
 * GET /api/status
 * Returns basic health check information
 */
export async function GET() {
  try {
    // TODO: Add more health checks here:
    // - Ping the FastAPI backend
    // - Check database connectivity (if we add a DB client to Next.js)
    // - Check Redis connectivity
    // - Check S3 connectivity

    const response = {
      ok: true,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      services: {
        frontend: 'healthy',
        // TODO: Check backend health
        // backend: await checkBackendHealth(),
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        ok: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Check if the FastAPI backend is healthy
 * TODO: Implement this when we have the backend running
 */
async function checkBackendHealth(): Promise<string> {
  try {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Don't cache health checks
      cache: 'no-store',
    });

    if (!response.ok) {
      return 'unhealthy';
    }

    const data = await response.json();
    return data.status === 'ok' ? 'healthy' : 'unhealthy';
  } catch (error) {
    console.error('Backend health check failed:', error);
    return 'unreachable';
  }
}

