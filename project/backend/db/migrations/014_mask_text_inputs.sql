-- +goose Up
ALTER TABLE projects ADD COLUMN IF NOT EXISTS mask_text_inputs BOOLEAN NOT NULL DEFAULT true;

-- +goose Down
ALTER TABLE projects DROP COLUMN IF EXISTS mask_text_inputs;
