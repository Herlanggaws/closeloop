FROM golang:alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/server /app/server
COPY --from=builder /app/db/migrations /app/db/migrations
RUN mkdir -p /data/uploads
EXPOSE 8080
CMD ["/app/server", "--mode=all"]
