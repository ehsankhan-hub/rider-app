ALTER TABLE drivers
  ADD COLUMN country_iso CHAR(2) NULL,
  ADD COLUMN country_name VARCHAR(80) NULL;

ALTER TABLE customer_profiles
  ADD COLUMN country_iso CHAR(2) NULL,
  ADD COLUMN country_name VARCHAR(80) NULL;
