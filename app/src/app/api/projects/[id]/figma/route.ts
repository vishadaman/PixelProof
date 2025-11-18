// =============================================================================
// PROJECT FIGMA CONFIGURATION API
// =============================================================================
// Update project's Figma frame selection and optionally create baseline snapshot

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { createBaselineSnapshotForProject } from '@/lib/baseline';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

const updateFigmaConfigSchema = z.object({
  figmaFrameId: z.string().min(1, 'Frame ID is required'),
  createBaseline: z.boolean().optional().default(false),
});

// =============================================================================
// PUT HANDLER - Update Figma Configuration
// =============================================================================

/**
 * PUT /api/projects/[id]/figma
 * 
 * Updates a project's Figma frame configuration
 * Optionally triggers baseline snapshot creation
 * 
 * Request body:
 * - figmaFrameId: The selected frame ID from Figma
 * - createBaseline: Whether to create a baseline snapshot (optional)
 * 
 * Response:
 * - 200: { success: true, project: {...} }
 * - 400: { error: string } - Invalid request
 * - 401: { error: string } - Not authenticated
 * - 403: { error: string } - Not authorized
 * - 404: { error: string } - Project not found
 * - 500: { error: string } - Server error
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // =============================================================================
    // 1. VALIDATE SESSION
    // =============================================================================

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    const projectId = params.id;

    // =============================================================================
    // 2. VALIDATE REQUEST BODY
    // =============================================================================

    const body = await request.json();
    const validation = updateFigmaConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { figmaFrameId, createBaseline } = validation.data;

    // =============================================================================
    // 3. FETCH AND VALIDATE PROJECT ACCESS
    // =============================================================================

    const project = await prisma.project.findUnique({
      where: { id: projectId },
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
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the project's organization
    if (project.org.memberships.length === 0) {
      return NextResponse.json(
        { error: 'You do not have access to this project' },
        { status: 403 }
      );
    }

    // Validate project has Figma file configured
    if (!project.figmaFileKey) {
      return NextResponse.json(
        {
          error: 'Project is not linked to a Figma file',
          details: 'Please connect Figma integration first',
        },
        { status: 400 }
      );
    }

    // =============================================================================
    // 4. UPDATE PROJECT
    // =============================================================================

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        figmaFrameId,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        url: true,
        figmaFileKey: true,
        figmaFrameId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('Project Figma configuration updated', {
      projectId,
      projectName: project.name,
      figmaFrameId,
      userId: session.user.id,
    });

    // =============================================================================
    // 5. OPTIONALLY CREATE BASELINE SNAPSHOT
    // =============================================================================

    if (createBaseline) {
      // Create baseline snapshot in the background (don't block response)
      // This is fire-and-forget - errors are logged but don't fail the request
      createBaselineSnapshotForProject(projectId)
        .then((snapshot) => {
          console.log('Baseline snapshot created successfully', {
            projectId,
            snapshotId: snapshot.id,
            createdAt: snapshot.createdAt,
          });
        })
        .catch((error) => {
          // Log error without exposing sensitive data
          console.error('Failed to create baseline snapshot', {
            projectId,
            error: error instanceof Error ? error.message : 'Unknown error',
            // Do not log tokens, file contents, or other sensitive data
          });
        });

      // Note: Response is sent immediately, baseline creation happens async
      console.log('Baseline snapshot creation initiated in background', {
        projectId,
        figmaFileKey: project.figmaFileKey,
        figmaFrameId,
      });
    }

    // =============================================================================
    // 6. RETURN SUCCESS RESPONSE
    // =============================================================================

    return NextResponse.json({
      success: true,
      project: updatedProject,
      message: 'Figma frame configuration updated successfully',
    });

  } catch (error) {
    console.error('Error updating Figma configuration', {
      projectId: params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        error: 'Failed to update Figma configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

