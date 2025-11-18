// =============================================================================
// FIGMA API CLIENT
// =============================================================================
// Centralized client for interacting with the Figma REST API
// Handles token refresh, authentication, and API requests
//
// Key features:
// - Automatic token refresh when expired
// - Type-safe API responses
// - Custom error handling
// - No sensitive data logging
// - Reusable across API routes

import { prisma } from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/crypto';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Custom error class for Figma API errors
 * Provides structured error information without exposing sensitive data
 */
export class FigmaApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'FigmaApiError';
  }
}

/**
 * Figma file metadata and document structure
 * Reference: https://www.figma.com/developers/api#get-files-endpoint
 */
export interface FigmaFile {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
  components: Record<string, FigmaComponent>;
  styles: Record<string, FigmaStyle>;
  schemaVersion: number;
}

/**
 * Figma node (frame, component, text, etc.)
 */
export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  backgroundColor?: FigmaColor;
  absoluteBoundingBox?: FigmaBoundingBox;
  // Add more fields as needed
  [key: string]: unknown;
}

/**
 * Figma component definition
 */
export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
  documentationLinks?: Array<{ uri: string }>;
}

/**
 * Figma style definition
 */
export interface FigmaStyle {
  key: string;
  name: string;
  description: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}

/**
 * Figma color
 */
export interface FigmaColor {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1 (opacity)
}

/**
 * Figma bounding box
 */
export interface FigmaBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Response from /files/{key}/nodes endpoint
 */
export interface FigmaNodesResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  nodes: Record<string, { document: FigmaNode } | null>;
}

/**
 * Figma variable collection
 * Reference: https://www.figma.com/developers/api#get-local-variables-endpoint
 */
export interface FigmaVariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variableIds: string[];
}

/**
 * Figma variable
 */
export interface FigmaVariable {
  id: string;
  name: string;
  key: string;
  variableCollectionId: string;
  resolvedType: 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR';
  valuesByMode: Record<string, unknown>;
}

/**
 * Response from /files/{key}/variables/local endpoint
 */
export interface FigmaVariablesResponse {
  status: number;
  error: boolean;
  meta: {
    variableCollections: Record<string, FigmaVariableCollection>;
    variables: Record<string, FigmaVariable>;
  };
}

/**
 * Response from token refresh endpoint
 */
interface FigmaTokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Fetch Figma credentials for a project from the database
 * 
 * @param projectId - The project ID
 * @returns FigmaCredential or null if not found
 * @throws Error if database query fails
 * 
 * @example
 * const credential = await getFigmaCredentialForProject('clxy123');
 * if (!credential) throw new Error('Figma not connected');
 */
