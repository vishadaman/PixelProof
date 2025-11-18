#!/bin/bash
# =============================================================================
# FIGMA OAUTH + BASELINE SNAPSHOTS MIGRATION
# =============================================================================
# Run this script to apply the database migration for Figma integration
#
# What it does:
# - Creates FigmaCredential table (OAuth tokens)
# - Creates BaselineSnapshot table (Figma design baselines)
# - Adds figmaFrameId and updatedAt to Project table
# - Generates updated Prisma Client types
#
# Run from: /Users/vishad/Desktop/Project/PixelProof/app

set -e  # Exit on error

echo "🚀 Running Prisma migration for Figma OAuth + Baseline Snapshots..."
echo ""

# Generate and apply migration
npx prisma migrate dev --name figma_oauth_baseline

echo ""
echo "✅ Migration complete!"
echo ""
echo "📊 New tables created:"
echo "  - FigmaCredential (OAuth tokens per project)"
echo "  - BaselineSnapshot (Figma design baselines)"
echo ""
echo "🔧 Updated tables:"
echo "  - Project (added figmaFrameId, updatedAt)"
echo ""
echo "🎯 Next steps:"
echo "  1. Open Prisma Studio: npx prisma studio"
echo "  2. Verify tables exist: FigmaCredential, BaselineSnapshot"
echo "  3. Implement Figma OAuth routes (see MIGRATION_FIGMA_BASELINE.md)"
echo ""

