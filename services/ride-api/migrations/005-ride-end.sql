ALTER TABLE rides
  ADD COLUMN end_lat DECIMAL(10, 7) NULL AFTER fare_amount,
  ADD COLUMN end_lng DECIMAL(10, 7) NULL AFTER end_lat,
  ADD COLUMN end_note VARCHAR(32) NULL AFTER end_lng;
