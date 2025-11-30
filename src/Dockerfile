FROM node:20-alpine

WORKDIR /app/src

# Install dependencies (include dev for nodemon)
COPY src/package*.json ./
RUN npm install --ignore-scripts

# Copy application source
COPY src/ .

ENV NODE_ENV=production
EXPOSE 54321

CMD ["npm", "start"]
