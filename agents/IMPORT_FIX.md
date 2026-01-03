# Import Fix for Cloud Run Deployment

## Issue
The deployment failed with `ModuleNotFoundError: No module named 'db'` because of mixed import styles.

## Solution Applied
- **server.py**: Changed to absolute imports (entry point)
- **All other files**: Keep relative imports (they work when imported as modules)

## How It Works in Docker
1. All files are copied to `/app` directory
2. `PYTHONPATH=/app` is set
3. `server.py` uses absolute imports: `import db`, `from orchestrator import ...`
4. Other files use relative imports: `from . import db`, `from .state import ...`
5. When `server.py` imports `orchestrator`, Python resolves it correctly
6. When `orchestrator.py` uses `from . import db`, it works because it's imported as part of the module structure

## Testing Locally
If you want to test locally, you can:
```bash
cd agents
PYTHONPATH=. python -m uvicorn server:app --port 8000
```

## Deployment
The Dockerfile and start.sh are configured to work with this import structure.

