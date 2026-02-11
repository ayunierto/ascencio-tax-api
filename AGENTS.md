# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Running the Application
```bash
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm start                # Start production server
npm run start:prod-local # Start production server locally (STAGE=prod)
```

### Code Quality
```bash
npm run lint       # Run ESLint with auto-fix
npm run format     # Format code with Prettier
```

### Testing
```bash
npm test           # Run tests with Jest
npm run test:watch # Run tests in watch mode
npm run test:cov   # Run tests with coverage
npm run test:e2e   # Run end-to-end tests
```

### Database
```bash
# TypeORM migrations
npm run typeorm -- migration:generate src/migrations/MigrationName  # Generate migration from entity changes
npm run migration:run                                                # Run pending migrations
npm run migration:revert                                             # Revert last migration
npm run migration:show                                               # Show migrations status
```

**Note**: In development, TypeORM runs with `synchronize: true` (auto-creates tables). For production, this should be set to `false` and migrations should be used instead.

### Docker
```bash
docker-compose up -d    # Start PostgreSQL database
docker build -t ascencio-api .
docker run -p 3000:3000 --env-file .env ascencio-api
```

## Architecture Overview

### Framework & Stack
- **Framework**: NestJS 10 (Node.js 22.x)
- **Database**: PostgreSQL with TypeORM 0.3.20
- **API**: RESTful with Swagger documentation at `/api/docs`
- **Versioning**: URI-based (default v1) via `/api/v1/...`
- **Validation**: Zod schemas with custom pipe (`ZodValidationPipe`)
- **Authentication**: JWT with Bearer tokens (via `AuthGuard`)

### Module Organization

The codebase follows NestJS modular architecture with clear domain separation:

#### Core Modules
- **auth**: Authentication & authorization system
  - JWT-based authentication with configurable expiry
  - Role-based access control (SuperUser, Admin, Staff, User)
  - Google OAuth integration (optional, configurable via env vars)
  - Guards: `AuthGuard` (JWT verification), `RolesGuard` (role checking)
  - Decorators: `@Auth(...roles)` combines both guards, `@GetUser()` extracts user from request

#### Bookings System
Located in `src/bookings/`:
- **appointments**: Core appointment booking logic
  - Integrates with Google Calendar and Zoom
  - Uses `DateUtils` for timezone handling (primarily America/Toronto)
  - Notification system for appointment events
- **services**: Tax service definitions (Personal Tax, Corporate Tax, etc.)
- **staff-members**: Staff management and availability
- **schedules**: Weekly availability schedules (dayOfWeek-based, 0=Sunday)
- **availability**: Real-time availability calculation

#### Accounting System
Located in `src/accounting/`:
- **expenses**: Expense tracking with OCR and OpenAI integration for receipt parsing
- **categories/subcategories**: Expense categorization
- **companies**: Company management (T1/T2 tax entities)
- **clients**: Client relationship management
- **employees**: Employee records for payroll/tax
- **invoices**: Invoice generation with line items
- **payments**: Payment tracking and receipts
- **accounts-receivable**: AR tracking and aging reports
- **reports**: Financial reporting
- **dashboard**: Aggregated metrics

#### Integrations
- **calendar**: Google Calendar API wrapper (service account auth)
- **zoom**: Zoom meeting creation for virtual appointments
- **mail**: Email via Mailersend (production) or SMTP (dev)
- **notification**: Appointment notifications (email/SMS)
- **files**: Cloudinary file storage for uploads
- **ocr**: Tesseract.js for receipt text extraction
- **openai**: AI-powered expense categorization and data extraction

#### Utilities
- **seed**: Database seeding (runs automatically on startup if not executed)
- **system-settings**: Key-value config store (timezone, locale, etc.)
- **logs**: Activity logging
- **common**: Shared DTOs (e.g., `PaginationDto`), pipes (`ZodValidationPipe`)

### Key Architectural Patterns

#### Authentication Flow
1. Use `@Auth(...roles)` decorator on controllers/routes
2. `AuthGuard` verifies JWT from `Authorization: Bearer <token>` header
3. `RolesGuard` checks user roles against required roles
4. User object attached to request, accessible via `@GetUser()` decorator

Example:
```typescript
@Auth(Role.Admin, Role.Staff)
@Get()
findAll(@GetUser() user: User) {
  // user is authenticated and has Admin or Staff role
}
```

#### Entity Structure
- All entities use UUID primary keys (`@PrimaryGeneratedColumn('uuid')`)
- Standard timestamps: `@CreateDateColumn()`, `@UpdateDateColumn()`
- Soft deletes typically via `deletedAt` column (nullable)
- TypeORM decorators with Swagger `@ApiProperty()` for documentation

