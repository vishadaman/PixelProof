// =============================================================================
// PROJECT DETAIL PAGE (Server Component)
// =============================================================================
// Shows details for a specific project

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

interface ProjectDetailPageProps {
  params: {
    id: string;
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id: projectId } = params;

  // Get session on server side
  const session = await getServerSession(authOptions);

  // Redirect if not authenticated
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/projects/${projectId}`);
  }

  // Fetch project from database
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    include: {
      org: {
        include: {
          memberships: {
            where: {
              userId: session.user.id,
            },
          },
        },
      },
    },
  });

  // Return 404 if project not found
  if (!project) {
    notFound();
  }

  // Check if user has access to this project (via organization membership)
  const userMembership = project.org.memberships[0];
  if (!userMembership) {
    redirect('/projects');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        {/* Back Link */}
        <Link
          href="/projects"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-6 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </Link>

        {/* Project Header */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-3">
                {project.name}
              </h1>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Organization: <strong className="text-gray-900">{project.org.name}</strong>
                </span>
                <span className="text-gray-400">•</span>
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  {project.url}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              {project.figmaFileKey && (
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C8.74 0 6.1 2.64 6.1 5.9c0 2.52 1.58 4.67 3.81 5.53v.67c-2.23.86-3.81 3.01-3.81 5.53C6.1 21.36 8.74 24 12 24s5.9-2.64 5.9-5.9c0-2.52-1.58-4.67-3.81-5.53v-.67c2.23-.86 3.81-3.01 3.81-5.53C17.9 2.64 15.26 0 12 0z" />
                    </svg>
                    Figma Connected
                  </span>
                </div>
              )}
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {userMembership.role.charAt(0) + userMembership.role.slice(1).toLowerCase()}
            </span>
          </div>
        </div>

        {/* Setup Actions - Show if Figma not fully configured */}
        {(!project.figmaFileKey || !project.figmaFrameId) && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C8.74 0 6.1 2.64 6.1 5.9c0 2.52 1.58 4.67 3.81 5.53v.67c-2.23.86-3.81 3.01-3.81 5.53C6.1 21.36 8.74 24 12 24s5.9-2.64 5.9-5.9c0-2.52-1.58-4.67-3.81-5.53v-.67c2.23-.86 3.81-3.01 3.81-5.53C17.9 2.64 15.26 0 12 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {!project.figmaFileKey ? 'Connect Figma to Enable Design QA' : 'Complete Figma Setup'}
                </h3>
                <p className="text-sm text-gray-700 mb-4">
                  {!project.figmaFileKey 
                    ? 'Link your Figma file to track design changes, compare implementations, and detect visual drift automatically.'
                    : 'Select a frame to track for design comparison and drift detection.'}
                </p>
                <div className="flex items-center gap-3">
                  {!project.figmaFileKey ? (
                    <>
                      <Link
                        href={`/api/figma/start?projectId=${project.id}&returnTo=/projects/${project.id}/setup`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-sm"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C8.74 0 6.1 2.64 6.1 5.9c0 2.52 1.58 4.67 3.81 5.53v.67c-2.23.86-3.81 3.01-3.81 5.53C6.1 21.36 8.74 24 12 24s5.9-2.64 5.9-5.9c0-2.52-1.58-4.67-3.81-5.53v-.67c2.23-.86 3.81-3.01 3.81-5.53C17.9 2.64 15.26 0 12 0z" />
                        </svg>
                        Connect Figma
                      </Link>
                      <Link
                        href={`/projects/${project.id}/setup`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Manual Setup
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={`/projects/${project.id}/setup`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-sm"
                    >
                      Continue Setup
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder Content */}
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Project Dashboard Coming Soon
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            This page will display QA runs, visual regression findings, accessibility issues,
            and project analytics. You'll be able to trigger runs, view diffs, and manage settings.
          </p>

          {/* TODO sections */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left mb-8">
            <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">QA Runs</h3>
              <p className="text-sm text-gray-600">
                View all automated runs with status, findings count, and timestamps
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
              <div className="text-3xl mb-3">🐛</div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">Findings</h3>
              <p className="text-sm text-gray-600">
                Browse visual regressions, accessibility issues, and design spec violations
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
              <div className="text-3xl mb-3">⚙️</div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">Settings</h3>
              <p className="text-sm text-gray-600">
                Configure webhooks, integrations, and team access permissions
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-4 pt-8 border-t border-gray-200">
            <button
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              disabled
            >
              Trigger QA Run (Coming Soon)
            </button>
            <Link
              href="/projects"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Back to Projects
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

