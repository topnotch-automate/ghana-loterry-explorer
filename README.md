# Ghana Lottery Explorer

A modern, professional web application for exploring and analyzing Ghana Lottery draw results. Built with React, TypeScript, Express, PostgreSQL, and Python-powered AI predictions.

## Features

### Core Features
- **Draw Management**: Store and retrieve lottery draws with 5 winning numbers and 5 machine numbers (all from 1-90)
- **Advanced Search**: Search draws by numbers with multiple modes (exact, partial, winning-only, machine-only, group)
- **Analytics Dashboard**: 
  - Number frequency analysis (daily, weekly, monthly, yearly)
  - Hot/Cold number detection
  - Sleeping number identification
  - Visual charts and statistics
- **Pattern Detection**: Identify recurring patterns and similarities across draws
- **User Authentication**: Secure registration, login, and account management
- **Subscription System**: Free and Pro tiers with payment integration ready
- **Modern UI**: Responsive, accessible interface with Tailwind CSS

### AI-Powered Predictions (Pro Feature)

#### Prediction Strategies
The system uses multiple AI strategies to generate predictions:

1. **Ensemble Strategy** (Recommended): Combines all strategies with weighted voting for the most reliable predictions
2. **Machine Learning (ML)**: Uses RandomForest and GradientBoosting models trained on historical data
3. **Genetic Algorithm**: Evolves optimal number combinations through simulated natural selection
4. **Pattern Analysis**: Detects and exploits recurring patterns in historical draws
5. **Intelligence Strategy**: Advanced multi-engine approach combining:
   - Temporal Memory Engine (recency/decay weighting)
   - Machine-Winning Lag Analysis
   - Winning Density & Burst Detection
   - Pair Gravity Analysis
   - Family Cluster Detection
   - Number State Modeling
6. **Yearly Pattern Strategy** (NEW): Cross-year pattern analysis using Law of Large Numbers:
   - Analyzes draws organized by year
   - Detects recurring patterns across multiple years
   - Identifies stable "foundation" numbers that consistently appear
   - Tracks cold-to-hot number transitions between years
   - Detects cyclical patterns (numbers that appear in alternating years)
   - Works with limited data at the start of a new year
   - Leverages all previous years' data to inform current year predictions

#### How Yearly Pattern Analysis Works

The lottery system follows the **Law of Large Numbers** - as more draws accumulate over years, patterns stabilize and become more predictable. The Yearly Pattern Analyzer:

1. **Organizes draws by year**: Automatically groups historical draws by calendar year
2. **Calculates yearly statistics**: Hot/cold numbers, frequency distributions, and trends per year
3. **Detects cross-year patterns**:
   - **Recurring Hot Numbers**: Numbers that are consistently hot across multiple years
   - **Cold-to-Hot Transitions**: Numbers that were cold last year but are becoming hot
   - **Cyclical Patterns**: Numbers that appear in alternating high-low patterns
   - **Trending Numbers**: Numbers with increasing frequency over years
   - **Stable Foundation Numbers**: Numbers that consistently appear across all years
4. **Adapts to new year data**: Works even with limited draws at the start of a new year by weighting patterns from previous years

#### Advanced Analyzers
- **Zone Analysis**: Tracks number distribution across zones (1-10, 11-20, etc.)
- **Gap Pattern Analysis**: Analyzes spacing between numbers within draws
- **Trend Momentum Scoring**: Detects acceleration/deceleration in number frequency
- **Anti-Pattern Filtering**: Rejects statistically unlikely combinations
- **Position Tendency Analysis**: Tracks preferred positions for numbers
- **Confidence Scoring**: Provides confidence levels for each prediction

### Two Sure & Three Direct (Pro Feature)

Special Ghana Lottery prediction features based on consensus across all strategies:

- **Two Sure**: The 2 most likely numbers to appear in the next draw
- **Three Direct**: The 3 most likely numbers to appear in the next draw

#### How to Use Two Sure & Three Direct

