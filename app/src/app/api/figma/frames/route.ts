// =============================================================================
// FIGMA FRAMES API ROUTE
// =============================================================================
// Fetches all frames from a Figma file for the frame picker UI
// Traverses the document tree and returns minimal frame information

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getFigmaAccessToken, fetchFigmaFile, FigmaApiError, type FigmaNode } from '@/lib/figma';
import type { FrameSummary } from '@pixelproof/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Maximum depth to traverse in document tree (prevents stack overflow) */
const MAX_TRAVERSAL_DEPTH = 10;

/** Maximum number of frames to return (prevents memory issues) */
const MAX_FRAMES = 500;

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const framesQuerySchema = z.object({
  projectId: z.string().cuid('Invalid project ID'),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Traverse Figma document tree and collect all FRAME nodes
 * Uses depth-first search with depth limiting
 * 
 * @param node - Current node to traverse
 * @param pageName - Name of the page containing this node
 * @param depth - Current depth in the tree
 * @param frames - Accumulator array for found frames
 * @returns Array of frame summaries
 */
function collectFrames(
  node: FigmaNode,
  pageName: string,
  depth: number = 0,
  frames: FrameSummary[] = []
): FrameSummary[] {
  // Safety check: stop if max depth reached
  if (depth > MAX_TRAVERSAL_DEPTH) {
    console.warn('Max traversal depth reached', { depth, nodeName: node.name });
    return frames;
  }

  // Safety check: stop if max frames collected
  if (frames.length >= MAX_FRAMES) {
    console.warn('Max frames limit reached', { count: frames.length });
    return frames;
  }

  // Check if this node is a FRAME
  if (node.type === 'FRAME') {
    const boundingBox = node.absoluteBoundingBox;
    
    // Only include frames with valid dimensions
    if (boundingBox && boundingBox.width > 0 && boundingBox.height > 0) {
      frames.push({
        id: node.id,
        name: node.name || 'Unnamed Frame',
        pageName,
        width: Math.round(boundingBox.width),
        height: Math.round(boundingBox.height),
        depth,
      });
    }
  }

  // Recursively traverse children
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      // Skip if already at max frames
      if (frames.length >= MAX_FRAMES) break;
      
      try {
        collectFrames(child, pageName, depth + 1, frames);
      } catch (error) {
        // Continue processing other children if one fails
        console.error('Error processing child node', {
          childId: child.id,
          childName: child.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  return frames;
}

/**
 * Extract all frames from a Figma file's document structure
 * Handles CANVAS (page) nodes as top-level containers
 * 
 * @param document - Root document node from Figma API
 * @returns Array of frame summaries
 */
function extractFramesFromDocument(document: FigmaNode): FrameSummary[] {
  const frames: FrameSummary[] = [];

  try {
    // Document should have children which are CANVAS nodes (pages)
    if (!document.children || !Array.isArray(document.children)) {
      console.warn('Document has no children (no pages found)');
      return frames;
    }

    // Iterate through pages (CANVAS nodes)
    for (const page of document.children) {
      // Safety check
      if (frames.length >= MAX_FRAMES) {
        console.warn('Stopped processing pages - max frames reached');
        break;
      }

      const pageName = page.name || 'Unnamed Page';
      
      // Skip if page type is not CANVAS
      if (page.type !== 'CANVAS') {
        console.warn('Skipping non-CANVAS top-level node', {
          type: page.type,
          name: pageName,
        });
        continue;
      }

      try {
        // Collect frames from this page
        collectFrames(page, pageName, 0, frames);
      } catch (error) {
        console.error('Error processing page', {
          pageName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue processing other pages
      }
    }

    return frames;
  } catch (error) {
    console.error('Error extracting frames from document', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return frames; // Return whatever we managed to collect
  }
}

// =============================================================================
// API HANDLER
// =============================================================================

/**
 * GET /api/figma/frames?projectId=...
 * 
 * Fetches all frames from a project's linked Figma file
 * Used by the frame picker UI to let users select which frame to track
 * 
 * Query parameters:
 * - projectId (required): The project ID
 * 
 * Response:
 * - 200: { frames: FrameSummary[] }
 * - 400: { error: string } - Invalid parameters or missing figmaFileKey
 * - 404: { error: string } - Project not found
 * - 500: { error: string } - Server error
 */
export async function GET(request: NextRequest) {
  try {
    // =============================================================================
    // 1. VALIDATE QUERY PARAMETERS
    // =============================================================================

    const searchParams = request.nextUrl.searchParams;
    const queryValidation = framesQuerySchema.safeParse({
      projectId: searchParams.get('projectId'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: queryValidation.error.errors,
        },
        { status: 400 }
      );
    }

    const { projectId } = queryValidation.data;

    // =============================================================================
    // 2. FETCH AND VALIDATE PROJECT
    // =============================================================================

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        figmaFileKey: true,
        // Don't include sensitive fields
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if project has Figma file configured
    if (!project.figmaFileKey) {
      return NextResponse.json(
        {
          error: 'Missing figmaFileKey for project',
          details: 'This project is not linked to a Figma file. Please configure Figma integration first.',
        },
        { status: 400 }
      );
    }

    // =============================================================================
    // 3. FETCH FIGMA FILE
    // =============================================================================

    // Check if project has Figma credentials
    const hasCredentials = await prisma.figmaCredential.findUnique({
      where: { projectId },
      select: { id: true },
    });

    if (!hasCredentials) {
      return NextResponse.json(
        {
          error: 'Figma not connected',
          details: 'Please connect your Figma account first by clicking "Connect Figma" on the project page.',
          needsOAuth: true,
        },
        { status: 400 }
      );
    }

    let figmaFile;
    try {
      // This automatically handles token refresh and authentication
      figmaFile = await fetchFigmaFile(projectId, project.figmaFileKey);
    } catch (error) {
      if (error instanceof FigmaApiError) {
        console.error('Figma API error while fetching file', {
          projectId,
          fileKey: project.figmaFileKey.substring(0, 8) + '...', // Partial key for debugging
          statusCode: error.statusCode,
          message: error.message,
        });

        // Map Figma API errors to user-friendly messages
        if (error.statusCode === 404) {
          return NextResponse.json(
            { error: 'Figma file not found. The file may have been deleted or moved.' },
            { status: 404 }
          );
        } else if (error.statusCode === 403) {
          return NextResponse.json(
            { error: 'Access denied to Figma file. Please reconnect Figma integration.' },
            { status: 403 }
          );
        } else {
          return NextResponse.json(
            { error: 'Failed to fetch Figma file. Please try again later.' },
            { status: error.statusCode }
          );
        }
      }

      // Unknown error - could be missing credentials
      if (error instanceof Error && error.message.includes('No Figma credentials')) {
        return NextResponse.json(
          {
            error: 'Figma not connected',
            details: 'Please connect your Figma account first.',
            needsOAuth: true,
          },
          { status: 400 }
        );
      }

      // Unknown error
      throw error;
    }

    // =============================================================================
    // 4. EXTRACT FRAMES FROM DOCUMENT
    // =============================================================================

    const frames = extractFramesFromDocument(figmaFile.document);

    // Log summary (no sensitive data)
    console.log('Frames extracted successfully', {
      projectId,
      projectName: project.name,
      frameCount: frames.length,
      fileVersion: figmaFile.version,
    });

    // =============================================================================
    // 5. RETURN RESPONSE
    // =============================================================================

    return NextResponse.json({
      frames,
      meta: {
        total: frames.length,
        fileName: figmaFile.name,
        fileVersion: figmaFile.version,
        truncated: frames.length >= MAX_FRAMES,
      },
    });

  } catch (error) {
    // Generic error handler
    console.error('Error in /api/figma/frames', {
      error: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Error',
    });

    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

