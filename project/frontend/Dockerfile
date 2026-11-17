FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json ./
COPY packages/widget/package.json ./packages/widget/package.json
COPY packages/js-sdk/package.json ./packages/js-sdk/package.json
COPY packages/emails/package.json ./packages/emails/package.json
RUN pnpm install

COPY . .
ARG NEXT_PUBLIC_API_URL=https://api.saidloop.com
ARG NEXT_PUBLIC_WIDGET_CDN_URL=
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WIDGET_CDN_URL=${NEXT_PUBLIC_WIDGET_CDN_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
COPY --from=builder /app ./
EXPOSE 3000
CMD ["pnpm", "start"]
