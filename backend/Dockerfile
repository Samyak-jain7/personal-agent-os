FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

WORKDIR /app

RUN python -m pip install --no-cache-dir --upgrade pip

COPY backend /app/backend

RUN set -eux; \
    if [ -f /app/backend/requirements.txt ]; then \
      pip install --no-cache-dir -r /app/backend/requirements.txt; \
    elif [ -f /app/backend/pyproject.toml ]; then \
      pip install --no-cache-dir -e /app/backend; \
    else \
      pip install --no-cache-dir fastapi "uvicorn[standard]"; \
    fi

EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
