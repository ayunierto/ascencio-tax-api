# Ascencio Tax API

Backend API for Ascencio Tax Inc - A comprehensive tax management and appointment booking platform.

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x
- PostgreSQL 14+
- Docker (optional, for containerized deployment)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development
npm run dev
```

The API will be available at `http://localhost:3000`

## 🐳 Docker Deployment

### Build and Run

```bash
# Build image
docker build -t ascencio-api .

# Run container
docker run -p 3000:3000 --env-file .env ascencio-api
```

### Using Docker Compose

```bash
docker-compose up -d
```

## 📦 Project Structure

```
src/
├── accounting/       # Expense tracking, reports
├── appointments/     # Booking system
├── auth/            # Authentication & authorization
├── bookings/        # Services, schedules, staff
├── calendar/        # Google Calendar integration
├── files/           # File upload (Cloudinary)
├── mail/            # Email service (Mailersend)
├── notification/    # Appointment notifications
├── openai/          # AI-powered features
├── seed/            # Database seeding
└── zoom/            # Video meeting integration
```

## 🔑 Environment Variables

Create a `.env` file with these variables:

```env
# Server
PORT=3000
STAGE=prod

# Database (automatically provided by Railway)
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-secret
JWT_EXPIRY=60m

# Email (Mailersend)
MAILERSEND_API_KEY=mlsn...
MAILERSEND_SENDER_EMAIL=support@ascenciotax.com

# Google OAuth (Login + Calendar)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
GOOGLE_CALENDAR_CALLBACK_URL=http://localhost:3000/calendar/oauth/callback

# Calendar OAuth & Webhooks
ENCRYPTION_KEY=...       # 64 hex chars
WEBHOOK_BASE_URL=...
API_URL=http://localhost:3000

# Cloudinary (File Storage)
CLOUDINARY_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Zoom
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...

# OpenAI
OPENAI_API_KEY=sk-proj-...
```

## 📚 API Documentation

Once running, access Swagger documentation at:

```
http://localhost:3000/api/docs
```

## 🛠️ Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## 🗄️ Database

### Initialization

The API uses TypeORM with `synchronize: true` in development mode to automatically create tables.

### Seeding

Populate initial data:

```bash
# Via API endpoint
curl http://localhost:3000/api/seed

# Or access in browser
http://localhost:3000/api/seed
```

## 🚢 Deployment

### Railway

1. Connect GitHub repo
2. Add PostgreSQL service
3. Set environment variables
4. Deploy automatically on push

### Production Checklist

- ✅ `STAGE=prod` in environment
- ✅ `DATABASE_URL` configured
- ✅ All API keys set
- ✅ SSL enabled (automatic with Railway)
- ✅ `synchronize: false` (safety in production)

## 🔗 Dependencies

### Core

- NestJS 10
- TypeORM 0.3.20
- PostgreSQL (pg)

### Integrations

- Google Calendar API
- Zoom API
- OpenAI API
- Mailersend
- Cloudinary

### Shared Package

- `@ascencio/shared` - Types, schemas, utilities (from GitHub)

## 📄 License

Proprietary - Ascencio Tax Inc © 2025
