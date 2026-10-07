FROM node:22-alpine
WORKDIR /app
RUN npm i --omit=dev peer@1
COPY server.js .
ENV PORT=9000
EXPOSE 9000
USER node
CMD ["node", "server.js"]
