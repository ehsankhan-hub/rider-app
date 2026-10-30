INSERT INTO states (id, country_id, name, is_active)
SELECT '6f0e1001-a1b2-4c3d-8e01-000000000001', id, 'Eastern Province', 1
FROM countries WHERE iso_code = 'SA';

INSERT INTO states (id, country_id, name, is_active)
SELECT '6f0e1001-a1b2-4c3d-8e01-000000000002', id, 'Makkah Region', 1
FROM countries WHERE iso_code = 'SA';

INSERT INTO states (id, country_id, name, is_active)
SELECT '6f0e1001-a1b2-4c3d-8e01-000000000003', id, 'Al Madinah Region', 1
FROM countries WHERE iso_code = 'SA';

INSERT INTO cities (id, state_id, name, lat, lng, timezone, is_active, is_default) VALUES
  ('6f0e1001-a1b2-4c3d-8e01-000000000011', '6f0e1001-a1b2-4c3d-8e01-000000000001', 'Dammam', 26.4207000, 50.0888000, 'Asia/Riyadh', 1, 0),
  ('6f0e1001-a1b2-4c3d-8e01-000000000012', '6f0e1001-a1b2-4c3d-8e01-000000000002', 'Jeddah', 21.5433000, 39.1728000, 'Asia/Riyadh', 1, 0),
  ('6f0e1001-a1b2-4c3d-8e01-000000000013', '6f0e1001-a1b2-4c3d-8e01-000000000002', 'Makkah', 21.3891000, 39.8579000, 'Asia/Riyadh', 1, 0),
  ('6f0e1001-a1b2-4c3d-8e01-000000000014', '6f0e1001-a1b2-4c3d-8e01-000000000003', 'Madinah', 24.4672000, 39.6111000, 'Asia/Riyadh', 1, 0);
