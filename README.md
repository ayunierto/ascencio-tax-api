# Ascencio Tax Inc

Welcome to the **Ascencio Tax Inc** monorepository. This repository contains the backend API, web application, mobile app, and shared packages, all organized and orchestrated with **Turborepo** for efficient development and builds.

## Repository Structure

```
ascencio-tax-monorepo/
├── apps/
│   ├── api/          # Backend service (NestJS) — Port 3000
│   ├── web/          # Web application (Next.js) — Port 4000
│   └── mobile/       # Mobile app (Expo + React Native)
├── packages/
│   └── shared/       # Shared TypeScript library (types, Zod schemas, utilities)
└── postgres-data/    # PostgreSQL data directory (Docker volume)
```

This structure provides clear separation of concerns while enabling seamless code sharing across web, mobile, and backend applications.

## Prerequisites

Before getting started, ensure you have the following installed:

- **Node.js** (LTS version recommended — v18 or higher)
- **Docker** & **Docker Compose**
- **npm** (or `pnpm`/`yarn` if preferred — adjust commands accordingly)
- **EAS CLI** (for mobile builds): `npm install -g eas-cli`
- **iOS Simulator** (macOS with Xcode) or **Android Studio with emulator** (for mobile testing)
- **Development Build** required (app uses native modules, not compatible with Expo Go)

## Quick Start (Development)

Follow these steps to set up your local development environment:

### 1. Clone and Navigate to the Repository

```pwsh
git clone <repository-url>
cd ascencio-tax-monorepo
```

### 2. Configure Environment Variables

Create your local environment file from the example template:

```pwsh
cp .env.example .env
```

**Important:** Edit `.env` with your actual credentials and configuration settings before proceeding.

### 3. Start the Database Container

Launch the PostgreSQL database using Docker Compose:

```pwsh
docker-compose up -d
```

This will start the database in detached mode. Verify it's running with `docker-compose ps`.

### 4. Install Dependencies

Install all dependencies for the monorepo:

```pwsh
npm install
```

### 5. Build the Shared Package

**Critical:** Build the shared package before starting development. The `@ascencio/shared` package must be compiled first since both `api` and `web` applications depend on it:

```pwsh
npm run build --filter=@ascencio/shared
```

This compiles the TypeScript code in `packages/shared` to the `dist/` directory, making it available for import by other packages.

### 6. Start Development Mode

Start all applications in development mode:

```pwsh
npm run dev
```

This will start:

- **API** at `http://localhost:3000`
- **Web** at `http://localhost:4000`
- **Mobile** with Expo Metro bundler (requires development build)

**Note:** The TurboRepo TUI (Terminal UI) mode provides separated log panels for each application, preserving the Expo QR code visibility.

### 7. Build and Run Mobile App (Development Build)

Since the mobile app uses native modules, you need to create a development build:

#### First Time Setup:

```pwsh
cd apps/mobile

# Login to Expo account
eas login

# Configure the project (if not already done)
eas build:configure

# Create development build for iOS
eas build --profile development --platform ios

# Create development build for Android
eas build --profile development --platform android

# Or build for both platforms
eas build --profile development --platform all
```

#### Running the Development Build:

- **React Version:** The monorepo uses React 19.1.0 across all apps (unified for Next.js and React Native compatibility).
- **Mobile Metro Config:** The mobile app is configured for monorepo structure with proper node_modules resolution order.
- **Native Modules:** The mobile app uses native modules and requires development builds (EAS Build). It cannot run on Expo Go.
- **Development Builds:** After creating a development build once, you can reuse it for development. Rebuild only when native dependencies change.
- **Environment Variables:**
  - API uses `.env` in the root
  - Mobile uses `apps/mobile/.env` (includes API versioning `/v1`)
- **Package Managers:** If using `pnpm` or `yarn`, replace `npm` commands accordingly.

# - For iOS: Install the .app file on simulator or .ipa on physical device

# - For Android: Install the .apk on emulator or physical device

# - Scan the QR code from the development build app (not Expo Go)

````

### 8. (Optional) Run a Single Application

For focused development on a specific app:

```pwsh
# Backend only
npx turbo run dev --filter=api

# Frontend only
npx turbo run dev --filter=web

# Mobile only
cd apps/mobile && npm run dev
# or
npx turbo run dev --filter=mobile
````

## Development Notes

- **Turborepo** manages task orchestration and caching across the monorepo. The `--filter` flag scopes commands to specific packages.
- **Hot Reload:** All applications support hot module replacement (HMR) in development mode.
- **Shared Package Changes:** When modifying `packages/shared`, run it in watch mode for automatic rebuilds:
  ```pwsh
  npx turbo run dev --filter=@ascencio/shared
  ```
- **React Version:** The monorepo uses React 19.1.0 across all apps (unified for Next.js and React Native compatibility).
- **Mobile Metro Config:** The mobile app is configured for monorepo structure with proper node_modules resolution order.
- **Environment Variables:**
  - API uses `.env` in the root
  - Mobile uses `apps/mobile/.env` (includes API versioning `/v1`)
- **Package Managers:** If using `pnpm` or `yarn`, replace `npm` commands accordingly.

## Available Scripts

The following npm scripts are available at the monorepo root level:

| Command         | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `npm run dev`   | Start all applications in development mode with hot reload |
| `npm run build` | Build all applications and packages for production         |
| `npm run lint`  | Run ESLint across the entire repository                    |

### Package-Specific Scripts

Each package has its own scripts. To run package-specific commands:

```pwsh
# Run a script for a specific package
npx turbo run <script-name> --filter=<package-name>

# Examples:
npx turbo run test --filter=api
npx turbo run build --filter=web
npx turbo run dev --filter=mobile
```

Refer to individual `package.json` files in `apps/*` and `packages/*` for available scripts.

## Technology Stack

### Backend (API)

- **NestJS** v10 - Progressive Node.js framework
- **TypeORM** - Database ORM with PostgreSQL
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Luxon** - Date/time handling

### Web Frontend

- **Next.js** 16 with Turbopack
- **React** 19.1.0
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Animations

### Mobile App

- **Expo SDK** 54
- **React Native** 0.81.5
- **React** 19.1.0
- **Expo Router** - File-based navigation
- **TypeScript** - Type safety

### Shared Infrastructure

- **TurboRepo** - Monorepo orchestration
- **npm workspaces** - Dependency management
- **TypeScript** - Shared types and utilities
- **Zod** - Schema validation
- **PostgreSQL** - Database (Docker)

## Project Roadmap

For detailed information about development phases, priorities, and milestones, see:

📋 **[PROJECT_MASTER_PLAN.md](./PROJECT_MASTER_PLAN.md)**

## Contributing

We welcome contributions to improve this project. To contribute:

1. **Report Issues:** Open an issue for bugs or feature requests with detailed descriptions
2. **Submit Pull Requests:** Follow the repository's coding standards and include tests where applicable
3. **Code Review:** All PRs require review before merging

Please ensure your code passes linting and builds successfully before submitting.

## License

This repository contains proprietary code for **Ascencio Tax Inc**.  
All rights reserved © 2025 Ascencio Tax Inc.

---

**Questions or Support?** Contact the development team or open an issue in this repository.
