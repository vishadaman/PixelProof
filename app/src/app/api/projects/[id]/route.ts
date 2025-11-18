// =============================================================================
// PROJECT API ROUTE (Single Project)
// =============================================================================
// GET - Get project details
// PATCH - Update project fields

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// =============================================================================
// GET /api/projects/[id] - Get project details
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Fetch project
    const project = await prisma.project.findUnique({
      where: { id: params.id },
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

    // Check if user has access to this project
    const hasAccess = project.org.memberships.length > 0;
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Return project without sensitive membership data
    const { org, ...projectData } = project;
    return NextResponse.json({
      ...projectData,
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
    });

  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/projects/[id] - Update project fields
// =============================================================================

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  figmaFileKey: z.string().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = updateProjectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Fetch project with membership check
    const project = await prisma.project.findUnique({
      where: { id: params.id },
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

    // Check if user has access
    const hasAccess = project.org.memberships.length > 0;
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update project
    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: validation.data,
    });

    console.log('Project updated:', {
      projectId: params.id,
      userId: session.user.id,
      fields: Object.keys(validation.data),
    });

    return NextResponse.json(updatedProject);

  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

