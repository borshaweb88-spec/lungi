// Turso database-এর table আর শুরুর পণ্য (migrations/0001_initial.sql-এর কপি)
export const schemaSql = `PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK(price >= 0),
  compare_at INTEGER,
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  image_url TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL,
  transaction_code TEXT NOT NULL DEFAULT '',
  proof_key TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT 'not_required',
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal INTEGER NOT NULL,
  shipping_fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_title TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  line_total INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, active);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

INSERT OR IGNORE INTO categories (id, slug, name, description, sort_order) VALUES
  (1, 'saree', 'শাড়ি', 'ঐতিহ্য আর সৌন্দর্যের শাড়ি সংগ্রহ', 1),
  (2, 'lungi', 'লুঙ্গি', 'আরামদায়ক দৈনন্দিন ও প্রিমিয়াম লুঙ্গি', 2);

INSERT OR IGNORE INTO store_settings (key, value) VALUES
  ('store_name', 'নওয়াব লুম'),
  ('tagline', 'বাংলার বুননে, আপন সাজে'),
  ('about', 'শাড়ি ও লুঙ্গির যত্নে বাছাই করা সংগ্রহ—ঐতিহ্য, আরাম আর গুণমান একসাথে।'),
  ('phone', ''), ('whatsapp', ''), ('facebook', ''), ('instagram', ''),
  ('address', ''), ('email', ''), ('shipping_fee', '80'),
  ('payment_bkash', ''), ('payment_nagad', ''), ('payment_rocket', ''),
  ('payment_card_url', ''), ('payment_instructions', 'পেমেন্টের পর ট্রানজ্যাকশন কোড ও স্ক্রিনশট দিন। Admin যাচাই করার পর অর্ডার নিশ্চিত হবে।');

INSERT OR IGNORE INTO products (id, slug, title, category_id, description, price, compare_at, stock, image_url, featured, active) VALUES
  (1, 'jamdani-heritage-demo', 'জামদানি হেরিটেজ শাড়ি · ডেমো', 1, 'সূক্ষ্ম নকশা ও নরম বুননের প্রিমিয়াম জামদানি শাড়ি। এটি নমুনা পণ্য—নিজের আসল ছবি ও তথ্য দিয়ে বদলে নিন।', 4850, 5600, 12, '', 1, 1),
  (2, 'cotton-tangail-demo', 'টাঙ্গাইল কটন শাড়ি · ডেমো', 1, 'হালকা আর আরামদায়ক কটন শাড়ি। নমুনা পণ্য, launch-এর আগে সঠিক বিবরণ দিন।', 2150, 2500, 18, '', 1, 1),
  (3, 'silk-occasion-demo', 'সিল্ক উৎসব শাড়ি · ডেমো', 1, 'বিশেষ দিনের জন্য বাছাই করা উজ্জ্বল সিল্ক শাড়ি। নমুনা পণ্য, launch-এর আগে সঠিক বিবরণ দিন।', 3950, NULL, 8, '', 0, 1),
  (4, 'premium-check-lungi-demo', 'প্রিমিয়াম চেক লুঙ্গি · ডেমো', 2, 'নরম সুতি কাপড়ে আরামদায়ক চেক লুঙ্গি। নমুনা পণ্য, launch-এর আগে সঠিক বিবরণ দিন।', 780, 950, 25, '', 1, 1),
  (5, 'cotton-comfort-lungi-demo', 'কমফোর্ট কটন লুঙ্গি · ডেমো', 2, 'প্রতিদিনের ব্যবহারের জন্য আরামদায়ক সুতি লুঙ্গি। নমুনা পণ্য, launch-এর আগে সঠিক বিবরণ দিন।', 620, NULL, 30, '', 0, 1),
  (6, 'classic-stripe-lungi-demo', 'ক্লাসিক স্ট্রাইপ লুঙ্গি · ডেমো', 2, 'ক্লাসিক স্ট্রাইপ ডিজাইনের বাছাই করা লুঙ্গি। নমুনা পণ্য, launch-এর আগে সঠিক বিবরণ দিন।', 850, 1000, 15, '', 0, 1);
`;
