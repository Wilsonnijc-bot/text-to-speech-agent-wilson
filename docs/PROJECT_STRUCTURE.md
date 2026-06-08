# Project Structure

This repository keeps the GitHub root compact and groups application code by responsibility. Tooling configuration lives under `config/`, with npm scripts pointing each tool to the right file.

```text
.
├── api/                       # Hono + tRPC server
│   ├── lib/                   # Server utilities
│   ├── queries/               # Database connection/query helpers
│   └── routers/               # tRPC routers
├── config/                    # Project configuration
│   ├── docker/                # Docker ignore rules
│   ├── env/                   # Environment variable example
│   ├── platform/              # Platform metadata
│   ├── prettier/              # Prettier config and ignore rules
│   ├── shadcn/                # shadcn/ui registry config
│   ├── tsconfig/              # TypeScript project configs
│   ├── drizzle.config.ts      # Drizzle Kit config
│   ├── eslint.config.js       # ESLint flat config
│   ├── postcss.config.js      # PostCSS config
│   ├── tailwind.config.js     # Tailwind theme/content config
│   ├── vite.config.ts         # Vite app/build config
│   └── vitest.config.ts       # Vitest config
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
├── index.html                 # Vite HTML entry
├── package.json               # npm scripts and dependencies
└── package-lock.json          # npm dependency lockfile
```

`package.json`, `package-lock.json`, `README.md`, `.gitignore`, and `index.html` stay at the root because npm, GitHub, Git, and Vite expect those locations by convention. The scripts in `package.json` explicitly point to the moved config files.