export async function getFigmaCredentialForProject(projectId: string) {
  try {
    const credential = await prisma.figmaCredential.findUnique({
      where: { projectId },
    });

    return credential;
  } catch (error) {
    throw new Error(
      `Failed to fetch Figma credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Refresh Figma access token if it's expired or about to expire
 * Updates the database with new tokens and expiry time
 * 
 * @param credential - The FigmaCredential record from database
 * @returns Updated credential with fresh tokens
 * @throws FigmaApiError if refresh fails
 * 
 * @example
 * const credential = await getFigmaCredentialForProject('clxy123');
 * const fresh = await refreshAccessTokenIfNeeded(credential);
 */
export async function refreshAccessTokenIfNeeded(
  credential: NonNullable<Awaited<ReturnType<typeof getFigmaCredentialForProject>>>
) {
  // Check if token is expired or expires within 2 minutes
  const expiryBuffer = 2 * 60 * 1000; // 2 minutes in milliseconds
  const isExpiringSoon = credential.accessTokenExpiresAt.getTime() - Date.now() < expiryBuffer;

  if (!isExpiringSoon) {
    // Token is still valid
    return credential;
  }

  // Token needs refresh
  console.log('Refreshing Figma access token', {
    projectId: credential.projectId,
    expiresAt: credential.accessTokenExpiresAt.toISOString(),
  });

  const clientId = process.env.FIGMA_CLIENT_ID;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new FigmaApiError(
      'Figma OAuth credentials not configured',
      500,
      '/api/oauth/token',
      { reason: 'Missing FIGMA_CLIENT_ID or FIGMA_CLIENT_SECRET' }
    );
  }

  // Decrypt refresh token (if encryption is enabled)
  let refreshToken = credential.refreshToken;
  try {
    if (process.env.ENCRYPTION_KEY) {
      refreshToken = decrypt(refreshToken);
    }
  } catch (error) {
    // If decryption fails, assume it's not encrypted (backward compatibility)
    console.warn('Failed to decrypt refresh token, using as-is');
  }

  // Call Figma token refresh endpoint
  const response = await fetch('https://www.figma.com/api/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Figma token refresh failed', {
      status: response.status,
      statusText: response.statusText,
    });
    throw new FigmaApiError(
      'Failed to refresh Figma access token',
      response.status,
      '/api/oauth/token',
      { statusText: response.statusText }
    );
  }

  const data: FigmaTokenRefreshResponse = await response.json();

  // Calculate new expiry time
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Encrypt tokens before storing (if encryption is enabled)
  let encryptedAccessToken = data.access_token;
  let encryptedRefreshToken = data.refresh_token;

  if (process.env.ENCRYPTION_KEY) {
    try {
      encryptedAccessToken = encrypt(data.access_token);
      encryptedRefreshToken = encrypt(data.refresh_token);
    } catch (error) {
      console.error('Failed to encrypt tokens, storing as-is', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Update database with new tokens
  const updatedCredential = await prisma.figmaCredential.update({
    where: { id: credential.id },
    data: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      accessTokenExpiresAt: newExpiresAt,
      updatedAt: new Date(),
    },
  });

  console.log('Figma access token refreshed successfully', {
    projectId: credential.projectId,
    newExpiresAt: newExpiresAt.toISOString(),
  });

  return updatedCredential;
}

/**
 * Get a valid Figma access token for a project
 * Automatically refreshes the token if expired
 * 
 * @param projectId - The project ID
 * @returns Valid (decrypted) access token
 * @throws Error if credentials not found or refresh fails
 * 
 * @example
 * const token = await getFigmaAccessToken('clxy123');
 * // Use token for API requests
 */
export async function getFigmaAccessToken(projectId: string): Promise<string> {
  // Fetch credentials from database
  const credential = await getFigmaCredentialForProject(projectId);

  if (!credential) {
    throw new Error(`Figma credentials not found for project ${projectId}`);
  }

  // Refresh if needed
  const freshCredential = await refreshAccessTokenIfNeeded(credential);

  // Decrypt access token (if encryption is enabled)
  let accessToken = freshCredential.accessToken;
  try {
    if (process.env.ENCRYPTION_KEY) {
      accessToken = decrypt(accessToken);
    }
  } catch (error) {
    // If decryption fails, assume it's not encrypted (backward compatibility)
    console.warn('Failed to decrypt access token, using as-is');
  }

  return accessToken;
}

// =============================================================================
// FIGMA API REQUESTS
// =============================================================================

/**
 * Fetch a Figma file's metadata and document structure
 * 
 * @param projectId - The project ID (for authentication)
 * @param fileKey - The Figma file key
 * @returns Figma file data
 * @throws FigmaApiError if request fails
 * 
 * @example
 * const file = await fetchFigmaFile('clxy123', 'abc123');
 * console.log(file.name, file.version);
 */
export async function fetchFigmaFile(
  projectId: string,
  fileKey: string
): Promise<FigmaFile> {
  const accessToken = await getFigmaAccessToken(projectId);
  const endpoint = `/v1/files/${fileKey}`;

  const response = await fetch(`https://api.figma.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Figma API request failed', {
      endpoint,
      status: response.status,
      statusText: response.statusText,
    });
    throw new FigmaApiError(
      `Failed to fetch Figma file: ${response.statusText}`,
      response.status,
      endpoint,
      { fileKey }
    );
  }

  const data = await response.json();
  return data as FigmaFile;
}

/**
 * Fetch specific nodes from a Figma file
 * Useful for fetching only the frames/components you need
 * 
 * @param projectId - The project ID (for authentication)
 * @param fileKey - The Figma file key
 * @param nodeIds - Array of node IDs to fetch
 * @returns Nodes data indexed by node ID
 * @throws FigmaApiError if request fails
 * 
 * @example
 * const nodes = await fetchFigmaFileNodes('clxy123', 'abc123', ['1:2', '1:3']);
 * console.log(nodes['1:2']?.document.name);
 */
