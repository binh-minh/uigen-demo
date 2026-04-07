# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps, generate Prisma client, run migrations
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint validation
npm run test         # Run Vitest test suite
npm run db:reset     # Reset and recreate the database
```

Run a single test file:
```bash
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx
```

## Architecture

UIGen is an AI-powered React component generator. Users describe components in natural language; Claude generates and edits them live via a streaming chat interface.

### Request Flow

1. User types a prompt → `ChatContext` sends it via `useAIChat` (`@ai-sdk/react`) to `POST /api/chat`
2. `api/chat/route.ts` calls `streamText` with the generation system prompt and two AI tools:
   - `str_replace_editor` — targeted string replacement in existing files
   - `file_manager` — create/delete files and directories
3. Tool calls stream back to the client; `FileSystemContext` processes them, updating the in-memory virtual file system
4. `PreviewFrame` re-renders: files are collected, an import map is built, JSX is compiled with Babel standalone, and the result is injected into a sandboxed `<iframe>`

### Key Abstractions

**Virtual File System** (`src/lib/file-system.ts`, `src/lib/contexts/file-system-context.tsx`)
All files exist only in memory as a `Map<path, FileNode>`. The state serializes to JSON and persists in the `Project.data` DB column for authenticated users. There is no real disk I/O for generated files.

**Language Model Provider** (`src/lib/provider.ts`)
Exports either the real `claude-haiku-4-5` model (when `ANTHROPIC_API_KEY` is set) or a `MockLanguageModel` that returns static component code. The mock is used automatically in tests and when the API key is absent.

**JSX Transformation** (`src/lib/transform/jsx-transformer.ts`)
Converts the virtual file system into a self-contained HTML page by building a browser-native import map and embedding a Babel standalone transform. Tailwind CSS is loaded via CDN in the preview.

**Authentication** (`src/lib/auth.ts`, `src/actions/`)
JWT sessions via `jose`, stored in HTTPOnly cookies (`session` key). Server actions in `src/actions/` handle sign-up, sign-in, sign-out, and all project CRUD. The middleware (`src/middleware.ts`) protects `/api/projects` and `/api/filesystem`.

**UI Layout** (`src/app/main-content.tsx`)
Three-panel resizable layout (RadixUI): left = chat, right = live preview or Monaco code editor + file tree. `FileSystemProvider` and `ChatProvider` wrap the whole UI.

### Database

SQLite via Prisma (`prisma/schema.prisma`), stored at `prisma/dev.db`. The generated client outputs to `src/generated/prisma`.

Two models:
- `User` — `id` (cuid), `email` (unique), `password` (bcrypt hash), timestamps. Has many `Project`s.
- `Project` — `id` (cuid), `name`, optional `userId` FK (cascade delete), `messages` (JSON string, default `"[]"`), `data` (JSON string, default `"{}"`), timestamps. `messages` holds chat history; `data` holds the serialized virtual file system for authenticated users.

### Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`). All internal imports use this alias.

## Environment

`ANTHROPIC_API_KEY` is optional. Without it the mock provider activates automatically — no setup needed for local development without real AI calls.
