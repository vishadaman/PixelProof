// =============================================================================
// BASELINE SNAPSHOT GENERATOR
// =============================================================================
// Creates baseline snapshots of Figma design tokens and components
// Stores normalized data for comparison against live implementations

import { prisma } from '@/lib/prisma';
import {
  fetchFigmaFile,
  fetchFigmaVariablesAndStyles,
  type FigmaNode,
  type FigmaVariable,
  type FigmaStyle,
  FigmaApiError,
} from '@/lib/figma';
import type {
  FigmaBaselineData,
  TypographyToken,
  ColorToken,
  ShadowToken,
  FigmaComponent,
} from '@pixelproof/types';

// =============================================================================
// TYPES
// =============================================================================

interface ExtractedTokens {
  typography: Record<string, TypographyToken>;
  colors: Record<string, ColorToken>;
  spacing: Record<string, number>;
  radii: Record<string, number>;
  shadows: Record<string, ShadowToken>;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Creates or updates a baseline snapshot for a project
 * 
 * This function:
 * 1. Validates project has Figma file and frame configured
 * 2. Fetches Figma file data, variables, and styles
 * 3. Extracts design tokens (typography, colors, spacing)
 * 4. Extracts components from the selected frame
 * 5. Stores normalized data in BaselineSnapshot table
 * 
 * @param projectId - The project ID
 * @returns The created/updated baseline snapshot
 * @throws Error if project not found, missing configuration, or API fails
 * 
 * @example
 * const snapshot = await createBaselineSnapshotForProject('clxy123');
 * console.log('Snapshot created:', snapshot.id);
 */
export async function createBaselineSnapshotForProject(projectId: string) {
  console.log('Creating baseline snapshot', { projectId });

  // =============================================================================
  // 1. LOAD AND VALIDATE PROJECT
  // =============================================================================

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      figmaFileKey: true,
      figmaFrameId: true,
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (!project.figmaFileKey) {
    throw new Error(`Project ${projectId} is not linked to a Figma file`);
  }

  if (!project.figmaFrameId) {
    throw new Error(`Project ${projectId} has no Figma frame selected`);
  }

  const { figmaFileKey, figmaFrameId } = project;

  // =============================================================================
  // 2. FETCH FIGMA DATA
  // =============================================================================

  let figmaData;
  try {
    // Fetch file and variables in parallel
    figmaData = await fetchFigmaVariablesAndStyles(projectId, figmaFileKey);
  } catch (error) {
    if (error instanceof FigmaApiError) {
      console.error('Figma API error while creating baseline', {
        projectId,
        statusCode: error.statusCode,
        message: error.message,
      });
      throw new Error(`Failed to fetch Figma data: ${error.message}`);
    }
    throw error;
  }

  const { file, variables } = figmaData;

  // =============================================================================
  // 3. FIND SELECTED FRAME IN DOCUMENT
  // =============================================================================

  const selectedFrame = findNodeById(file.document, figmaFrameId);
  if (!selectedFrame) {
    throw new Error(`Frame ${figmaFrameId} not found in Figma file`);
  }

  // =============================================================================
  // 4. EXTRACT DESIGN TOKENS
  // =============================================================================

  const tokens: ExtractedTokens = {
    typography: extractTypographyTokens(file.styles),
    colors: extractColorTokens(variables.meta.variables),
    spacing: extractSpacingTokens(variables.meta.variables),
    radii: extractRadiiTokens(variables.meta.variables),
    shadows: extractShadowTokens(file.styles),
  };

  console.log('Extracted tokens', {
    projectId,
    typographyCount: Object.keys(tokens.typography).length,
    colorCount: Object.keys(tokens.colors).length,
    spacingCount: Object.keys(tokens.spacing).length,
  });

  // =============================================================================
  // 5. EXTRACT COMPONENTS FROM FRAME
  // =============================================================================

  const components = extractComponentsFromNode(selectedFrame);

  console.log('Extracted components', {
    projectId,
    componentCount: components.length,
  });

  // =============================================================================
  // 6. BUILD BASELINE DATA
  // =============================================================================

  const baselineData: FigmaBaselineData = {
    tokens,
    components,
    version: file.version,
    capturedAt: new Date().toISOString(),
    metadata: {
      fileName: file.name,
      frameName: selectedFrame.name,
      lastModified: file.lastModified,
    },
  };

  // =============================================================================
  // 7. STORE IN DATABASE (UPSERT)
  // =============================================================================

  // Use a transaction to ensure atomic operations
  const snapshot = await prisma.$transaction(async (tx) => {
    // Check if baseline already exists for this frame
    const existing = await tx.baselineSnapshot.findFirst({
      where: {
        projectId,
        figmaFrameId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      // Update existing baseline
      console.log('Updating existing baseline snapshot', {
        projectId,
        snapshotId: existing.id,
      });

      return await tx.baselineSnapshot.update({
        where: { id: existing.id },
        data: {
          data: baselineData as any, // Prisma JsonValue type
          figmaFileKey,
          figmaFrameId,
        },
      });
    } else {
      // Create new baseline
      console.log('Creating new baseline snapshot', { projectId });

      return await tx.baselineSnapshot.create({
        data: {
          projectId,
          figmaFileKey,
          figmaFrameId,
          data: baselineData as any, // Prisma JsonValue type
        },
      });
    }
  });

  console.log('Baseline snapshot saved successfully', {
    projectId,
    snapshotId: snapshot.id,
    createdAt: snapshot.createdAt,
  });

  return snapshot;
}

// =============================================================================
// EXTRACTION HELPERS
// =============================================================================

/**
 * Find a node by ID in the document tree
 */
function findNodeById(node: FigmaNode, targetId: string): FigmaNode | null {
  if (node.id === targetId) {
    return node;
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Extract typography tokens from Figma text styles
 * 
 * TODO: Figma API types are loosely typed - may need runtime validation
 */
function extractTypographyTokens(
  styles: Record<string, FigmaStyle>
): Record<string, TypographyToken> {
  const typography: Record<string, TypographyToken> = {};

  for (const [id, style] of Object.entries(styles)) {
    // Only process TEXT styles
    if (style.styleType !== 'TEXT') continue;

    // TODO: Need to fetch actual style values from nodes that use this style
    // For now, store minimal metadata
    // In a complete implementation, you'd need to:
    // 1. Find nodes using this style
    // 2. Extract font properties from those nodes
    // 3. Normalize the values

    const name = style.name || `text-${id}`;
    typography[name] = {
      fontFamily: 'Unknown', // TODO: Extract from node
      fontSize: 16, // TODO: Extract from node
      fontWeight: 400, // TODO: Extract from node
      lineHeight: 1.5, // TODO: Extract from node
    };
  }

  return typography;
}

/**
 * Extract color tokens from Figma variables
 * 
 * Figma variables can be:
 * - BOOLEAN
 * - FLOAT (numbers, spacing)
 * - STRING
 * - COLOR (RGBA)
 */
function extractColorTokens(
  variables: Record<string, FigmaVariable>
): Record<string, ColorToken> {
  const colors: Record<string, ColorToken> = {};

  for (const [id, variable] of Object.entries(variables)) {
    // Only process COLOR variables
    if (variable.resolvedType !== 'COLOR') continue;

    const name = variable.name || `color-${id}`;

    // Get first mode's value (usually "Mode 1" or default mode)
    const modeValues = variable.valuesByMode;
    const firstModeId = Object.keys(modeValues)[0];
    const colorValue = modeValues[firstModeId];

    // TODO: Type guard for color value structure
    // Figma color format: { r: 0-1, g: 0-1, b: 0-1, a: 0-1 }
    if (typeof colorValue === 'object' && colorValue !== null) {
      const color = colorValue as any; // TODO: Proper type
      const r = Math.round((color.r || 0) * 255);
      const g = Math.round((color.g || 0) * 255);
      const b = Math.round((color.b || 0) * 255);
      const a = color.a ?? 1;

      colors[name] = {
        hex: rgbToHex(r, g, b),
        rgb: { r, g, b },
        opacity: a,
      };
    }
  }

  return colors;
}

/**
 * Extract spacing tokens from Figma variables
 */
function extractSpacingTokens(
  variables: Record<string, FigmaVariable>
): Record<string, number> {
  const spacing: Record<string, number> = {};

  for (const [id, variable] of Object.entries(variables)) {
    // Only process FLOAT variables that look like spacing
    if (variable.resolvedType !== 'FLOAT') continue;

    const name = variable.name || `spacing-${id}`;
    
    // Check if name suggests this is spacing
    const isSpacing =
      name.toLowerCase().includes('spacing') ||
      name.toLowerCase().includes('space') ||
      name.toLowerCase().includes('gap') ||
      name.toLowerCase().includes('margin') ||
      name.toLowerCase().includes('padding');

    if (!isSpacing) continue;

    // Get first mode's value
    const modeValues = variable.valuesByMode;
    const firstModeId = Object.keys(modeValues)[0];
    const value = modeValues[firstModeId];

    if (typeof value === 'number') {
      spacing[name] = value;
    }
  }

  return spacing;
}

/**
 * Extract border radius tokens from Figma variables
 */
function extractRadiiTokens(
  variables: Record<string, FigmaVariable>
): Record<string, number> {
  const radii: Record<string, number> = {};

  for (const [id, variable] of Object.entries(variables)) {
    if (variable.resolvedType !== 'FLOAT') continue;

    const name = variable.name || `radius-${id}`;
    
    // Check if name suggests this is border radius
    const isRadius =
      name.toLowerCase().includes('radius') ||
      name.toLowerCase().includes('corner') ||
      name.toLowerCase().includes('rounded');

    if (!isRadius) continue;

    const modeValues = variable.valuesByMode;
    const firstModeId = Object.keys(modeValues)[0];
    const value = modeValues[firstModeId];

    if (typeof value === 'number') {
      radii[name] = value;
    }
  }

  return radii;
}

/**
 * Extract shadow tokens from Figma effect styles
 * 
 * TODO: Need to extract actual shadow values from nodes using these styles
 */
function extractShadowTokens(
  styles: Record<string, FigmaStyle>
): Record<string, ShadowToken> {
  const shadows: Record<string, ShadowToken> = {};

  for (const [id, style] of Object.entries(styles)) {
    // Only process EFFECT styles (shadows, blurs)
    if (style.styleType !== 'EFFECT') continue;

    const name = style.name || `shadow-${id}`;

    // TODO: Extract actual shadow values from nodes
    // Placeholder structure
    shadows[name] = {
      type: 'DROP_SHADOW',
      color: {
        hex: '#000000',
        rgb: { r: 0, g: 0, b: 0 },
        opacity: 0.25,
      },
      offset: { x: 0, y: 4 },
      blur: 8,
      spread: 0,
    };
  }

  return shadows;
}

/**
 * Extract components from a node and its children
 * Returns flattened list of components with bounding boxes
 */
function extractComponentsFromNode(node: FigmaNode, depth = 0): FigmaComponent[] {
  const components: FigmaComponent[] = [];
  const MAX_DEPTH = 10; // Prevent infinite recursion

  if (depth > MAX_DEPTH) return components;

  // Check if this node is a component-like type
  const isComponent =
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE' ||
    node.type === 'FRAME' ||
    node.type === 'GROUP';

  if (isComponent && node.absoluteBoundingBox) {
    const bbox = node.absoluteBoundingBox;
    
    // Only include if has valid dimensions
    if (bbox.width > 0 && bbox.height > 0) {
      components.push({
        id: node.id,
        name: node.name || 'Unnamed',
        type: node.type as any,
        bounds: {
          x: Math.round(bbox.x),
          y: Math.round(bbox.y),
          width: Math.round(bbox.width),
          height: Math.round(bbox.height),
        },
      });
    }
  }

  // Recursively extract from children
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      try {
        const childComponents = extractComponentsFromNode(child, depth + 1);
        components.push(...childComponents);
      } catch (error) {
        // Continue with other children if one fails
        console.warn('Error extracting component from child', {
          childId: child.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  return components;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert RGB values to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, n)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Check if a baseline snapshot exists for a project
 */
export async function hasBaselineSnapshot(projectId: string): Promise<boolean> {
  const snapshot = await prisma.baselineSnapshot.findFirst({
    where: { projectId },
  });
  return snapshot !== null;
}

/**
 * Get the latest baseline snapshot for a project
 */
export async function getLatestBaselineSnapshot(projectId: string) {
  return await prisma.baselineSnapshot.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

