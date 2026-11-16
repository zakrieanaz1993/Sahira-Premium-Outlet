/*
# Add scheduled product special offers

1. New product offer columns
- `offer_enabled` — whether the scheduled promotion is enabled.
- `offer_type` — promotion style such as flash sale, clearance, or member offer.
- `offer_label` — short label shown beside the product price.
- `offer_discount` — percentage discount used only while the offer is active.
- `offer_ends_at` — UTC timestamp when the offer ends.

2. Existing data
- Existing product prices and discounts are preserved.
- New offer fields default to disabled and empty, so current storefront pricing does not change until an admin activates an offer.

3. Security
- The existing single-tenant no-auth storefront access model is retained.
- RLS remains enabled on `products`; existing anon/authenticated CRUD grants and policies continue to apply.

4. Important notes
- The storefront will treat an offer as active only when it is enabled, has a valid end time, and the current time is before that end time.
- After expiry, the scheduled offer discount is ignored and the product returns to its normal price.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_type text NOT NULL DEFAULT 'flash_sale';
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_label text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_discount int NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_ends_at timestamptz;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_offer_discount_check;
ALTER TABLE products ADD CONSTRAINT products_offer_discount_check CHECK (offer_discount >= 0 AND offer_discount <= 95);

GRANT SELECT, INSERT, UPDATE, DELETE ON products TO anon, authenticated;
