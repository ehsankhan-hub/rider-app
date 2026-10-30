ALTER TABLE rides
  ADD COLUMN quote_fare_amount DECIMAL(10, 2) NULL AFTER fare_amount,
  ADD COLUMN quote_distance_km DECIMAL(10, 2) NULL AFTER quote_fare_amount,
  ADD COLUMN quote_duration_min DECIMAL(10, 2) NULL AFTER quote_distance_km,
  ADD COLUMN review_status VARCHAR(16) NULL AFTER end_note,
  ADD COLUMN reviewed_at DATETIME NULL AFTER review_status;

UPDATE rides
SET quote_fare_amount = fare_amount,
    quote_distance_km = distance_km,
    quote_duration_min = duration_min
WHERE quote_fare_amount IS NULL
  AND (end_note IS NULL OR end_note = 'at_dropoff');

UPDATE rides
SET quote_fare_amount = 8725.05,
    quote_distance_km = 454.17,
    quote_duration_min = 376.00
WHERE id = '301f546f-76d3-4b39-b259-0fd362d8f7de';
