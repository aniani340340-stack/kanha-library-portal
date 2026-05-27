# Stage 1: Build the React frontend
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Run the Express backend
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.js ./

# Create data directory for SQLite database and uploads
RUN mkdir -p /app/data/uploads

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]
