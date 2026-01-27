# SerikaGIFs

A modern GIF sharing platform built with Next.js, featuring Backblaze B2 storage, PostgreSQL database, and integrations with Tenor, Giphy, and Klipy.

## Features

- 🖼️ Upload and share GIFs (supports GIF, WebP, MP4, WebM)
- 🔍 Search and discover GIFs
- 🏷️ Tag-based organization
- 📁 Collections for organizing favorites
- ❤️ Favorite GIFs
- 👤 User profiles
- 🔐 Authentication via serika-accounts
- 📥 Admin import from Tenor, Giphy, and Klipy
- 🎨 Beautiful dark AMOLED theme with purple accents

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: Backblaze B2 (S3-compatible)
- **UI**: shadcn/ui + Tailwind CSS
- **Icons**: Lucide React
- **Auth**: Custom integration with serika-accounts

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database
- Backblaze B2 account
- serika-accounts instance

### Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL="postgres://user:password@host:port/database"

# Backblaze B2
B2_KEY_ID=your_key_id
B2_APPLICATION_KEY=your_app_key
B2_BUCKET_NAME=your_bucket_name
B2_BUCKET_ID=your_bucket_id
B2_ENDPOINT=s3.region.backblazeb2.com

# Auth
AUTH_INTERNAL_KEY=your_internal_key
ACCOUNTS_URL=https://accounts.serika.dev

# External APIs (optional, for admin imports)
TENOR_API_KEY=your_tenor_key
GIPHY_API_KEY=your_giphy_key
KLIPY_API_KEY=your_klipy_key
```

### Installation

```bash
# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate

# Push database schema
bunx prisma db push

# Start development server
bun run dev
```

## API Reference

### GIFs

- `GET /api/gifs` - List GIFs with pagination and filtering
- `POST /api/gifs` - Upload a new GIF
- `GET /api/gifs/[slug]` - Get GIF details
- `PATCH /api/gifs/[slug]` - Update GIF
- `DELETE /api/gifs/[slug]` - Delete GIF
- `GET /api/gifs/[slug]/favorite` - Check favorite status
- `POST /api/gifs/[slug]/favorite` - Toggle favorite

### Tags

- `GET /api/tags` - List all tags

### Collections

- `GET /api/collections` - List collections
- `POST /api/collections` - Create collection
- `GET /api/collections/[id]` - Get collection details
- `PATCH /api/collections/[id]` - Update collection
- `DELETE /api/collections/[id]` - Delete collection
- `POST /api/collections/[id]/gifs` - Add GIF to collection
- `DELETE /api/collections/[id]/gifs` - Remove GIF from collection

### Admin (requires admin role)

- `GET /api/admin/import/tenor` - Search Tenor
- `POST /api/admin/import/tenor` - Import from Tenor
- `GET /api/admin/import/giphy` - Search Giphy
- `POST /api/admin/import/giphy` - Import from Giphy
- `GET /api/admin/import/klipy` - Search Klipy
- `POST /api/admin/import/klipy` - Import from Klipy
- `GET /api/admin/import/jobs` - List import jobs

### Auth

- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session

## Brand Colors

The site uses a purple and AMOLED black theme:

- **Primary Purple**: `oklch(0.641 0.281 293.009)` (#8b5cf6)
- **Background (Dark)**: `oklch(0 0 0)` (Pure black)
- **Card Background**: `oklch(0.08 0 0)` (Near black)

## License

MIT
