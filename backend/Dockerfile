# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including devDependencies for build if needed
RUN npm ci

# Copy source code
COPY . .

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy from builder
COPY --from=builder /app .

# Create logs directory
RUN mkdir -p logs && chown -node:node logs

# Security: Run as non-privileged user
USER node

# Environment variables
ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

CMD ["node", "server.js"]