**From the Dashboard:**
1. Navigate to the Dashboard
2. In the "Today's Lucky Numbers" section, select a lotto type from the dropdown
3. Click "Generate" to get Two Sure and Three Direct predictions
4. Click the bookmark icon to save predictions for later reference

**From Advanced Predictions:**
1. Go to the Predictions page
2. Select your preferred strategy and lotto type
3. Generate predictions
4. In the "Ghana Lottery Special Features" section, click "Save" to save Two Sure or Three Direct to your Dashboard

### Prediction Checking & Win/Loss Tracking

#### Automatic Checking
Predictions are automatically checked against actual draws at:
- **2:00 PM daily** - After morning/midday draws
- **9:00 PM daily** - After evening draws

#### Manual Checking
Click the "Check Now" button on the Dashboard to immediately check all pending predictions.

#### Win/Loss Logic
| Matches | Status |
|---------|--------|
| **2+** | ✅ WIN |
| **1** | ⚠️ PARTIAL |
| **0** | ❌ LOSS |

#### Matching Logic
Predictions are matched by **lotto type first**, then by date:
- If you predict "Noon Rush Wednesday" on Monday, the system will check against the next "Noon Rush Wednesday" draw
- This ensures accurate tracking of predictions for specific lottery types

#### Reset & Recheck
If predictions were checked incorrectly, clicking "Check Now" will:
1. Reset all previously checked predictions
2. Re-check them with the correct lotto type matching logic

### Saved Predictions

All saved predictions are displayed on the Dashboard with:
- Predicted numbers (highlighted if they match winning numbers)
- Strategy used
- Lotto type targeted
- Match count and win/loss status
- Actual winning numbers (once checked)

### Strategy Performance Tracking

Track which prediction strategies perform best over time:
- **Weekly**: Best strategy and match statistics for the past 7 days
- **Monthly**: Performance breakdown by strategy for the past 30 days
- **Yearly**: Long-term strategy comparison

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
- Scheduled task runner for automatic prediction checking

### Python Prediction Service
- Flask API server
- scikit-learn for Machine Learning (RandomForest, GradientBoosting)
- NumPy for numerical computations
- Custom genetic algorithm implementation
- Advanced pattern detection and analysis engines

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

### Start all services

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend dev server on `http://localhost:3000`

### Start Python Prediction Service

The Python service must be running for AI predictions to work:

```bash
cd python-service

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the Flask server
python app.py
```

The Python service runs on `http://localhost:5001` by default.

### Start separately

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend

