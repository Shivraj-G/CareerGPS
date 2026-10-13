# Development Setup

## Prerequisites
- **Node.js**: v20 or higher
- **Python**: 3.10+ (for AI Service)
- **PostgreSQL**: 15+

## Repository Structure
The monorepo contains four main services:
- `/frontend` - React + Vite application
- `/backend` - Node.js Express API
- `/ai-service` - Python FastAPI application
- `/ingestion-worker` - Node.js script for data extraction

## Environment Configuration
You must configure environment variables for each service. Do not commit actual secrets to version control.

### Backend (`/backend/.env`)
Copy `backend/.env.example` to `backend/.env` and update:
```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/goa_career_intelligence
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
JWT_SECRET=<64-char-hex>
JWT_ACCESS_EXPIRES_IN=6h
AI_SERVICE_URL=http://localhost:8000
INTERNAL_SERVICE_TOKEN=<64-char-hex-shared-with-ai-service>
```

### AI Service (`/ai-service/.env`)
Copy `ai-service/.env.example` to `ai-service/.env` and update:
```env
INTERNAL_SERVICE_TOKEN=<must-match-backend-token>
PORT=8000
LLM_PROVIDER=gemini
LLM_FALLBACK_PROVIDER=groq
GEMINI_API_KEY=<your-key>
GROQ_API_KEY=<your-key>
```

### Frontend (`/frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env` and update:
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SITE_URL=http://localhost:5173
```

### Ingestion Worker (`/ingestion-worker/.env`)
```env
BACKEND_URL=http://localhost:5000
INTERNAL_SERVICE_TOKEN=<must-match-backend-token>
INGESTION_SOURCE_ID=<uuid-from-db>
INGESTION_RUN_ID=<uuid-from-db>
SOURCE_URL=<url-to-scrape>
```

## Running the Application Locally

1. **Database Setup**
   Ensure PostgreSQL is running and the database specified in `DATABASE_URL` exists.
   ```bash
   cd backend
   npm install
   npm run migrate
   npm run seed
   ```

2. **Start Backend**
   ```bash
   cd backend
   npm run dev
   ```
   Runs on http://localhost:5000

3. **Start AI Service**
   ```bash
   cd ai-service
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
   Runs on http://localhost:8000

4. **Start Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Runs on http://localhost:5173

## Testing

**Backend:**
```bash
cd backend
npm run test
```

**Frontend:**
```bash
cd frontend
npm run test
```

**AI Service:**
```bash
cd ai-service
pytest
```
