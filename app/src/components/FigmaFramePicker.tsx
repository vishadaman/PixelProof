// =============================================================================
// FIGMA FRAME PICKER COMPONENT
// =============================================================================
// Allows users to select a Figma frame from their connected file
// Used in project setup to choose which frame to track for design QA

'use client';

import { useState, useEffect } from 'react';
import type { FrameSummary } from '@pixelproof/types';

// =============================================================================
// TYPES
// =============================================================================

interface FigmaFramesResponse {
  frames: FrameSummary[];
  meta: {
    total: number;
    fileName: string;
    fileVersion: string;
    truncated: boolean;
  };
}

interface FigmaFramesErrorResponse {
  error: string;
  details?: string;
  needsOAuth?: boolean;
}

interface FigmaFramePickerProps {
  projectId: string;
  value?: string; // Selected frame ID
  onChange: (frameId: string) => void;
  disabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FigmaFramePicker({
  projectId,
  value,
  onChange,
  disabled = false,
}: FigmaFramePickerProps) {
  const [frames, setFrames] = useState<FrameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsOAuth, setNeedsOAuth] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // =============================================================================
  // FETCH FRAMES
  // =============================================================================

  useEffect(() => {
    async function fetchFrames() {
      try {
        setLoading(true);
        setError(null);
        setNeedsOAuth(false);

        const response = await fetch(`/api/figma/frames?projectId=${projectId}`);

        if (!response.ok) {
          const data: FigmaFramesErrorResponse = await response.json();
          
          // Check if error indicates OAuth is needed
          if (data.needsOAuth) {
            setNeedsOAuth(true);
            setError(data.details || data.error || 'Failed to fetch frames');
          } else {
            throw new Error(data.error || 'Failed to fetch frames');
          }
          return;
        }

        const data: FigmaFramesResponse = await response.json();
        setFrames(data.frames);

        console.log('Loaded Figma frames', {
          count: data.frames.length,
          fileName: data.meta.fileName,
        });
      } catch (err) {
        console.error('Error fetching frames:', err);
        setError(err instanceof Error ? err.message : 'Failed to load frames');
      } finally {
        setLoading(false);
      }
    }

    fetchFrames();
  }, [projectId]);

  // =============================================================================
  // GROUP FRAMES BY PAGE
  // =============================================================================

  const framesByPage = frames.reduce((acc, frame) => {
    if (!acc[frame.pageName]) {
      acc[frame.pageName] = [];
    }
    acc[frame.pageName].push(frame);
    return acc;
  }, {} as Record<string, FrameSummary[]>);

  // =============================================================================
  // FILTER FRAMES BY SEARCH
  // =============================================================================

  const filteredFramesByPage = Object.entries(framesByPage).reduce((acc, [pageName, pageFrames]) => {
    if (!searchQuery) {
      acc[pageName] = pageFrames;
      return acc;
    }

    const query = searchQuery.toLowerCase();
    const filtered = pageFrames.filter(
      (frame) =>
        frame.name.toLowerCase().includes(query) ||
        pageName.toLowerCase().includes(query)
    );

    if (filtered.length > 0) {
      acc[pageName] = filtered;
    }

    return acc;
  }, {} as Record<string, FrameSummary[]>);