export async function fetchFigmaFileNodes(
  projectId: string,
  fileKey: string,
  nodeIds: string[]
): Promise<FigmaNodesResponse> {
  if (nodeIds.length === 0) {
    throw new Error('nodeIds array cannot be empty');
  }

  const accessToken = await getFigmaAccessToken(projectId);
  const idsParam = nodeIds.join(',');
  const endpoint = `/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(idsParam)}`;

  const response = await fetch(`https://api.figma.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Figma API request failed', {
      endpoint,
      status: response.status,
      statusText: response.statusText,
    });
    throw new FigmaApiError(
      `Failed to fetch Figma nodes: ${response.statusText}`,
      response.status,
      endpoint,
      { fileKey, nodeCount: nodeIds.length }
    );
  }

  const data = await response.json();
  return data as FigmaNodesResponse;
}

/**
 * Fetch local variables from a Figma file
 * Variables include colors, numbers, strings, and booleans defined in the file
 * 
 * @param projectId - The project ID (for authentication)
 * @param fileKey - The Figma file key
 * @returns Variables and variable collections
 * @throws FigmaApiError if request fails
 * 
 * @example
 * const vars = await fetchFigmaVariables('clxy123', 'abc123');
 * console.log(vars.meta.variables);
 */
export async function fetchFigmaVariables(
  projectId: string,
  fileKey: string
): Promise<FigmaVariablesResponse> {
  const accessToken = await getFigmaAccessToken(projectId);
  const endpoint = `/v1/files/${fileKey}/variables/local`;

  const response = await fetch(`https://api.figma.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Figma API request failed', {
      endpoint,
      status: response.status,
      statusText: response.statusText,
    });
    throw new FigmaApiError(
      `Failed to fetch Figma variables: ${response.statusText}`,
      response.status,
      endpoint,
      { fileKey }
    );
  }

  const data = await response.json();
  return data as FigmaVariablesResponse;
}

/**
 * Fetch published styles from a Figma file
 * Styles include text styles, color styles, effects, and grids
 * 
 * @param projectId - The project ID (for authentication)
 * @param fileKey - The Figma file key
 * @returns File metadata including styles
 * @throws FigmaApiError if request fails
 * 
 * @example
 * const file = await fetchFigmaStyles('clxy123', 'abc123');
 * console.log(file.styles);
 */
export async function fetchFigmaStyles(
  projectId: string,
  fileKey: string
): Promise<FigmaFile> {
  // Styles are included in the main file endpoint
  // We use the same endpoint but document that we're fetching for styles
  return fetchFigmaFile(projectId, fileKey);
}

/**
 * Fetch components from a Figma file
 * Components are reusable design elements
 * 
 * @param projectId - The project ID (for authentication)
 * @param fileKey - The Figma file key
 * @returns File metadata including components
 * @throws FigmaApiError if request fails
 * 
 * @example
 * const file = await fetchFigmaComponents('clxy123', 'abc123');
 * console.log(file.components);
 */
export async function fetchFigmaComponents(
  projectId: string,
  fileKey: string
): Promise<FigmaFile> {
  // Components are included in the main file endpoint
  return fetchFigmaFile(projectId, fileKey);
}

/**
 * Fetch both variables and styles from a Figma file
 * Convenience function that combines multiple API calls
 * 
 * @param projectId - The project ID (for authentication)
 * @param fileKey - The Figma file key
 * @returns Object containing file data and variables
 * @throws FigmaApiError if any request fails
 * 
 * @example
 * const data = await fetchFigmaVariablesAndStyles('clxy123', 'abc123');
 * console.log(data.file.styles, data.variables.meta.variables);
 */
export async function fetchFigmaVariablesAndStyles(
  projectId: string,
  fileKey: string
): Promise<{
  file: FigmaFile;
  variables: FigmaVariablesResponse;
}> {
  // Fetch both in parallel for efficiency
  const [file, variables] = await Promise.all([
    fetchFigmaFile(projectId, fileKey),
    fetchFigmaVariables(projectId, fileKey),
  ]);

  return { file, variables };
}

// =============================================================================
// HELPER UTILITIES
// =============================================================================

/**
 * Check if a project has Figma credentials configured
 * 
 * @param projectId - The project ID
 * @returns true if credentials exist, false otherwise
 * 
 * @example
 * if (await hasFigmaCredentials('clxy123')) {
 *   // Fetch Figma data
 * }
 */
export async function hasFigmaCredentials(projectId: string): Promise<boolean> {
  const credential = await getFigmaCredentialForProject(projectId);
  return credential !== null;
}

/**
 * Get Figma file key from a Figma URL
 * 
 * @param url - Figma file URL (e.g., https://www.figma.com/file/abc123/MyDesign)
 * @returns File key or null if invalid URL
 * 
 * @example
 * const key = extractFileKeyFromUrl('https://www.figma.com/file/abc123/MyDesign');
 * // Returns: 'abc123'
 */
export function extractFileKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/file\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get node ID from a Figma URL with node parameter
 * 
 * @param url - Figma URL with node-id parameter
 * @returns Node ID or null if not present
 * 
 * @example
 * const nodeId = extractNodeIdFromUrl('https://www.figma.com/file/abc/Design?node-id=1:2');
 * // Returns: '1:2'
 */
export function extractNodeIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('node-id');
  } catch {
    return null;
  }
}

