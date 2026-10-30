CREATE TABLE IF NOT EXISTS countries (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  iso_code CHAR(2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_countries_iso (iso_code)
);

CREATE TABLE IF NOT EXISTS states (
  id CHAR(36) NOT NULL PRIMARY KEY,
  country_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_states_country FOREIGN KEY (country_id) REFERENCES countries(id)
);

CREATE TABLE IF NOT EXISTS cities (
  id CHAR(36) NOT NULL PRIMARY KEY,
  state_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_cities_state FOREIGN KEY (state_id) REFERENCES states(id)
);

CREATE TABLE IF NOT EXISTS currencies (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code CHAR(3) NOT NULL,
  symbol VARCHAR(8) NOT NULL,
  name VARCHAR(80) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_currencies_code (code)
);

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL
);

SET @saudi = UUID();
SET @india = UUID();
SET @riyadh_region = UUID();
SET @uttar_pradesh = UUID();
SET @riyadh = UUID();
SET @prayagraj = UUID();
SET @usd = UUID();
SET @inr = UUID();

INSERT INTO countries (id, name, iso_code, is_active) VALUES
  (@saudi, 'Saudi Arabia', 'SA', 1),
  (@india, 'India', 'IN', 1);

INSERT INTO states (id, country_id, name, is_active) VALUES
  (@riyadh_region, @saudi, 'Riyadh Region', 1),
  (@uttar_pradesh, @india, 'Uttar Pradesh', 1);

INSERT INTO cities (id, state_id, name, lat, lng, timezone, is_active, is_default) VALUES
  (@riyadh, @riyadh_region, 'Riyadh', 24.7136000, 46.6753000, 'Asia/Riyadh', 1, 1),
  (@prayagraj, @uttar_pradesh, 'Prayagraj', 25.4358000, 81.8463000, 'Asia/Kolkata', 1, 0);

INSERT INTO currencies (id, code, symbol, name, is_active, is_default) VALUES
  (@usd, 'USD', '$', 'US Dollar', 1, 1),
  (@inr, 'INR', '₹', 'Indian Rupee', 1, 0);

INSERT INTO platform_settings (setting_key, setting_value) VALUES
  ('assign_radius_km', '25'),
  ('opening_wallet_amount', '25');
