import os
import sys
from pathlib import Path

# Must be set before `app.main` is imported anywhere, since main.py reads
# INTERNAL_SERVICE_TOKEN at module load time via os.getenv(...).
os.environ.setdefault("INTERNAL_SERVICE_TOKEN", "test-secret-token")

# Let `from app.main import app` resolve when pytest is run from the
# ai-service/ directory (put this conftest.py at ai-service/tests/conftest.py).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
