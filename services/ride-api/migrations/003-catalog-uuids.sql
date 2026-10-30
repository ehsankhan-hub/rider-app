SET @saudi = UUID();
SET @india = UUID();
SET @riyadh_region = UUID();
SET @uttar_pradesh = UUID();
SET @riyadh = UUID();
SET @prayagraj = UUID();
SET @usd = UUID();
SET @inr = UUID();

SET FOREIGN_KEY_CHECKS = 0;

UPDATE states SET country_id = @saudi WHERE country_id = '11111111-1111-4111-8111-111111111111';
UPDATE countries SET id = @saudi WHERE id = '11111111-1111-4111-8111-111111111111';

UPDATE states SET country_id = @india WHERE country_id = '11111111-1111-4111-8111-111111111112';
UPDATE countries SET id = @india WHERE id = '11111111-1111-4111-8111-111111111112';

UPDATE cities SET state_id = @riyadh_region WHERE state_id = '22222222-2222-4222-8222-222222222222';
UPDATE states SET id = @riyadh_region WHERE id = '22222222-2222-4222-8222-222222222222';

UPDATE cities SET state_id = @uttar_pradesh WHERE state_id = '22222222-2222-4222-8222-222222222223';
UPDATE states SET id = @uttar_pradesh WHERE id = '22222222-2222-4222-8222-222222222223';

UPDATE cities SET id = @riyadh WHERE id = '33333333-3333-4333-8333-333333333333';
UPDATE cities SET id = @prayagraj WHERE id = '33333333-3333-4333-8333-333333333334';

UPDATE currencies SET id = @usd WHERE id = '44444444-4444-4444-8444-444444444441';
UPDATE currencies SET id = @inr WHERE id = '44444444-4444-4444-8444-444444444442';

SET FOREIGN_KEY_CHECKS = 1;
