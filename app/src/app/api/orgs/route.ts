// =============================================================================
// ORGANIZATIONS API ROUTE
// =============================================================================
// Handles organization creation and management

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { slugify, generateUniqueSlug } from '@/lib/utils';
import { z } from 'zod';

// =============================================================================
// POST /api/orgs - Create a new organization
// =============================================================================

const createOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100),
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
    const validation = createOrgSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name } = validation.data;

    // Generate unique slug from organization name
    const baseSlug = slugify(name);
    const slug = await generateUniqueSlug(
      baseSlug,
      async (slug) => {
        const existing = await prisma.organization.findUnique({
          where: { slug },
        });
        return !!existing;
      }
    );

    // Create organization and membership in a transaction
    // This ensures both are created or neither is created (atomicity)
    const result = await prisma.$transaction(async (tx) => {
      // Create the organization
      const org = await tx.organization.create({
        data: {
          name,
          slug,
          ownerId: session.user.id,
        },
      });

      // Create membership with OWNER role for the creator
      const membership = await tx.membership.create({
        data: {
          userId: session.user.id,
          orgId: org.id,
          role: 'OWNER',
        },
      });

      return { org, membership };
    });

    console.log('Organization created:', {
      orgId: result.org.id,
      slug: result.org.slug,
      userId: session.user.id,
    });

    // Return the created organization
    return NextResponse.json({
      id: result.org.id,
      name: result.org.name,
      slug: result.org.slug,
      ownerId: result.org.ownerId,
      createdAt: result.org.createdAt.toISOString(),
      membership: {
        id: result.membership.id,
        role: result.membership.role,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create organization',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/orgs - List user's organizations
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

    // Get all organizations where user is a member
    const memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        org: {
          include: {
            _count: {
              select: {
                projects: true,
                memberships: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform to a cleaner format
    const orgs = memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      ownerId: m.org.ownerId,
      createdAt: m.org.createdAt.toISOString(),
      role: m.role,
      isOwner: m.role === 'OWNER',
      projectCount: m.org._count.projects,
      memberCount: m.org._count.memberships,
    }));

    return NextResponse.json({ organizations: orgs });

  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

