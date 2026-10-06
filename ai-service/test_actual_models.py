import os
import httpx
import dotenv

dotenv.load_dotenv()
models = ['gemini-flash-latest', 'gemini-3.8-flash']
payload = {'contents':[{'parts':[{'text':'Hello'}]}]}

for m in models:
    try:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={os.environ["GEMINI_API_KEY"]}'
        r = httpx.post(url, json=payload, timeout=10)
        print(f"GEMINI {m}:", r.status_code, r.text[:200].replace('\n', ' '))
    except Exception as e:
        print(f"GEMINI {m} ERROR:", e)

groq_models = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']
g_payload = {"model": "", "messages": [{"role": "user", "content": "Hello"}]}

for m in groq_models:
    try:
        g_payload["model"] = m
        url = 'https://api.groq.com/openai/v1/chat/completions'
        r = httpx.post(url, json=g_payload, headers={'Authorization': f'Bearer {os.environ["GROQ_API_KEY"]}'}, timeout=10)
        print(f"GROQ {m}:", r.status_code, r.text[:200].replace('\n', ' '))
    except Exception as e:
        print(f"GROQ {m} ERROR:", e)