# Python service
cd python-service && python app.py
```

### Automatic Prediction Checking

When the backend starts, it automatically schedules prediction checks:
- **2:00 PM daily** - After morning/midday draws
- **9:00 PM daily** - After evening draws
- **On startup** - Initial check runs 5 seconds after server start

The scheduler logs its activity:
```
⏰ Prediction check scheduler started (2 PM & 9 PM daily)
Next prediction check scheduled for: [datetime]
```

## Usage Guide

### Generating Predictions

1. **Login** with a Pro account
2. Navigate to **Dashboard** or **Predictions** page
3. Select a **lotto type** (e.g., "Friday Bonanza", "Mid Week Lotto")
4. Select a **strategy** (Ensemble recommended for best results)
5. Click **Generate**

### Understanding Prediction Results

Each prediction includes:
- **5 predicted numbers** - The main prediction set
- **Two Sure** - 2 numbers with highest consensus across strategies
- **Three Direct** - 3 numbers with highest consensus across strategies
- **Confidence score** - How confident the system is in the prediction
- **Trend analysis** - Numbers that are rising, falling, or accelerating

### Saving Predictions

**From Dashboard:**
- Click the bookmark icon on Two Sure or Three Direct cards

**From Advanced Predictions:**
- Click "Save" button on the Two Sure/Three Direct cards
- Click "Save Prediction" button for the full 5-number prediction

### Checking Predictions

Predictions are checked automatically, but you can also:
1. Go to **Dashboard**
2. Scroll to **My Predictions** section
3. Click **Check Now** button

The system will:
- Match predictions by **lotto type** (e.g., "Friday Bonanza" prediction checks against "Friday Bonanza" draws)
- Update match counts and win/loss status
- Highlight matched numbers in green

### Viewing History

The Dashboard shows:
- Recent predictions with win/loss status
- Strategy performance (week/month/year)
- Best performing strategy

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

# Python service (required for predictions)
cd python-service
python app.py

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
│   │   │   ├── drawService.ts
│   │   │   ├── predictionService.ts    # Calls Python service
│   │   │   └── predictionScheduler.ts  # Scheduled prediction checking
│   │   ├── middleware/      # Auth middleware
│   │   ├── types/           # TypeScript type definitions
│   │   ├── utils/           # Utility functions
│   │   └── index.ts         # Express app entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── components/      # React components
│   │   ├── contexts/        # Auth and Subscription contexts
│   │   ├── pages/           # Page components
│   │   │   ├── Dashboard.tsx    # Main dashboard with Two Sure/Three Direct
│   │   │   ├── Predictions.tsx  # Advanced predictions page
│   │   │   └── ...
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utility functions
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   ├── package.json
│   └── vite.config.ts
├── python-service/
│   ├── app.py               # Flask API server
│   ├── lottOracleV2.py      # Main prediction engine
│   │   ├── EnhancedLottoOracle     # Main oracle class
│   │   ├── MLPredictor             # Machine learning predictor
│   │   ├── GeneticOptimizer        # Genetic algorithm
│   │   ├── AdvancedPatternDetector # Pattern detection
│   │   ├── ZoneAnalyzer            # Zone distribution analysis
│   │   ├── GapAnalyzer             # Gap pattern analysis
│   │   ├── TrendAnalyzer           # Trend momentum scoring
│   │   ├── AntiPatternFilter       # Invalid pattern rejection
│   │   ├── PositionAnalyzer        # Position tendency analysis
│   │   └── ConfidenceScorer        # Prediction confidence scoring
│   └── requirements.txt     # Python dependencies
└── package.json             # Root workspace config
```

## API Endpoints

### Draws

- `GET /api/draws` - Get all draws (with optional filters)
- `GET /api/draws/latest` - Get latest draw
- `GET /api/draws/search` - Search draws by numbers
- `GET /api/draws/:id` - Get draw by ID
- `GET /api/draws/lotto-types` - Get all available lotto types
- `POST /api/draws` - Create new draw

### Analytics

- `GET /api/analytics/frequency` - Get frequency statistics
- `GET /api/analytics/hot` - Get hot numbers
- `GET /api/analytics/cold` - Get cold numbers
- `GET /api/analytics/sleeping` - Get sleeping numbers
- `GET /api/analytics/stats` - Get general statistics
- `GET /api/analytics/cooccurrence` - Get number co-occurrence data

### Predictions (Pro Users)

- `GET /api/predictions/health` - Check if prediction service is available
- `POST /api/predictions/generate` - Generate predictions
  - Query params: `strategy`, `lottoType`, `useTypeSpecificTable`
- `POST /api/predictions/analyze` - Analyze patterns without generating predictions
- `GET /api/predictions/history` - Get user's prediction history
- `POST /api/predictions/save` - Save a prediction (2, 3, or 5 numbers)
- `POST /api/predictions/check/:predictionId` - Check a specific prediction against a draw
- `POST /api/predictions/check-all` - Check all pending predictions
- `POST /api/predictions/reset-and-recheck` - Reset and re-check all predictions
- `GET /api/predictions/strategy-performance` - Get strategy performance statistics
- `GET /api/predictions/lotto-types` - Get available lotto types for predictions
- `DELETE /api/predictions/:predictionId` - Delete a saved prediction

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout user

### Subscriptions

