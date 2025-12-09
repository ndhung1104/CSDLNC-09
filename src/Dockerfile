FROM node:20-alpine
WORKDIR /app
COPY src/package*.json ./
RUN npm install
COPY src/ .
EXPOSE 54321
CMD ["npm", "run", "dev"]
