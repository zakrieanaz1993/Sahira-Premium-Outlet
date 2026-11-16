/*
# Sahira Premium Outlet — Core Database Schema

Creates the persistent data tables for the Sahira Premium Outlet storefront,
migrating data that was previously stored in browser localStorage to Supabase.

1. New Tables

- `members` — registered customers (phone-based membership)
  - id (uuid PK), name (text), phone (text), phone_norm (text unique),
    created_at (timestamptz), last_login_at (timestamptz)

- `orders` — lock-item orders created when a customer sends their styling bag to WhatsApp
  - id (text PK, app-generated), ref (text unique, e.g. SHR-XXXX),
    customer_name (text), customer_phone (text),
    created_at (timestamptz)

- `order_items` — individual items within an order (each can be locked/paid/unlocked)
  - id (uuid PK), order_id (text FK -> orders.id ON DELETE CASCADE),
    item_id (text), variant_id (bigint), name (text), size (text),
    qty (int), unit_price (numeric), image (text),
    status (text: locked|paid|unlocked), stock_deducted (boolean),
    locked_at (timestamptz), paid_at (timestamptz),
    unlocked_at (timestamptz), unlock_reason (text)

- `products` — inventory items shown in the runway & lookbook
  - id (text PK, e.g. 'poplin-button-shirt'),
    name (text), type (text), category (text),
    is_new (boolean), price (numeric), discount (int),
    stock (int), sizes (text[]), image (text), url (text),
    sort_order (int), created_at (timestamptz)

- `looks` — outfit looks shown on the 3D runway
  - id (uuid PK), name (text), description (text),
    src (text), srcset (text),
    products (text[] — array of product IDs),
    pins (jsonb — array of {x, y} coordinates),
    sort_order (int), created_at (timestamptz)

- `reels` — Hand Rail Pro video reels
  - id (text PK, e.g. 'reel-look-0'),
    look_index (int), video_url (text),
    handle (text), verified (boolean), following (boolean),
    category (text), caption (text), audio (text),
    base_likes (int), base_saves (int), base_shares (int),
    bg_tone (text[]), comments (jsonb),
    sort_order (int), created_at (timestamptz)

- `reel_social` — per-reel social interactions (likes, saves, follows)
  - id (uuid PK), reel_id (text),
    session_key (text — identifies the browser session),
    is_liked (boolean), is_saved (boolean), is_following (boolean),
    created_at (timestamptz)

- `reel_comments` — user-submitted comments on reels
  - id (uuid PK), reel_id (text),
    author (text), text (text),
    parent_id (uuid nullable — for replies),
    created_at (timestamptz),
    likes (int default 0)

- `sales_targets` — configurable daily/monthly sales goals
  - id (int PK, singleton row id=1),
    daily (numeric), monthly (numeric), monthly_units (int),
    updated_at (timestamptz)

- `store_config` — singleton store settings
  - id (int PK, singleton row id=1),
    whatsapp_number (text),
    updated_at (timestamptz)

2. Security

- This is a no-auth storefront (custom phone-based membership, NOT Supabase auth).
  The browser talks to Supabase with the anon key for all operations.
- ALL policies use `TO anon, authenticated` so the anon-key client can read/write.
- RLS enabled on every table.
- Grants: CRUD (SELECT, INSERT, UPDATE, DELETE) on all tables to anon + authenticated.
*/

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Pelanggan Sahira',
  phone text NOT NULL DEFAULT '',
  phone_norm text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz DEFAULT now()
);
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON members TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_members" ON members;
CREATE POLICY "anon_select_members" ON members FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_members" ON members;
CREATE POLICY "anon_insert_members" ON members FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_members" ON members;
CREATE POLICY "anon_update_members" ON members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_members" ON members;
CREATE POLICY "anon_delete_members" ON members FOR DELETE TO anon, authenticated USING (true);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  ref text UNIQUE NOT NULL,
  customer_name text NOT NULL DEFAULT 'Pelanggan Sahira',
  customer_phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE TO anon, authenticated USING (true);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id text NOT NULL DEFAULT '',
  variant_id bigint NOT NULL DEFAULT 0,
  name text NOT NULL DEFAULT 'Item',
  size text NOT NULL DEFAULT '-',
  qty int NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  image text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'locked',
  stock_deducted boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  paid_at timestamptz,
  unlocked_at timestamptz,
  unlock_reason text
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_order_items" ON order_items;
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE TO anon, authenticated USING (true);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT 'Item',
  type text NOT NULL DEFAULT 'Sahira Premium Outlet',
  category text NOT NULL DEFAULT 'apparel',
  is_new boolean NOT NULL DEFAULT false,
  price numeric NOT NULL DEFAULT 0,
  discount int NOT NULL DEFAULT 0,
  stock int NOT NULL DEFAULT 0,
  sizes text[] NOT NULL DEFAULT '{}',
  image text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE TO anon, authenticated USING (true);

-- Looks table
CREATE TABLE IF NOT EXISTS looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Outfit',
  description text NOT NULL DEFAULT '',
  src text NOT NULL DEFAULT '',
  srcset text NOT NULL DEFAULT '',
  products text[] NOT NULL DEFAULT '{}',
  pins jsonb NOT NULL DEFAULT '[]',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE looks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON looks TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_looks" ON looks;