- `GET /api/subscriptions/status` - Get subscription status
- `POST /api/subscriptions/upgrade` - Upgrade to Pro

### Health Check

- `GET /health` - Server health check

## Database Schema

The application uses PostgreSQL with the following main tables:

- `draws` - Stores draw information (date, type, winning numbers, machine numbers)
- `users` - User accounts with authentication
- `prediction_history` - Saved predictions with tracking
  - `predicted_numbers` - Array of predicted numbers (2, 3, or 5 numbers)
  - `strategy` - Strategy used (ensemble, ml, genetic, pattern, intelligence, two_sure, three_direct)
  - `lotto_type` - Target lotto type
  - `target_draw_date` - Date the prediction is for
  - `is_checked` - Whether prediction has been checked against actual draw
  - `matches` - Number of matched numbers
  - `actual_draw_id` - Reference to the actual draw result
- `number_frequency` - Materialized view for fast frequency queries
- `number_cooccurrence` - Tracks number triplet occurrences (3 numbers appearing together)
- `detected_patterns` - Stores detected patterns
- `yearly_statistics` - Aggregated statistics per year for yearly pattern analysis
  - `number_frequencies` - Number frequencies for the year (JSONB)
  - `hot_numbers` - Hot numbers for the year
  - `cold_numbers` - Cold numbers for the year
  - `common_pairs` / `common_triplets` - Frequent combinations
- `yearly_patterns` - Cross-year pattern detection
  - `pattern_type` - Type of pattern (recurring_hot, cold_to_hot, cyclical, etc.)
  - `years_observed` - Years where pattern was detected
  - `confidence` - Pattern confidence score
  - `predicted_numbers` - Numbers predicted based on pattern
- `year_comparisons` - Year-over-year comparison data
  - `similarity_score` - How similar two years are
  - `common_hot_numbers` / `common_cold_numbers` - Shared numbers
  - `cold_to_hot_numbers` / `hot_to_cold_numbers` - Transition tracking

See `backend/src/database/schema.sql` and `migrations/005_yearly_pattern_tracking.sql` for full schema.

## Domain Rules

- Each draw contains exactly 10 numbers (5 winning + 5 machine)
- All numbers are from 1-90
- Duplicates are allowed within the same draw
- Each draw is unique by date and lotto type
- Predictions can be 2 numbers (Two Sure), 3 numbers (Three Direct), or 5 numbers (standard)
- Win/Loss: 2+ matches = WIN, 1 match = PARTIAL, 0 matches = LOSS

## Troubleshooting

### Predictions not generating
1. Ensure the Python service is running: `cd python-service && python app.py`
2. Check backend logs for connection errors to `localhost:5001`
3. Verify you have at least 60 historical draws in the database

### Predictions not being checked
1. Check that predictions have a `lotto_type` specified
2. Ensure draws exist for that lotto type
3. Use "Check Now" button to manually trigger checking
4. Check backend logs for matching issues

### Two Sure / Three Direct not appearing
1. These are only available for Pro users
2. Ensure prediction generation completed successfully
3. Check the browser console for API errors

### Incorrect prediction matches
1. Click "Check Now" to reset and re-check predictions
2. This will match by lotto type first, then by date
3. Predictions are matched to draws on or after the prediction date

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure code follows TypeScript and ESLint rules
4. Test your changes
5. Submit a pull request

## License

MIT

## SEO Optimization

The application is fully optimized for search engines with:
- Dynamic meta tags per page
- Open Graph and Twitter Card support
- Structured data (JSON-LD)
- Dynamic sitemap generation
- Semantic HTML5
- Performance optimizations

See [SEO_OPTIMIZATION.md](./SEO_OPTIMIZATION.md) for complete details.

## Deployment

For production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

The deployment guide covers:
- Server setup and requirements
- Step-by-step deployment process
- Domain and SSL configuration
- Process management with PM2
- Monitoring and maintenance
- Security best practices

## Support

For issues and questions, please open an issue on the repository.

