INSERT INTO currencies (id, code, symbol, name, is_active, is_default)
SELECT '6f0e1001-a1b2-4c3d-8e01-0000000000c1', 'SAR', 'SAR', 'Saudi Riyal', 1, 0
FROM countries
WHERE iso_code = 'SA'
  AND NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'SAR')
LIMIT 1;

UPDATE currencies SET is_default = 0;
UPDATE currencies SET is_default = 1, is_active = 1 WHERE code = 'SAR';

UPDATE vehicle_types SET base_fare = 5.00, per_km = 1.60, per_minute = 0.40 WHERE code = 'economy';
UPDATE vehicle_types SET base_fare = 7.00, per_km = 2.20, per_minute = 0.55 WHERE code = 'comfort';
UPDATE vehicle_types SET base_fare = 9.00, per_km = 2.80, per_minute = 0.70 WHERE code = 'xl';
