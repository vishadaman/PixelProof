// =============================================================================
// FIGMA OAUTH CALLBACK ROUTE
// =============================================================================
// Handles the OAuth callback from Figma after user authorizes the app
// Exchanges authorization code for access/refresh tokens and stores them securely

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const callbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  error: z.string().nullish(), // Can be null or undefined
  error_description: z.string().nullish(), // Can be null or undefined
});

const statePayloadSchema = z.object({
  csrf: z.string().min(1),
  projectId: z.string().cuid().optional(),
});

const figmaTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(), // seconds until expiry
  token_type: z.literal('Bearer').optional(),
  user_id: z.string().optional(),
});

// =============================================================================
// MAIN HANDLER
// =============================================================================

/**
 * GET /api/figma/callback
 * 
 * Figma redirects here after user authorizes (or denies) access.
 * We receive an authorization code that must be exchanged for access/refresh tokens.
 * 
 * Query params from Figma:
 * - code: Authorization code to exchange for tokens
 * - state: Base64-encoded JSON containing { csrf, projectId? }
 * - error: Present if user denied access (e.g., "access_denied")
 * - error_description: Human-readable error description
 */
export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  
  try {
    // =============================================================================
    // 1. PARSE AND VALIDATE QUERY PARAMETERS
    // =============================================================================
    
    const searchParams = request.nextUrl.searchParams;
    const queryValidation = callbackQuerySchema.safeParse({
      code: searchParams.get('code'),
      state: searchParams.get('state'),
      error: searchParams.get('error'),
      error_description: searchParams.get('error_description'),
    });

    // Get stored values from cookies
    const storedCsrf = cookieStore.get('figma_oauth_csrf')?.value;
    const returnTo = cookieStore.get('figma_oauth_return_to')?.value || '/projects';

    // Clear OAuth cookies (they're single-use)
    cookieStore.delete('figma_oauth_csrf');
    cookieStore.delete('figma_oauth_return_to');

    // Handle user denial
    if (searchParams.get('error')) {
      const errorMsg = searchParams.get('error_description') || searchParams.get('error') || 'unknown';
      console.log('User denied Figma OAuth:', errorMsg);
      return NextResponse.redirect(
        new URL(`${returnTo}?figma=error&message=${encodeURIComponent(errorMsg)}`, request.url)
      );
    }

    // Validate query parameters
    if (!queryValidation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid callback parameters', 
          details: queryValidation.error.errors,
        },
        { status: 400 }
      );
    }

    const { code, state } = queryValidation.data;

    // =============================================================================
    // 2. DECODE AND VALIDATE STATE PARAMETER
    // =============================================================================

    let statePayload: z.infer<typeof statePayloadSchema>;
    try {
      const decodedState = Buffer.from(state, 'base64url').toString('utf-8');
      const parsedState = JSON.parse(decodedState);
      const stateValidation = statePayloadSchema.safeParse(parsedState);
      
      if (!stateValidation.success) {
        throw new Error('Invalid state payload structure');
      }
      
      statePayload = stateValidation.data;
    } catch (error) {
      console.error('Failed to decode state parameter');
      return NextResponse.json(
        { error: 'Invalid state parameter format' },
        { status: 400 }
      );
    }

    // Validate CSRF token (must match stored cookie)
    if (statePayload.csrf !== storedCsrf) {
      console.error('CSRF token mismatch - possible attack');
      return NextResponse.json(
        { error: 'Invalid state parameter (CSRF protection failed)' },
        { status: 400 }
      );
    }

    // =============================================================================
    // 3. VALIDATE USER SESSION
    // =============================================================================

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'User not authenticated. Please sign in.' },
        { status: 401 }
      );
    }

    // =============================================================================
    // 4. VALIDATE PROJECT (if projectId provided)
    // =============================================================================

    if (statePayload.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: statePayload.projectId },
        include: {
          org: {
            include: {
              memberships: {
                where: { userId: session.user.id },
              },
            },
          },
        },
      });

      if (!project) {
        return NextResponse.redirect(
          new URL(`/projects?figma=error&message=${encodeURIComponent('Project not found')}`, request.url)
        );
      }

      // Check if user has access to this project's organization
      if (project.org.memberships.length === 0) {
        return NextResponse.redirect(
          new URL(`/projects?figma=error&message=${encodeURIComponent('Access denied to this project')}`, request.url)
        );
      }
    }

    // =============================================================================
    // 5. EXCHANGE AUTHORIZATION CODE FOR TOKENS
    // =============================================================================

    const clientId = process.env.FIGMA_CLIENT_ID;
    const clientSecret = process.env.FIGMA_CLIENT_SECRET;
    const redirectUri = process.env.FIGMA_REDIRECT_URI || 'http://localhost:3000/api/figma/callback';

    // Validate environment variables
    if (!clientId || !clientSecret) {
      console.error('Missing required Figma OAuth environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: Figma OAuth not properly configured' },
        { status: 500 }
      );
    }

    // Make token exchange request to Figma
    const tokenResponse = await fetch('https://www.figma.com/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Figma token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorBody: errorText, // Log the actual error from Figma
        clientId: clientId?.substring(0, 8) + '...', // Partial for debugging
      });
      return NextResponse.redirect(
        new URL(`${returnTo}?figma=error&message=${encodeURIComponent('Failed to exchange authorization code')}`, request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const tokenValidation = figmaTokenResponseSchema.safeParse(tokenData);

    if (!tokenValidation.success) {
      console.error('Invalid token response from Figma:', tokenValidation.error.errors);
      return NextResponse.redirect(
        new URL(`${returnTo}?figma=error&message=${encodeURIComponent('Invalid response from Figma')}`, request.url)
      );
    }

    const { access_token, refresh_token, expires_in } = tokenValidation.data;

    // =============================================================================
    // 6. STORE TOKENS IN DATABASE
    // =============================================================================

    // Calculate token expiration timestamp
    const accessTokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Encrypt tokens before storing (if ENCRYPTION_KEY is set)
    let encryptedAccessToken = access_token;
    let encryptedRefreshToken = refresh_token;

    if (process.env.ENCRYPTION_KEY) {
      try {
        encryptedAccessToken = encrypt(access_token);
        encryptedRefreshToken = encrypt(refresh_token);
      } catch (error) {
        console.error('Failed to encrypt tokens, storing as-is', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (statePayload.projectId) {
      // Store/update credentials for specific project
      await prisma.figmaCredential.upsert({
        where: { projectId: statePayload.projectId },
        create: {
          projectId: statePayload.projectId,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          accessTokenExpiresAt,
        },
        update: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          accessTokenExpiresAt,
          updatedAt: new Date(),
        },
      });

      console.log('Figma credentials stored successfully', {
        projectId: statePayload.projectId,
        userId: session.user.id,
        expiresAt: accessTokenExpiresAt.toISOString(),
      });

      // Redirect to project settings page
      return NextResponse.redirect(
        new URL(`/projects/${statePayload.projectId}/settings?figma=connected`, request.url)
      );
    } else {
      // No projectId - redirect to projects list with success message
      // User can later associate credentials with a project
      console.log('Figma OAuth completed without project association', {
        userId: session.user.id,
      });
      
      return NextResponse.redirect(
        new URL(`${returnTo}?figma=success&message=${encodeURIComponent('Figma connected successfully')}`, request.url)
      );
    }

  } catch (error) {
    // Generic error handler - don't leak sensitive information
    console.error('Error in Figma OAuth callback:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Error',
    });
    
    const returnTo = cookieStore.get('figma_oauth_return_to')?.value || '/projects';
    cookieStore.delete('figma_oauth_csrf');
    cookieStore.delete('figma_oauth_return_to');
    
    return NextResponse.redirect(
      new URL(`${returnTo}?figma=error&message=${encodeURIComponent('An unexpected error occurred')}`, request.url)
    );
  }
}
