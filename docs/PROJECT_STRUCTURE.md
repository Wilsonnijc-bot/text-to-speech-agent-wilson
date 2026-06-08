# Project Structure

This repository keeps framework-required configuration at the root and groups application code by responsibility.

```text
.
├── api/                       # Hono + tRPC server
│   ├── lib/                   # Server utilities
│   ├── queries/               # Database connection/query helpers
│   └── routers/               # tRPC routers
├── contracts/                 # Shared API contracts
├── db/                        # Drizzle database schema and migrations
├── docs/                      # Project notes and supporting docs
├── src/                       # React frontend
│   ├── components/ui/         # Reusable UI primitives
│   ├── features/
│   │   └── text-to-speech/    # Wilson product feature
│   │       ├── components/    # Feature-specific UI
│   │       └── types/         # Feature-specific frontend types
│   ├── pages/                 # Route components
│   ├── providers/             # React providers
│   └── lib/                   # Shared frontend helpers
└── config files               # Vite, TypeScript, Tailwind, Drizzle, ESLint, Vitest
```

Root-level config files are intentionally kept in place because the related tools expect them there by default.