#### Shared Package
The `@ascencio/shared` package (from GitHub private repo) contains:
- Shared TypeScript interfaces (e.g., `SimpleUser`)
- Zod validation schemas
- Utility functions (e.g., `parseZodIssueMessage`)
- Reused between API and frontend

#### Environment Configuration
- Uses `@nestjs/config` with global scope
- `.env.example` provides comprehensive template
- `STAGE` env var controls behavior: `dev`, `test`, `prod`
- Railway deployment uses `DATABASE_URL` directly

### Data Flow Patterns

#### Appointments
1. Client creates appointment via `AppointmentsController`
2. `AppointmentsService` validates availability against staff schedules
3. Calendar event created in Google Calendar (`CalendarService`)
4. Zoom meeting link generated (if virtual appointment)
5. Notification sent via `NotificationModule`
6. All operations within transaction context

#### Expense Processing
1. Receipt image uploaded via `FilesController` → Cloudinary
2. OCR extraction via `OcrService` (Tesseract.js)
3. OpenAI analyzes text to extract amount, date, merchant, category
4. Expense created with suggested categorization
5. Log entry created via `LogsModule`

## Code Style & Conventions

### Formatting
- **Prettier**: Single quotes, trailing commas
- **ESLint**: TypeScript recommended rules with NestJS plugin
- Run `npm run format` before committing

### Module Structure
Each feature module follows:
```
module-name/
├── dto/
│   ├── create-module.dto.ts
│   └── update-module.dto.ts
├── entities/
│   └── module.entity.ts
├── module.controller.ts
├── module.service.ts
└── module.module.ts
```

### DTOs
- Use class-validator decorators for validation (legacy)
- Prefer Zod schemas with `ZodValidationPipe` for new code
- Extend `PaginationDto` from `src/common/dto/pagination.dto` for list endpoints

### Testing
- Unit tests: `*.spec.ts` files (Jest)
- Limited test coverage currently (see `date.utils.spec.ts`, `user.mapper.spec.ts` for examples)
- Run specific test: `npm test -- path/to/test.spec.ts`

## Database

### Connection
- PostgreSQL 14+
- TypeORM with entity auto-loading
- Development: `synchronize: true` (auto-creates schema)
- Production: `synchronize: false` (use migrations)

### Seeding
The seed runs automatically on application startup (`main.ts`) if not previously executed:
- Creates system settings (timezone, locale)
- Seeds default users (admin/staff roles)
- Creates initial schedules (Mon-Fri, 9:30-19:30)
- Adds sample staff members and services
- Populates expense categories/subcategories

Access manually: `curl http://localhost:3000/api/seed` or visit in browser.

## External Services

All require environment variables (see `.env.example`):

- **PostgreSQL**: Database (`DATABASE_URL` or individual DB_* vars)
- **Google Calendar**: Service account auth (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`)
- **Zoom**: OAuth app credentials for meeting creation
- **Mailersend**: Production email service
- **Cloudinary**: File/image storage
- **OpenAI**: GPT models for expense analysis

## Important Notes

- **Timezone**: Default timezone is `America/Toronto`, configurable via `BUSINESS_TZ`
- **API Documentation**: Always available at `http://localhost:3000/api/docs` (Swagger)
- **Port**: Defaults to 3000, override with `PORT` or `API_PORT` env var
- **CORS**: Enabled with credentials support for frontend integration
- **JWT**: Secret and expiry configurable via `JWT_SECRET` and `JWT_EXPIRY`
- **Synchronize**: MUST be `false` in production to prevent data loss
- **Google OAuth**: Only enabled if `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` are set

## Common Tasks

### Adding a New Module
```bash
nest g resource module-name --no-spec
# Creates controller, service, module, DTOs, entities
# Register in app.module.ts imports
```

### Creating a Protected Endpoint
```typescript
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from 'src/auth/enums/role.enum';

@Auth(Role.Admin) // Requires authentication + Admin role
@Get('sensitive-data')
getSensitiveData() {
  // Implementation
}
```

### Adding a New Entity
1. Create entity file with TypeORM decorators
2. Import in module's `TypeOrmModule.forFeature([Entity])`
3. Add Swagger `@ApiProperty()` decorators for documentation
4. If production, generate migration: `npm run typeorm -- migration:generate src/migrations/AddEntity`

### Working with Dates/Times
- Use `luxon` library (already imported project-wide)
- Default timezone: `America/Toronto`
- `DateUtils` class in appointments module for timezone conversions
- Store as `timestamp with time zone` in database
