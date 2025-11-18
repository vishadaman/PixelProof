// =============================================================================
// RUNS TABLE COMPONENT
// =============================================================================
// Displays a table of recent QA runs with status, findings, and actions

'use client';

import { useState } from 'react';
import type { Run } from '@pixelproof/types';

// TODO: Replace with actual data from API
const MOCK_RUNS: Run[] = [
  {
    id: '1',
    projectId: 'proj_1',
    prNumber: 123,
    commitSha: 'abc1234',
    url: 'https://preview-123.vercel.app',
    routes: ['/'],
    status: 'passed',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 3000000).toISOString(),
    findings: [],
  },
  {
    id: '2',
    projectId: 'proj_1',
    prNumber: 122,
    commitSha: 'def5678',
    url: 'https://preview-122.vercel.app',
    routes: ['/', '/about'],
    status: 'failed',
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    completedAt: new Date(Date.now() - 6600000).toISOString(),
    findings: [
      {
        id: 'f1',
        runId: '2',
        type: 'a11y',
        severity: 'high',
        selector: 'button.submit',
        description: 'Button missing accessible name',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'f2',
        runId: '2',
        type: 'visual',
        severity: 'medium',
        selector: '.hero-section',
        description: 'Visual diff detected (12.3% difference)',
        screenshotUrl: 'https://example.com/diff.png',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: '3',
    projectId: 'proj_2',
    url: 'https://example.com',
    routes: ['/'],
    status: 'running',
    startedAt: new Date(Date.now() - 300000).toISOString(),
    findings: [],
  },
];

export function RunsTable() {
  const [runs] = useState<Run[]>(MOCK_RUNS);

  // TODO: Fetch runs from API
  // useEffect(() => {
  //   async function fetchRuns() {
  //     const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/runs`);
  //     const data = await response.json();
  //     setRuns(data);
  //   }
  //   fetchRuns();
  // }, []);

  if (runs.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <p className="text-gray-600">No runs yet. Trigger your first run to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Run ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PR / URL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Findings
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Started
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// RUN ROW COMPONENT
// -----------------------------------------------------------------------------

function RunRow({ run }: { run: Run }) {
  const statusColors = {
    queued: 'badge-info',
    running: 'badge-info',
    passed: 'badge-success',
    failed: 'badge-error',
    cancelled: 'badge-warning',
  };

  const criticalCount = run.findings.filter((f) => f.severity === 'critical').length;
  const highCount = run.findings.filter((f) => f.severity === 'high').length;
  const mediumCount = run.findings.filter((f) => f.severity === 'medium').length;
  const lowCount = run.findings.filter((f) => f.severity === 'low').length;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="code text-xs">{run.id.slice(0, 8)}</span>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          {run.prNumber && (
            <span className="text-sm font-medium text-gray-900">
              PR #{run.prNumber}
            </span>
          )}
          <a
            href={run.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-600 hover:text-primary-700 truncate max-w-xs"
          >
            {run.url}
          </a>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`badge ${statusColors[run.status]}`}>
          {run.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex gap-2 text-xs">
          {criticalCount > 0 && (
            <span className="text-severity-critical font-semibold">
              {criticalCount} critical
            </span>
          )}
          {highCount > 0 && (
            <span className="text-severity-high font-semibold">
              {highCount} high
            </span>
          )}
          {mediumCount > 0 && (
            <span className="text-severity-medium">
              {mediumCount} medium
            </span>
          )}
          {lowCount > 0 && (
            <span className="text-severity-low">
              {lowCount} low
            </span>
          )}
          {run.findings.length === 0 && (
            <span className="text-gray-500">No issues</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {new Date(run.startedAt).toLocaleString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <button className="text-primary-600 hover:text-primary-700 font-medium">
          View Details
        </button>
      </td>
    </tr>
  );
}

