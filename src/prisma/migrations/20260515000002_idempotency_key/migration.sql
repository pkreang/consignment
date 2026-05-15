-- Idempotency-Key replay store
CREATE TABLE "idempotency_key" (
  "idempotency_key_id" BIGSERIAL PRIMARY KEY,
  "key"                VARCHAR(200) NOT NULL,
  "user_id"            BIGINT,
  "method"             VARCHAR(10)  NOT NULL,
  "path"               VARCHAR(500) NOT NULL,
  "request_hash"       VARCHAR(128) NOT NULL,
  "status_code"        INTEGER      NOT NULL,
  "response_body"      JSONB        NOT NULL,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "idempotency_key_key_user_id_key"
  ON "idempotency_key" ("key", "user_id");
CREATE INDEX "idempotency_key_created_at_idx"
  ON "idempotency_key" ("created_at");
