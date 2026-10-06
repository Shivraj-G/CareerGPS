import os
import httpx
import dotenv
dotenv.load_dotenv()
g=httpx.get(f'https://generativelanguage.googleapis.com/v1beta/models?key={os.environ["GEMINI_API_KEY"]}').json()
print("GEMINI:")
print([m["name"] for m in g.get("models",[]) if "generateContent" in m.get("supportedGenerationMethods",[])])
q=httpx.get("https://api.groq.com/openai/v1/models", headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}"}).json()
print("GROQ:")
print([m["id"] for m in q.get("data",[])])