CREATE POLICY "anon_select_looks" ON looks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_looks" ON looks;
CREATE POLICY "anon_insert_looks" ON looks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_looks" ON looks;
CREATE POLICY "anon_update_looks" ON looks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_looks" ON looks;
CREATE POLICY "anon_delete_looks" ON looks FOR DELETE TO anon, authenticated USING (true);

-- Reels table
CREATE TABLE IF NOT EXISTS reels (
  id text PRIMARY KEY,
  look_index int NOT NULL DEFAULT 0,
  video_url text NOT NULL DEFAULT '',
  handle text NOT NULL DEFAULT '@sahirapremiumoutlet',
  verified boolean NOT NULL DEFAULT true,
  following boolean NOT NULL DEFAULT true,
  category text NOT NULL DEFAULT 'apparel',
  caption text NOT NULL DEFAULT '',
  audio text NOT NULL DEFAULT '',
  base_likes int NOT NULL DEFAULT 0,
  base_saves int NOT NULL DEFAULT 0,
  base_shares int NOT NULL DEFAULT 0,
  bg_tone text[] NOT NULL DEFAULT '{}',
  comments jsonb NOT NULL DEFAULT '[]',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON reels TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_reels" ON reels;
CREATE POLICY "anon_select_reels" ON reels FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reels" ON reels;
CREATE POLICY "anon_insert_reels" ON reels FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reels" ON reels;
CREATE POLICY "anon_update_reels" ON reels FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_reels" ON reels;
CREATE POLICY "anon_delete_reels" ON reels FOR DELETE TO anon, authenticated USING (true);

-- Reel social interactions table
CREATE TABLE IF NOT EXISTS reel_social (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id text NOT NULL DEFAULT '',
  session_key text NOT NULL DEFAULT '',
  is_liked boolean NOT NULL DEFAULT false,
  is_saved boolean NOT NULL DEFAULT false,
  is_following boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reel_social ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON reel_social TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_reel_social" ON reel_social;
CREATE POLICY "anon_select_reel_social" ON reel_social FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reel_social" ON reel_social;
CREATE POLICY "anon_insert_reel_social" ON reel_social FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reel_social" ON reel_social;
CREATE POLICY "anon_update_reel_social" ON reel_social FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_reel_social" ON reel_social;
CREATE POLICY "anon_delete_reel_social" ON reel_social FOR DELETE TO anon, authenticated USING (true);

-- Reel comments table (user-submitted)
CREATE TABLE IF NOT EXISTS reel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  parent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  likes int NOT NULL DEFAULT 0
);
ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON reel_comments TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_reel_comments" ON reel_comments;
CREATE POLICY "anon_select_reel_comments" ON reel_comments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reel_comments" ON reel_comments;
CREATE POLICY "anon_insert_reel_comments" ON reel_comments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reel_comments" ON reel_comments;
CREATE POLICY "anon_update_reel_comments" ON reel_comments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_reel_comments" ON reel_comments;
CREATE POLICY "anon_delete_reel_comments" ON reel_comments FOR DELETE TO anon, authenticated USING (true);

-- Sales targets table (singleton)
CREATE TABLE IF NOT EXISTS sales_targets (
  id int PRIMARY KEY DEFAULT 1,
  daily numeric NOT NULL DEFAULT 500,
  monthly numeric NOT NULL DEFAULT 5000,
  monthly_units int NOT NULL DEFAULT 40,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_targets TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_sales_targets" ON sales_targets;
CREATE POLICY "anon_select_sales_targets" ON sales_targets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sales_targets" ON sales_targets;
CREATE POLICY "anon_insert_sales_targets" ON sales_targets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sales_targets" ON sales_targets;
CREATE POLICY "anon_update_sales_targets" ON sales_targets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sales_targets" ON sales_targets;
CREATE POLICY "anon_delete_sales_targets" ON sales_targets FOR DELETE TO anon, authenticated USING (true);

-- Store config table (singleton)
CREATE TABLE IF NOT EXISTS store_config (
  id int PRIMARY KEY DEFAULT 1,
  whatsapp_number text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE store_config ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON store_config TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_store_config" ON store_config;
CREATE POLICY "anon_select_store_config" ON store_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_store_config" ON store_config;
CREATE POLICY "anon_insert_store_config" ON store_config FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_store_config" ON store_config;
CREATE POLICY "anon_update_store_config" ON store_config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_store_config" ON store_config;
CREATE POLICY "anon_delete_store_config" ON store_config FOR DELETE TO anon, authenticated USING (true);

-- Indexes for frequently-queried columns
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_phone_norm ON members(phone_norm);
CREATE INDEX IF NOT EXISTS idx_reel_social_reel_session ON reel_social(reel_id, session_key);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_id ON reel_comments(reel_id);
CREATE INDEX IF NOT EXISTS idx_looks_sort_order ON looks(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_reels_sort_order ON reels(sort_order);

-- Seed default sales targets row
INSERT INTO sales_targets (id, daily, monthly, monthly_units)
VALUES (1, 500, 5000, 40)
ON CONFLICT (id) DO NOTHING;

-- Seed default store config row
INSERT INTO store_config (id, whatsapp_number)
VALUES (1, '')
ON CONFLICT (id) DO NOTHING;
