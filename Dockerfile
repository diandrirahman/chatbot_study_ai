FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev --workspace server

COPY server/src ./server/src

EXPOSE 8080
CMD ["npm", "run", "start", "-w", "server"]
