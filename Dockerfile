FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Copy only application files. Personal links, settings, icons, backgrounds,
# archives, and persistent data are intentionally never copied into the image.
COPY server.js app.js index.html style.css favicon.png ./

ENV TAGSSERVER_DATA_DIR=/app/data

EXPOSE 7000 7002

CMD ["npm", "start"]
