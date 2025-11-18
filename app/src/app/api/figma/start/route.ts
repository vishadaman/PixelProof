// =============================================================================
// FIGMA OAUTH START ROUTE
// =============================================================================
// Initiates Figma OAuth flow by redirecting user to Figma authorization page
// This allows users to connect their Figma files to projects

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { z } from 'zod';

// Validation schema for query parameters
const startQuerySchema = z.object({
  projectId: z.string().cuid('Invalid project ID').optional(),
  returnTo: z.string().optional(),
});

/**
 * GET /api/figma/start
 * 
 * Starts the Figma OAuth flow by redirecting to Figma's authorization endpoint.
 * Required environment variables:
 * - FIGMA_CLIENT_ID: Your Figma OAuth app client ID
 * - FIGMA_REDIRECT_URI: The callback URL (should be http://localhost:3000/api/figma/callback)
 * 
 * Query params:
 * - projectId (optional): Project ID to associate with Figma credentials
 * - returnTo (optional): URL to redirect to after OAuth completes (default: /projects)
 */
export async function GET(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryValidation = startQuerySchema.safeParse({
      projectId: searchParams.get('projectId'),
      returnTo: searchParams.get('returnTo'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryValidation.error.errors },
        { status: 400 }
      );
    }

    const { projectId, returnTo } = queryValidation.data;

    // Get environment variables
    const clientId = process.env.FIGMA_CLIENT_ID;
    const redirectUri = process.env.FIGMA_REDIRECT_URI || 'http://localhost:3000/api/figma/callback';

    // Validate required config
    if (!clientId) {
      return NextResponse.json(
        { error: 'FIGMA_CLIENT_ID not configured' },
        { status: 500 }
      );
    }

    // Build state object containing CSRF token and projectId
    // This gets passed to Figma and returned in the callback
    const csrfToken = randomBytes(32).toString('hex');
    const statePayload = {
      csrf: csrfToken,
      ...(projectId && { projectId }), // Include projectId if provided
    };
    
    // Encode state as URL-safe base64 JSON
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
    
    // Store CSRF token in cookie for validation in callback
    // This prevents CSRF attacks by ensuring the callback came from our redirect
    const cookieStore = cookies();
    cookieStore.set('figma_oauth_csrf', csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    // Store returnTo URL if provided (where to redirect after OAuth completes)
    const finalReturnTo = returnTo || (projectId ? `/projects/${projectId}/settings` : '/projects');
    cookieStore.set('figma_oauth_return_to', finalReturnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    // Build Figma OAuth authorization URL
    // Documentation: https://www.figma.com/developers/api#oauth2
    const figmaAuthUrl = new URL('https://www.figma.com/oauth');
    figmaAuthUrl.searchParams.set('client_id', clientId);
    figmaAuthUrl.searchParams.set('redirect_uri', redirectUri);
    figmaAuthUrl.searchParams.set('scope', 'file_content:read'); // Read access to files (includes variables and styles)
    figmaAuthUrl.searchParams.set('response_type', 'code'); // Authorization code flow
    figmaAuthUrl.searchParams.set('state', state); // CSRF protection + projectId

    // Redirect user to Figma authorization page
    return NextResponse.redirect(figmaAuthUrl.toString());
    
  } catch (error) {
    console.error('Error starting Figma OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Figma OAuth' },
      { status: 500 }
    );
  }
}
