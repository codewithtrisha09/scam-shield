# Multi-stage build keeps the final image small - dev dependencies
# (nodemon etc.) don't ship in the production image.

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS deps
RUN npm ci --omit=dev

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
