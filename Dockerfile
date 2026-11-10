# HammerTimeBot: one image, two commands (webhook: build/src/webhook.js, API: packages/api/dist/src/server.js).
#   docker build --target runtime -t hammertimebot .   (published by .github/workflows/docker.yml)
ARG NODE_IMAGE=node:24-trixie-slim

FROM ${NODE_IMAGE} AS build
ENV CI=true
# bufferutil and utf-8-validate (optional native modules) have no prebuilt linux/arm64 binary and compile with node-gyp.
# The toolchain is for the build stage only, the runtime stage copies the compiled result.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@12
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/core/package.json packages/core/package.json
# `prepare` runs ts-patch (typia's transformer needs the patched tsc), so scripts must run for the build install
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
# keep every dependency: the compiled output imports typia (a devDependency) at runtime
RUN rm -rf tests coverage .git docs

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
# the apps run with --use-openssl-ca (as on the servers), which needs the system CA bundle
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER 1000:1000
EXPOSE 3939 3010
CMD ["node", "--enable-source-maps", "build/src/webhook.js"]
