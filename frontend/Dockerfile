FROM node:22-alpine

WORKDIR /app/frontend

COPY frontend ./

RUN set -eux; \
    if [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; \
    elif [ -f package.json ]; then npm install; \
    else echo "No frontend package.json yet; skipping dependency install."; \
    fi

EXPOSE 5173

CMD ["sh", "-c", "if [ -f package.json ]; then npm run dev -- --host ${FRONTEND_HOST:-0.0.0.0} --port ${FRONTEND_PORT:-5173}; else echo 'No frontend app yet; container is waiting for source files.' && tail -f /dev/null; fi"]
