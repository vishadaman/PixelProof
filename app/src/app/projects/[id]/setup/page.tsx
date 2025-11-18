// =============================================================================
// PROJECT SETUP PAGE
// =============================================================================
// Configure Figma frame selection for design QA tracking
// Part of the project onboarding flow

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FigmaFramePicker } from '@/components/FigmaFramePicker';
import Link from 'next/link';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const fileKeyFormSchema = z.object({
  figmaFileUrl: z.string().url('Please enter a valid Figma file URL'),
});

const setupFormSchema = z.object({
  figmaFrameId: z.string().min(1, 'Please select a frame to track'),
});

type FileKeyFormData = z.infer<typeof fileKeyFormSchema>;
type SetupFormData = z.infer<typeof setupFormSchema>;

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function ProjectSetupPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'file-key' | 'frame-select'>('file-key');
  const [hasFileKey, setHasFileKey] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if project has file key
  useEffect(() => {
    async function checkProject() {
      try {
        const response = await fetch(`/api/projects/${params.id}`);
        if (response.ok) {
          const project = await response.json();
          if (project.figmaFileKey) {
            setHasFileKey(true);
            setStep('frame-select');
          }
        }
      } catch (err) {
        console.error('Error checking project:', err);
      } finally {
        setChecking(false);
      }
    }
    checkProject();
  }, [params.id]);

  // Show OAuth errors if present
  useEffect(() => {
    const figmaStatus = searchParams.get('figma');
    const message = searchParams.get('message');
    if (figmaStatus === 'error' && message) {
      setError(decodeURIComponent(message));
    }
  }, [searchParams]);

  // File key form
  const fileKeyForm = useForm<FileKeyFormData>({
    resolver: zodResolver(fileKeyFormSchema),
  });

  // Frame selection form
  const {
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SetupFormData>({
    resolver: zodResolver(setupFormSchema),
    mode: 'onChange',
    defaultValues: {
      figmaFrameId: '',
    },
  });

  const selectedFrameId = watch('figmaFrameId');

  // Handle file URL submission
  const onFileUrlSubmit = async (data: FileKeyFormData) => {
    try {
      setSaving(true);
      setError(null);

      // Extract file key from URL (supports both /file/ and /design/ formats)
      const urlMatch = data.figmaFileUrl.match(/\/(file|design)\/([a-zA-Z0-9]+)/);
      if (!urlMatch) {
        throw new Error('Invalid Figma file URL. Please copy the URL from your browser address bar.');
      }

      const figmaFileKey = urlMatch[2]; // The file key is in the second capture group

      // Update project with file key
      const response = await fetch(`/api/projects/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figmaFileKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save Figma file');
      }

      setHasFileKey(true);
      setStep('frame-select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Figma file');
    } finally {
      setSaving(false);
    }
  };

  // Handle frame selection submission
  const onSubmit = async (data: SetupFormData) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/projects/${params.id}/figma`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          figmaFrameId: data.figmaFrameId,
          createBaseline: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save configuration');
      }

      const result = await response.json();
      console.log('Figma configuration saved', result);

      // Redirect to project page
      router.push(`/projects/${params.id}?setup=complete`);
    } catch (err) {
      console.error('Error saving configuration:', err);
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
      setSaving(false);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/projects/${params.id}`}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 mb-4"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to project
          </Link>

          <h1 className="text-3xl font-bold text-gray-900">
            {step === 'file-key' ? 'Connect Figma File' : 'Configure Figma Frame'}
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            {step === 'file-key' 
              ? 'Enter your Figma file URL to get started'
              : 'Select the frame you want to track for design QA and drift detection'}
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900">
                Why frame selection matters
              </h3>
              <p className="text-sm text-blue-800 mt-1">
                Modern Figma design systems rely on variables and design tokens. By selecting a
                specific frame, PixelProof can capture typography, colors, spacing, and component
                definitions to compare against your live implementation. This baseline snapshot
                enables accurate drift detection and ensures your design stays consistent.
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-900">Error</h4>
                <p className="text-sm text-red-800 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: File URL Input */}
        {step === 'file-key' && (
          <form onSubmit={fileKeyForm.handleSubmit(onFileUrlSubmit)} className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label htmlFor="figmaFileUrl" className="block text-sm font-medium text-gray-900 mb-2">
                Figma File URL <span className="text-red-500">*</span>
              </label>
              <input
                id="figmaFileUrl"
                type="url"
                {...fileKeyForm.register('figmaFileUrl')}
                placeholder="https://www.figma.com/design/abc123/YourFileName"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              />
              {fileKeyForm.formState.errors.figmaFileUrl && (
                <p className="text-sm text-red-600 mt-2">
                  {fileKeyForm.formState.errors.figmaFileUrl.message}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-2">
                Copy the URL from your Figma file's address bar. Accepted formats:
                <br />
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  https://www.figma.com/design/FILE_KEY/...
                </code>
                {' or '}
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  https://www.figma.com/file/FILE_KEY/...
                </code>
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <Link
                href={`/projects/${params.id}`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Skip for now
              </Link>
              <button
                type="submit"
                disabled={saving || !fileKeyForm.formState.isValid}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {saving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Frame Picker */}
        {step === 'frame-select' && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Change File Button */}
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">Figma file connected</p>
                  <p className="text-xs text-gray-600">Loading frames from your file...</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('file-key');
                  setHasFileKey(false);
                  setError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Change File
              </button>
            </div>

            {/* Frame Picker */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-900 mb-4">
                Select Frame to Track
                <span className="text-red-500 ml-1">*</span>
              </label>

              <FigmaFramePicker
                projectId={params.id}
                value={selectedFrameId}
                onChange={(frameId) => setValue('figmaFrameId', frameId, { shouldValidate: true })}
                disabled={saving}
              />

              {/* Validation Error */}
              {errors.figmaFrameId && (
                <p className="text-sm text-red-600 mt-2">{errors.figmaFrameId.message}</p>
              )}

              <p className="text-sm text-gray-600 mt-4">
                Select the primary frame or component that represents your design. You can change this
                later in project settings.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <Link
                href={`/projects/${params.id}`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Skip for now
              </Link>
              <button
                type="submit"
                disabled={saving || !isValid}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {saving ? 'Saving...' : 'Save and Continue'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