  // =============================================================================
  // LOADING STATE
  // =============================================================================

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Loading frames from Figma...</span>
        </div>
      </div>
    );
  }

  // =============================================================================
  // ERROR STATE - OAUTH NEEDED
  // =============================================================================

  if (error && needsOAuth) {
    return (
      <div className="rounded-lg border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 text-purple-600 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="text-base font-semibold text-purple-900">Connect Figma Account</h4>
              <p className="text-sm text-purple-800 mt-1">
                To load frames from your Figma file, you need to authorize PixelProof to access your Figma account.
              </p>
              <p className="text-sm text-purple-700 mt-2">
                This is a one-time setup. Click below to connect securely via Figma OAuth.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <a
              href={`/api/figma/start?projectId=${projectId}&returnTo=/projects/${projectId}/setup`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-sm"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0a12 12 0 00-3.934 23.358c.045-.006.088-.023.131-.033V19.83a.75.75 0 01-.102-.004c-1.134-.18-1.875-.612-2.414-1.415-.37-.551-.763-1.838-1.688-2.011-.28-.052-.35-.265-.084-.399.868-.438 1.484.305 2.016 1.05.533.744.916 1.002 1.656.896.18-.026.354-.074.52-.141a2.25 2.25 0 01.67-1.424c-2.42-.276-3.968-1.462-4.532-3.285a5.25 5.25 0 01-.178-2.64c.037-.235.084-.468.14-.698a4.125 4.125 0 01-.225-1.822c.067-.48.24-.938.5-1.32.02-.028.045-.052.072-.072.532-.39 1.746-.204 3.006.63a10.5 10.5 0 015.436 0c1.26-.834 2.474-1.02 3.006-.63.027.02.052.044.072.072.26.382.433.84.5 1.32.067.48.054.964-.038 1.435-.091.47-.24.918-.44 1.305.056.23.103.463.14.698.184.86.184 1.78-.178 2.64-.564 1.823-2.112 3.009-4.532 3.285.33.397.514.896.528 1.424v4.495c.043.01.086.027.131.033A12 12 0 0012 0z"/>
              </svg>
              Connect Figma
            </a>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-purple-700 hover:text-purple-800 hover:bg-purple-100 rounded-lg transition-colors"
            >
              I already connected
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================================
  // ERROR STATE - OTHER ERRORS
  // =============================================================================

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-red-600 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-red-800">Failed to load frames</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-red-600 hover:text-red-700 font-medium mt-2 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================================
  // EMPTY STATE
  // =============================================================================

  if (frames.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No frames found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Your Figma file doesn't contain any frames, or they couldn't be loaded.
        </p>
      </div>
    );
  }

  // =============================================================================
  // FRAME SELECTION UI
  // =============================================================================

  return (
    <div className="space-y-4">
      {/* Search Input */}
      {frames.length > 5 && (
        <div className="relative">
          <input
            type="text"
            placeholder="Search frames..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={disabled}
            className="w-full px-4 py-2 pl-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      )}

      {/* Frames List */}
      <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
        {Object.entries(filteredFramesByPage).length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No frames match your search
          </div>
        ) : (
          Object.entries(filteredFramesByPage).map(([pageName, pageFrames]) => (
            <div key={pageName} className="border-b border-gray-200 last:border-b-0">
              {/* Page Header */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {pageName}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {pageFrames.length} {pageFrames.length === 1 ? 'frame' : 'frames'}
                </p>
              </div>

              {/* Frames */}
              <div className="divide-y divide-gray-100">
                {pageFrames.map((frame) => (
                  <label
                    key={frame.id}
                    className={`
                      flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                      ${value === frame.id ? 'bg-blue-50 hover:bg-blue-50' : ''}
                    `}
                  >
                    {/* Radio Input */}
                    <input
                      type="radio"
                      name="figmaFrame"
                      value={frame.id}
                      checked={value === frame.id}
                      onChange={(e) => onChange(e.target.value)}
                      disabled={disabled}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />

                    {/* Frame Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {frame.name}
                        </p>
                        {frame.depth && frame.depth > 0 && (
                          <span className="text-xs text-gray-500">
                            (nested)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {frame.width} × {frame.height}px
                      </p>
                    </div>

                    {/* Selected Indicator */}
                    {value === frame.id && (
                      <svg
                        className="h-5 w-5 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Frame Count */}
      <p className="text-xs text-gray-500">
        {Object.values(filteredFramesByPage).reduce((sum, frames) => sum + frames.length, 0)} of{' '}
        {frames.length} frames
        {searchQuery && ' (filtered)'}
      </p>
    </div>
  );
}

