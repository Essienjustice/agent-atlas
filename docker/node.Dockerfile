FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
COPY indexer/package*.json indexer/
COPY contracts/package*.json contracts/
COPY shared/package*.json shared/
RUN npm install
COPY . .
