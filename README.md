# Ghana Lottery Explorer

A modern, professional web application for exploring and analyzing Ghana Lottery draw results. Built with React, TypeScript, Express, and PostgreSQL.

## Features

- **Draw Management**: Store and retrieve lottery draws with 5 winning numbers and 5 machine numbers (all from 1-90)
- **Advanced Search**: Search draws by numbers with multiple modes (exact, partial, winning-only, machine-only, group)
- **Analytics Dashboard**: 
  - Number frequency analysis (daily, weekly, monthly, yearly)
  - Hot/Cold number detection
  - Sleeping number identification
  - Visual charts and statistics
- **Pattern Detection**: Identify recurring patterns and similarities across draws
- **Modern UI**: Responsive, accessible interface with Tailwind CSS

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Recharts for data visualization
- React Router for navigation
- Axios for API calls

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL database
- Zod for validation

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Git

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd "Ghana Lottery Explorer"
```

### 2. Install dependencies

```bash
npm run install:all
```

Or install separately:

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install

# Frontend dependencies
cd ../frontend && npm install
```

### 3. Database Setup

1. Create a PostgreSQL database:

```sql
CREATE DATABASE ghana_lottery;
```

2. Update `backend/.env` with your database connection string:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/ghana_lottery
```

3. Run the schema:

```bash
cd backend
psql -U username -d ghana_lottery -f src/database/schema.sql
```

Or use a database client to run the SQL file.

### 4. Populate Database with Historical Data

The application includes web scraping functionality to populate the database with historical lottery results from sources like NLA and b2b.com.

**Quick Start:**
```bash
cd backend

# Test the scraper (optional - to verify it works)
npm run scrape

# Populate database with historical data (2010-2025)
npm run populate
```

**Options:**
```bash
# Specific date range
npm run populate -- --start 2020-01-01 --end 2024-12-31

# Single source only
npm run populate -- --source nla

# Custom batch size
npm run populate -- --batch-size 100 --delay 3000
```

**Important Notes:**
- The scraper uses CSS selectors that may need to be updated based on the actual website structure
- See `backend/SCRAPING_GUIDE.md` for detailed instructions on customizing scrapers
- The script automatically skips duplicate draws
- Rate limiting is built-in to respect website servers

### 5. Environment Configuration

Copy the example environment files and configure:

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Frontend (if needed)
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your settings
```

## Development

### Start both frontend and backend

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend dev server on `http://localhost:3000`

### Start separately

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

## Production Build

```bash
npm run build
```

This builds both frontend and backend. To build separately:

```bash
npm run build:frontend
npm run build:backend
```

### Running Production Build

```bash
# Backend
cd backend
npm start

# Frontend (serve the dist folder with a static server)
cd frontend
npm run preview
```

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── database/        # Database connection and schema
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic
│   │   ├── types/           # TypeScript type definitions
│   │   ├── utils/           # Utility functions
│   │   └── index.ts         # Express app entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # Utility functions
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   └── vite.config.ts
└── package.json            # Root workspace config
```

## API Endpoints

### Draws

- `GET /api/draws` - Get all draws (with optional filters)
- `GET /api/draws/latest` - Get latest draw
- `GET /api/draws/search` - Search draws by numbers
- `GET /api/draws/:id` - Get draw by ID
- `POST /api/draws` - Create new draw

### Analytics

- `GET /api/analytics/frequency` - Get frequency statistics
- `GET /api/analytics/hot` - Get hot numbers
- `GET /api/analytics/cold` - Get cold numbers
- `GET /api/analytics/sleeping` - Get sleeping numbers
- `GET /api/analytics/stats` - Get general statistics

### Health Check

- `GET /health` - Server health check

## Database Schema

The application uses PostgreSQL with the following main tables:

- `draws` - Stores draw information (date, type, winning numbers, machine numbers)
- `number_frequency` - Materialized view for fast frequency queries
- `number_cooccurrence` - Tracks number triplet occurrences (3 numbers appearing together)
- `detected_patterns` - Stores detected patterns

See `backend/src/database/schema.sql` for full schema.

## Domain Rules

- Each draw contains exactly 10 numbers (5 winning + 5 machine)
- All numbers are from 1-90
- Duplicates are allowed within the same draw
- Each draw is unique by date and lotto type

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure code follows TypeScript and ESLint rules
4. Test your changes
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on the repository.

