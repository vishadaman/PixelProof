// =============================================================================
// NEW PROJECT WIZARD
// =============================================================================
// Multi-step wizard for creating a new project

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Type definitions
interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  isOwner: boolean;
}

export default function NewProjectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Organization
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [newOrgName, setNewOrgName] = useState('');

  // Step 2: Project details
  const [projectName, setProjectName] = useState('');
  const [url, setUrl] = useState('');
  const [figmaFileKey, setFigmaFileKey] = useState('');

  // Step 4: Created project
  const [createdProject, setCreatedProject] = useState<any>(null);

  // Load organizations on mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrganizations();
    }
  }, [status]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/orgs');
      if (!res.ok) throw new Error('Failed to fetch organizations');
      const data = await res.json();
      setOrganizations(data.organizations || []);
      
      // Auto-select first org if available
      if (data.organizations.length > 0) {
        setSelectedOrgId(data.organizations[0].id);
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError('Failed to load organizations');
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) {
      setError('Organization name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create organization');
      }

      const newOrg = await res.json();
      setOrganizations([...organizations, {
        id: newOrg.id,
        name: newOrg.name,
        slug: newOrg.slug,
        role: 'OWNER',
        isOwner: true,
      }]);
      setSelectedOrgId(newOrg.id);
      setNewOrgName('');
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrg = () => {
    if (!selectedOrgId) {
      setError('Please select an organization');
      return;
    }
    setError(null);
    setCurrentStep(2);
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          orgId: selectedOrgId,
          url: url.trim(),
          figmaFileKey: figmaFileKey.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const project = await res.json();
      setCreatedProject(project);
      setCurrentStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (status === 'unauthenticated') {
    router.push('/auth/signin?callbackUrl=/projects/new');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/projects"
            className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block"
          >
            ← Back to Projects
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Create New Project</h1>
          <p className="text-gray-600 mt-2">
            Set up a new project to start running design QA tests
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <StepIndicator number={1} label="Organization" active={currentStep === 1} completed={currentStep > 1} />
            <div className="flex-1 h-1 bg-gray-200 mx-2">
              <div className={`h-full bg-blue-600 transition-all ${currentStep > 1 ? 'w-full' : 'w-0'}`}></div>
            </div>
            <StepIndicator number={2} label="Project Details" active={currentStep === 2} completed={currentStep > 2} />
            <div className="flex-1 h-1 bg-gray-200 mx-2">
              <div className={`h-full bg-blue-600 transition-all ${currentStep > 2 ? 'w-full' : 'w-0'}`}></div>
            </div>
            <StepIndicator number={3} label="Connect Services" active={currentStep === 3} completed={currentStep > 3} />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {currentStep === 1 && (
            <Step1Organization
              organizations={organizations}
              selectedOrgId={selectedOrgId}
              setSelectedOrgId={setSelectedOrgId}
              newOrgName={newOrgName}
              setNewOrgName={setNewOrgName}
              onSelectOrg={handleSelectOrg}
              onCreateOrg={handleCreateOrg}
              loading={loading}
            />
          )}

          {currentStep === 2 && (
            <Step2ProjectDetails
              projectName={projectName}
              setProjectName={setProjectName}
              url={url}
              setUrl={setUrl}
              figmaFileKey={figmaFileKey}
              setFigmaFileKey={setFigmaFileKey}
              onBack={() => setCurrentStep(1)}
              onCreate={handleCreateProject}
              loading={loading}
            />
          )}

          {currentStep === 3 && createdProject && (
            <Step3ConnectServices
              project={createdProject}
              onFinish={() => router.push('/projects')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STEP COMPONENTS
// =============================================================================

function StepIndicator({ number, label, active, completed }: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
        completed ? 'bg-green-600 text-white' :
        active ? 'bg-blue-600 text-white' :
        'bg-gray-200 text-gray-600'
      }`}>
        {completed ? '✓' : number}
      </div>
      <span className={`text-xs mt-2 ${active || completed ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}

function Step1Organization({
  organizations,
  selectedOrgId,
  setSelectedOrgId,
  newOrgName,
  setNewOrgName,
  onSelectOrg,
  onCreateOrg,
  loading,
}: any) {
  const [showCreateForm, setShowCreateForm] = useState(organizations.length === 0);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {organizations.length === 0 ? 'Create Organization' : 'Select Organization'}
      </h2>
      <p className="text-gray-600 mb-6">
        {organizations.length === 0
          ? 'First, create an organization to group your projects.'
          : 'Choose which organization this project belongs to.'}
      </p>

      {/* Existing organizations */}
      {organizations.length > 0 && !showCreateForm && (
        <div className="space-y-3 mb-6">
          {organizations.map((org: Organization) => (
            <label
              key={org.id}
              className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                selectedOrgId === org.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="organization"
                value={org.id}
                checked={selectedOrgId === org.id}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="mr-3"
              />
              <span className="font-medium text-gray-900">{org.name}</span>
              {org.isOwner && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  Owner
                </span>
              )}
            </label>
          ))}

          <button
            onClick={() => setShowCreateForm(true)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            + Create New Organization
          </button>
        </div>
      )}

      {/* Create new organization form */}
      {(organizations.length === 0 || showCreateForm) && (
        <div className="mb-6">
          {showCreateForm && organizations.length > 0 && (
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              ← Back to selection
            </button>
          )}
          
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Organization Name *
          </label>
          <input
            type="text"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="e.g., Acme Inc"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <p className="text-sm text-gray-500 mt-2">
            This will be the top-level container for your projects and team members.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {showCreateForm ? (
          <button
            onClick={onCreateOrg}
            disabled={loading || !newOrgName.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create & Continue'}
          </button>
        ) : (
          <button
            onClick={onSelectOrg}
            disabled={loading || !selectedOrgId}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function Step2ProjectDetails({
  projectName,
  setProjectName,
  url,
  setUrl,
  figmaFileKey,
  setFigmaFileKey,
  onBack,
  onCreate,
  loading,
}: any) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Details</h2>
      <p className="text-gray-600 mb-6">
        Configure your project settings and integrations.
      </p>

      <div className="space-y-5">
        {/* Project Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project Name *
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g., Marketing Website"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>

        {/* Page URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Page URL to Audit *
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g., https://example.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <p className="text-sm text-gray-500 mt-1">
            The live page URL that will be audited for design QA checks.
          </p>
        </div>

        {/* Figma File Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Figma File Key (Optional)
          </label>
          <input
            type="text"
            value={figmaFileKey}
            onChange={(e) => setFigmaFileKey(e.target.value)}
            placeholder="e.g., abc123def456"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <p className="text-sm text-gray-500 mt-1">
            The file key from your Figma file URL. You'll connect your Figma account in the next step.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
          disabled={loading}
        >
          Back
        </button>
        <button
          onClick={onCreate}
          disabled={loading || !projectName.trim() || !url.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </div>
  );
}

function Step3ConnectServices({ project, onFinish }: any) {
  return (
    <div>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Project Created Successfully! 🎉
        </h2>
        <p className="text-gray-600">
          Your project <strong>{project.name}</strong> is ready to go.
        </p>
      </div>

      {/* Optional integrations */}
      <div className="space-y-4 mb-8">
        <h3 className="text-lg font-semibold text-gray-900">Next Steps (Optional)</h3>
        
        {/* Connect Figma */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900 mb-1">Connect Figma</h4>
              <p className="text-sm text-gray-600">
                Link your Figma account to enable design comparisons and visual regression testing.
              </p>
            </div>
            <a
              href={`/api/figma/start?projectId=${project.id}&returnTo=/projects/${project.id}/setup`}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap"
            >
              Connect Figma
            </a>
          </div>
        </div>

        {/* Setup Webhooks */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900 mb-1">Setup Git Webhooks</h4>
              <p className="text-sm text-gray-600">
                Configure webhooks to automatically run QA tests on pull requests.
              </p>
            </div>
            <Link
              href="/docs/webhooks"
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap"
            >
              View Docs
            </Link>
          </div>
        </div>

        {/* Trigger First Run */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900 mb-1">Trigger First QA Run</h4>
              <p className="text-sm text-gray-600">
                Run your first design QA test to see PixelProof in action.
              </p>
            </div>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
              onClick={() => alert('TODO: Implement run trigger')}
            >
              Trigger Run
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center">
        <button
          onClick={onFinish}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
        >
          Go to Projects
        </button>
      </div>
    </div>
  );
}

