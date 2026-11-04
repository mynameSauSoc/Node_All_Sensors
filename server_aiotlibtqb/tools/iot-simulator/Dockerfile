FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

ENV MQTT_BROKER_URL=mqtt://mosquitto:1883
ENV MQTT_PER_DEVICE_AUTH=true
ENV API_BASE_URL=http://backend:8080
ENV ADMIN_USERNAME=admin
ENV DEFAULT_SCENARIO=demo
ENV SIM_INTERVAL_MS=5000
ENV FORCE_REMOTE=true

USER node

CMD ["node", "src/index.js", "--provision"]
