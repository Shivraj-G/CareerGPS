# API Inventory

## Backend Node.js / Express API

The backend exposes a REST API mounted at `/api/v1` and an internal ingestion API at `/internal/v1/ingestion`.

### Core API (`/api/v1`)

| Module | Method | Path | Authentication | Description / Purpose | Status |
|--------|--------|------|----------------|------------------------|--------|
| Health | GET | `/health` | None | Service health check | Verified |
| Auth | POST | `/auth/register` | None | User registration | Verified |
| Auth | POST | `/auth/login` | None | User authentication | Verified |
| Auth | POST | `/auth/refresh` | None | Refresh JWT token | Verified |
| Auth | POST | `/auth/logout` | None | Revoke session | Verified |
| Users | GET | `/users/me` | JWT | Get current user details | Verified |
| Users | GET | `/users/me/ai-careers` | JWT | Get AI generated careers for user | Verified |
| Profiles | GET | `/profiles/me` | JWT | Get user profile | Verified |
| Profiles | PUT | `/profiles/me` | JWT | Update user profile | Verified |
| Profiles | GET | `/profiles/me/completeness`| JWT | Check profile completion status | Verified |
| Profiles | POST | `/profiles/me/validate-goal`| JWT | Validates career goal against AI | Verified |
| Careers | GET | `/careers` | None | List paginated careers | Verified |
| Careers | GET | `/careers/:careerId` | None | Get specific career details | Verified |
| Careers | GET | `/careers/:careerId/skills`| None | Get skills required for career | Verified |
| Careers | GET | `/careers/:careerId/courses`| None | Get associated courses | Verified |
| Careers | GET | `/careers/:careerId/pathways`| None | Get career learning pathways | Verified |
| Careers | GET | `/careers/:careerId/opportunities`| None | Get jobs/opportunities | Verified |
| Careers | GET | `/careers/:careerId/related` | None | Related careers | Verified |
| Careers | GET | `/careers/:careerId/sources` | None | Provenance/sources for data | Verified |
| Careers | POST | `/careers/explore` | JWT | Search & AI-generate careers | Verified |
| Skills | GET | `/skills` | None | List skills catalogue | Verified |
| Skills | POST | `/skills/suggest` | JWT | AI suggests relevant skills | Verified |
| Skills Intel | GET | `/skills/me` | JWT | Get user skills | Verified |
| Skills Intel | PUT | `/skills/me` | JWT | Update user skills | Verified |
| Skills Intel | POST | `/skills/me/custom` | JWT | Add custom user skill | Verified |
| Skills Intel | GET | `/skills/me/custom` | JWT | Get custom user skills | Verified |
| Skills Intel | DELETE | `/skills/me/custom/:id` | JWT | Remove custom skill | Verified |
| Skills Intel | POST | `/skills/gap-analysis` | JWT | AI skill gap analysis | Verified |
| Pathways | GET | `/pathways` | None | List available pathway templates | Verified |
| Pathways | GET | `/pathways/me` | JWT | Get user's active pathways | Verified |
| Pathways | POST | `/pathways/generate` | JWT | AI generates custom pathway | Verified |
| Pathways | GET | `/pathways/:pathwayId/steps`| None | Steps for a given pathway | Verified |
| Pathways | POST | `/pathways/:pathwayId/select`| JWT | Start a template pathway | Verified |
| Pathways | POST | `/pathways/:pathwayId/progress`| JWT | Update step progress | Verified |
| Pathways | GET | `/pathways/:pathwayId/progress`| JWT | Get step progress | Verified |
| Opportunities | GET | `/opportunities` | None | List opportunities | Verified |
| Opportunities | GET | `/opportunities/:id` | None | Get specific opportunity | Verified |
| Institutions | GET | `/institutions` | None | List institutions | Verified |
| Institutions | GET | `/institutions/:id` | None | Get specific institution | Verified |
| Courses | GET | `/courses` | None | List courses | Verified |
| Courses | GET | `/courses/:id` | None | Get specific course | Verified |
| Courses | GET | `/courses/:id/eligibility`| None | Course eligibility rules | Verified |
| Eligibility | POST | `/eligibility/check` | JWT | Evaluate user eligibility | Verified |
| Eligibility | GET | `/eligibility/checks/:id`| JWT | Get previous check result | Verified |
| Assistant | POST | `/assistant/chat` | JWT | Conversational AI assistant | Verified |
| Assistant | GET | `/assistant/history` | JWT | Get chat history | Verified |
| Admin | GET | `/admin/ai-careers` | JWT (Admin) | Admin view AI careers | Verified |
| Admin | POST | `/admin/ai-careers/:id/save`| JWT (Admin) | Approve AI career | Verified |

## AI Service FastAPI

The AI service operates an internal API at `http://localhost:8000/internal/v1`. These endpoints are called securely via an internal token.

| Module | Method | Path | Description |
|--------|--------|------|-------------|
| Health | GET | `/health` | Service health and LLM provider status |
| Health | GET | `/llm/ping` | Verifies API keys work |
| Recommendations| POST | `/recommendations/careers` | Recommends careers based on profile |
| Skills | POST | `/skills/gap-analysis` | Explains missing skills for a career |
| Skills | POST | `/skills/suggest` | Generates skills given a degree/career |
| Pathways | POST | `/pathways/reason` | Personalizes a pathway introduction |
| Pathways | POST | `/pathways/draft` | Generates a fallback pathway |
| Pathways | POST | `/pathways/generate_two` | Generates two distinct pathway options |
| Eligibility | POST | `/eligibility/explain` | Explains why a user meets/fails eligibility |
| Careers | POST | `/careers/explore` | Determines if a query is a career, fetches data |
| Careers | POST | `/careers/enrich` | Expands sparse DB data into complete profile |
| Profiles | POST | `/profiles/validate-goal`| Determines if degree->career goal is valid |
| Assistant | POST | `/assistant/answer` | Primary conversational chatbot response |
