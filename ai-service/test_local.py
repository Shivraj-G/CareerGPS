import os; os.environ['GEMINI_API_KEY'] = 'dummy'; from app.llm import ping, model_name; print('Gemini Model:', model_name('gemini')); print('Groq Model:', model_name('groq'))
