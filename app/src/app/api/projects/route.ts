// =============================================================================
// PROJECTS API ROUTE
// =============================================================================
// Handles project creation and listing

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// =============================================================================
// POST /api/projects - Create a new project
// =============================================================================

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  orgId: z.string().cuid('Invalid organization ID'),
  url: z.string().url('Invalid URL').min(1, 'URL is required'),
  figmaFileKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Validate user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createProjectSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, orgId, url, figmaFileKey } = validation.data;

    // Check if user is a member of the organization
    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: session.user.id,
          orgId: orgId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Forbidden - You are not a member of this organization' },
        { status: 403 }
      );
    }

    // Create the project
    const project = await prisma.project.create({
      data: {
        name,
        orgId,
        url,
        figmaFileKey: figmaFileKey || null,
      },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    console.log('Project created:', {
      projectId: project.id,
      name: project.name,
      orgId: project.orgId,
      userId: session.user.id,
    });

    // Return the created project
    return NextResponse.json({
      id: project.id,
      name: project.name,
      url: project.url,
      figmaFileKey: project.figmaFileKey,
      orgId: project.orgId,
      organization: project.org,
      createdAt: project.createdAt.toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create project',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/projects - List user's projects
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Validate user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Get all projects from organizations where user is a member
    // Join: User -> Memberships -> Organizations -> Projects
    const memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        org: {
          include: {
            projects: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
    });

    // Flatten projects from all organizations
    const projects = memberships.flatMap((m) =>
      m.org.projects.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        figmaFileKey: p.figmaFileKey,
        createdAt: p.createdAt.toISOString(),
        organization: {
          id: m.org.id,
          name: m.org.name,
          slug: m.org.slug,
        },
        userRole: m.role,
      }))
    );

    return NextResponse.json({ projects });

  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

