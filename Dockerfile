FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install && bun db:generate
EXPOSE $PORT
CMD ["bun", "run", "start"]
