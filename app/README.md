# PixelProof Frontend

Next.js 14 frontend for PixelProof design QA automation.

## Setup

1. Install dependencies (from root):
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your values
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:3000

## Project Structure

- `src/app/` - App Router pages and API routes
  - `layout.tsx` - Root layout with navigation
  - `page.tsx` - Home/dashboard page
  - `api/status/route.ts` - Health check API route
- `src/components/` - React components
  - `Navbar.tsx` - Main navigation bar
  - `RunsTable.tsx` - Table of QA runs
- `src/lib/` - Utilities
  - `env.ts` - Environment variable validation (Zod)
- `src/styles/` - Global styles (Tailwind CSS)

## Key Features

### Dashboard
- View recent QA runs
- Quick stats (total runs, issues found)
- Trigger new runs

### Runs Table
- List of all runs with status
- Findings count by severity
- Links to detailed results

## Development

Run dev server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
npm start
```

Type checking:
```bash
npm run typecheck
```

Linting:
```bash
npm run lint
```

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:3001)

Note: Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

## TODO

- [ ] Add authentication (NextAuth.js)
- [ ] Create project management pages
- [ ] Add run detail page with findings
- [ ] Implement shadcn/ui components
- [ ] Add dark mode support
- [ ] Create charts for trends
- [ ] Add real-time updates (WebSocket/SSE)

