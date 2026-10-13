# System Architecture

## Architecture Overview

CareerGPS follows a modern, decoupled microservices architecture designed to integrate deterministic database records with generative AI.

The platform consists of four primary components:
1. **Frontend**: React SPA built with Vite.
2. **Backend**: Node.js/Express API acting as the central gateway and single source of truth.
3. **AI Service**: Python/FastAPI internal service providing stateless LLM generation.
4. **Database**: PostgreSQL storing all verified platform data and user states.

## Request and Data Flow

```mermaid
flowchart TD
    User([User / Browser])
    
    subgraph Frontend [React SPA (Vite)]
        UI[User Interface Components]
        APIClient[API Client / Axios]
        State[React Context / Hooks]
        
        UI <--> State
        State <--> APIClient
    end
    
    subgraph Backend [Node.js / Express]
        Router[API Gateway Router]
        Auth[Auth Middleware]
        Services[Business Logic Controllers]
        DBClient[pg - Database Client]
        
        Router --> Auth
        Auth --> Services
        Services <--> DBClient
    end
    
    subgraph AIService [Python / FastAPI]
        Endpoint[Internal Endpoints]
        Cache[In-Memory Cache]
        LLM[LLM Orchestration]
        
        Endpoint <--> Cache
        Endpoint <--> LLM
    end
    
    subgraph ExternalProviders [LLM Providers]
        Gemini[Google Gemini API]
        Groq[Groq API Fallback]
    end
    
    Database[(PostgreSQL DB)]
    
    User <-->|HTTP/REST| Frontend
    APIClient <-->|REST + JWT| Router
    Services <-->|Internal HTTP + Secret Token| Endpoint
    LLM <-->|HTTPS| Gemini
    LLM <-->|HTTPS| Groq
    DBClient <-->|TCP/IP| Database
```

## Component Responsibilities

### 1. Frontend (React / Vite)
- **Role**: Presentation and user interaction layer.
- **Current State**: Primarily consists of a `FoundationPage` with placeholders for the rest of the application.
- **Communication**: Interacts with the Node.js backend using a centralized API client with JWT bearers attached to requests.

### 2. Backend (Node.js / Express)
- **Role**: Single source of truth. Validates requests, enforces security/authorization, connects to the database, and decides when to leverage AI.
- **Authentication**: JWT-based authentication via HTTP-only cookies or Bearer tokens.
- **AI Integration**: The backend treats the AI Service as an unreliable enhancer. It implements timeouts (8-15 seconds) and handles AI service failures gracefully by falling back to deterministic, database-driven rules.

### 3. AI Service (Python / FastAPI)
- **Role**: Dedicated LLM abstraction layer.
- **Statelessness**: The AI service never writes directly to the PostgreSQL database. It processes inputs and returns generated insights or suggestions.
- **Trust Boundary**: It uses an `INTERNAL_SERVICE_TOKEN` shared with the backend. It receives data from the backend, generates text, and relies on the backend to validate and optionally store the results (e.g. `ai_career_profiles`).
- **Prompt Safety**: Prompts strictly enforce that facts, URLs, IDs, and domain rules are drawn exclusively from the context provided by the backend (i.e., database records).

### 4. Database (PostgreSQL)
- **Role**: Persistent data storage.
- **Structure**: Strongly typed schemas with constraints, relations, and indices.
- **Separation**: Distinguishes between human-verified records (e.g., `careers`, `skills`) and AI-generated fallback records (`ai_career_profiles`).

## Data Flow Scenarios

### Scenario A: Exploring a Known Career
1. Frontend requests `/api/v1/careers/:id`.
2. Backend queries PostgreSQL.
3. If found and enriched, backend returns data immediately to Frontend.
4. If found but sparse, backend fetches data from DB, sends to AI Service via `/internal/v1/careers/enrich` to generate a formatted profile.
5. AI Service returns enriched text. Backend caches it in DB (`career_enrichments`) and returns to Frontend.

### Scenario B: AI Assistant Chat
1. Frontend sends user question to `/api/v1/assistant/chat`.
2. Backend retrieves relevant contextual records (careers, user profile, history) from DB using exact keyword matches.
3. Backend forwards the question and context to AI Service `/internal/v1/assistant/answer`.
4. AI Service builds prompt, requests generation from Gemini (or Groq).
5. AI Service extracts answers and ensures citations refer ONLY to the contextual records provided by backend.
6. Result returned to Backend, stored in `conversation_messages`, and passed back to Frontend.
