import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("inventory.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL DEFAULT 0,
    unit TEXT DEFAULT 'وحدة',
    ratio REAL DEFAULT 1.0
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    open_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    close_time DATETIME,
    status TEXT DEFAULT 'open'
  );

  CREATE TABLE IF NOT EXISTS inventory_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER,
    product_id INTEGER,
    start_qty REAL DEFAULT 0,
    purchase_qty REAL DEFAULT 0,
    actual_purchase_qty REAL DEFAULT 0,
    sales_qty REAL DEFAULT 0,
    hospitality_qty REAL DEFAULT 0,
    actual_qty REAL DEFAULT 0,
    FOREIGN KEY(shift_id) REFERENCES shifts(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS shift_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER,
    total_revenue REAL DEFAULT 0,
    total_purchases REAL DEFAULT 0,
    FOREIGN KEY(shift_id) REFERENCES shifts(id)
  );

  CREATE TABLE IF NOT EXISTS carton_calculations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER,
    product_id INTEGER,
    units_per_carton REAL DEFAULT 0,
    carton_count REAL DEFAULT 0,
    FOREIGN KEY(shift_id) REFERENCES shifts(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );
`);

// Seed initial products if empty
const productCount = db.prepare("SELECT count(*) as count FROM products").get() as { count: number };
if (productCount.count === 0) {
  const insert = db.prepare("INSERT INTO products (name, category, price, unit) VALUES (?, ?, ?, ?)");
  const initialProducts = [
    ["شيبسي فئة 5ج+بسكويت", "مخزون", 5, "وحدة"],
    ["شيبسي فئة 7ج", "مخزون", 7, "وحدة"],
    ["شيبسي فئة 10ج", "مخزون", 10, "وحدة"],
    ["كوفي ميكس", "مخزون", 7, "وحدة"],
    ["شاي سايب", "مخزون", 2, "وحدة"],
    ["نسكافيه بالأظرف", "مخزون", 7, "وحدة"],
    ["نسكافيه بلاك", "مخزون", 5, "وحدة"],
    ["بن ساده", "مخزون", 10, "وحدة"],
    ["فتل(شاي+اعشاب)", "مخزون", 2, "وحدة"],
    ["حليب ساده", "مخزون", 10, "وحدة"],
    ["مشروبات غازية", "مخزون", 5, "وحدة"],
    ["عصير فرش", "مخزون", 35, "وحدة"],
    ["ليمون", "مخزون", 5, "وحدة"],
    ["حلبه", "مخزون", 3, "وحدة"],
    ["سحلب", "مخزون", 10, "وحدة"],
    ["عناب", "مخزون", 8, "وحدة"],
    ["جنزبيل سايب", "مخزون", 3, "وحدة"],
    ["سكر", "مخزون", 0, "وحدة"],
    ["نوجا", "مخزون", 1, "وحدة"],
    ["قرفه ناعمه", "مخزون", 3, "وحدة"],
    ["مناديل", "مخزون", 3, "وحدة"],
    ["كاكاو", "مخزون", 10, "وحدة"],
    ["ساندوتش جبنه بيضا", "إفطار", 6, "وحدة"],
    ["ساندوتش فلافل", "إفطار", 8, "وحدة"],
    ["ساندوتش مربى", "إفطار", 8, "وحدة"],
    ["ساندوتش كبده", "غداء", 13, "وحدة"]
  ];
  for (const p of initialProducts) {
    insert.run(p[0], p[1], p[2], p[3]);
  }
}

// Migration: Add ratio to products and actual_purchase_qty to inventory_data if they don't exist
try {
  db.prepare("ALTER TABLE products ADD COLUMN ratio REAL DEFAULT 1.0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE inventory_data ADD COLUMN actual_purchase_qty REAL DEFAULT 0").run();
} catch (e) {}

// Migration: Ensure existing products use Arabic categories
db.prepare("UPDATE products SET category = 'مخزون' WHERE category = 'inventory'").run();
db.prepare("UPDATE products SET category = 'إفطار' WHERE category = 'breakfast'").run();
db.prepare("UPDATE products SET category = 'غداء' WHERE category = 'lunch'").run();

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { name, category, price, unit, ratio, id } = req.body;
    if (id) {
      db.prepare("UPDATE products SET name = ?, category = ?, price = ?, unit = ?, ratio = ? WHERE id = ?")
        .run(name, category, price, unit, ratio, id);
    } else {
      db.prepare("INSERT INTO products (name, category, price, unit, ratio) VALUES (?, ?, ?, ?, ?)")
        .run(name, category, price, unit, ratio);
    }
    res.json({ success: true });
  });

  app.get("/api/current-shift", (req, res) => {
    let shift = db.prepare("SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as any;
    
    if (!shift) {
      return res.json({ shift: null, data: [] });
    }

    // Sync products: Add any products that are in the products table but not in inventory_data for this shift
    const missingProducts = db.prepare(`
      SELECT p.id 
      FROM products p
      LEFT JOIN inventory_data i ON p.id = i.product_id AND i.shift_id = ?
      WHERE i.id IS NULL
    `).all(shift.id) as any[];

    if (missingProducts.length > 0) {
      const insert = db.prepare("INSERT INTO inventory_data (shift_id, product_id, start_qty) VALUES (?, ?, ?)");
      for (const p of missingProducts) {
        insert.run(shift.id, p.id, 0);
      }
    }

    const data = db.prepare(`
      SELECT i.*, p.name, p.category, p.price, p.unit, p.ratio 
      FROM inventory_data i
      JOIN products p ON i.product_id = p.id
      WHERE i.shift_id = ?
    `).all(shift.id);

    res.json({ shift, data });
  });

  app.post("/api/shift/open", (req, res) => {
    const activeShift = db.prepare("SELECT id FROM shifts WHERE status = 'open'").get();
    if (activeShift) return res.status(400).json({ error: "Shift already open" });

    const info = db.prepare("INSERT INTO shifts (status) VALUES ('open')").run();
    const shiftId = info.lastInsertRowid;

    // Initialize inventory data for the new shift
    // Get last closed shift to carry over balances
    const lastShift = db.prepare("SELECT id FROM shifts WHERE status = 'closed' ORDER BY id DESC LIMIT 1").get() as any;
    
    const products = db.prepare("SELECT id FROM products").all() as any[];
    const insertData = db.prepare(`
      INSERT INTO inventory_data (shift_id, product_id, start_qty) 
      VALUES (?, ?, ?)
    `);

    for (const p of products) {
      let startQty = 0;
      if (lastShift) {
        const lastData = db.prepare("SELECT actual_qty FROM inventory_data WHERE shift_id = ? AND product_id = ?")
          .get(lastShift.id, p.id) as any;
        if (lastData) startQty = lastData.actual_qty;
      }
      insertData.run(shiftId, p.id, startQty);
    }

    res.json({ success: true, shiftId });
  });

  app.post("/api/shift/close", (req, res) => {
    const shift = db.prepare("SELECT id FROM shifts WHERE status = 'open'").get() as any;
    if (!shift) return res.status(400).json({ error: "No open shift" });

    const { totalRevenue, totalPurchases } = req.body;

    db.prepare("UPDATE shifts SET status = 'closed', close_time = CURRENT_TIMESTAMP WHERE id = ?")
      .run(shift.id);
    
    db.prepare("INSERT INTO shift_summary (shift_id, total_revenue, total_purchases) VALUES (?, ?, ?)")
      .run(shift.id, totalRevenue, totalPurchases);

    res.json({ success: true });
  });

  app.post("/api/inventory/update", (req, res) => {
    const { id, purchase_qty, actual_purchase_qty, sales_qty, hospitality_qty, actual_qty } = req.body;
    db.prepare(`
      UPDATE inventory_data 
      SET purchase_qty = ?, actual_purchase_qty = ?, sales_qty = ?, hospitality_qty = ?, actual_qty = ?
      WHERE id = ?
    `).run(purchase_qty, actual_purchase_qty, sales_qty, hospitality_qty, actual_qty, id);
    res.json({ success: true });
  });

  app.delete("/api/products/:id", (req, res) => {
    const { id } = req.params;
    // Delete related data first to maintain integrity
    db.prepare("DELETE FROM inventory_data WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM carton_calculations WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM products WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/reports", (req, res) => {
    const reports = db.prepare(`
      SELECT 
        s.*, 
        ss.total_revenue, 
        ss.total_purchases,
        (SELECT COUNT(*) FROM inventory_data WHERE shift_id = s.id AND sales_qty > 0) as items_sold_count
      FROM shifts s
      LEFT JOIN shift_summary ss ON s.id = ss.shift_id
      WHERE s.status = 'closed'
      ORDER BY s.id DESC
    `).all();
    res.json(reports);
  });

  app.get("/api/reports/:id", (req, res) => {
    const { id } = req.params;
    const shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(id);
    if (!shift) return res.status(404).json({ error: "Shift not found" });

    const summary = db.prepare("SELECT * FROM shift_summary WHERE shift_id = ?").get(id);
    const inventory = db.prepare(`
      SELECT id.*, p.name, p.category, p.price, p.ratio
      FROM inventory_data id
      JOIN products p ON id.product_id = p.id
      WHERE id.shift_id = ?
    `).all(id);

    res.json({ shift, summary, inventory });
  });

  app.get("/api/carton-calculations/:shiftId/:productId", (req, res) => {
    const { shiftId, productId } = req.params;
    const data = db.prepare("SELECT * FROM carton_calculations WHERE shift_id = ? AND product_id = ?")
      .all(shiftId, productId);
    res.json(data);
  });

  app.post("/api/carton-calculations", (req, res) => {
    const { shiftId, productId, rows } = req.body;
    
    // Delete existing for this product/shift
    db.prepare("DELETE FROM carton_calculations WHERE shift_id = ? AND product_id = ?")
      .run(shiftId, productId);

    const insert = db.prepare("INSERT INTO carton_calculations (shift_id, product_id, units_per_carton, carton_count) VALUES (?, ?, ?, ?)");
    
    let total = 0;
    for (const row of rows) {
      insert.run(shiftId, productId, row.units_per_carton, row.carton_count);
      total += (row.units_per_carton * row.carton_count);
    }

    // Update the inventory_data purchase_qty
    db.prepare("UPDATE inventory_data SET purchase_qty = ? WHERE shift_id = ? AND product_id = ?")
      .run(total, shiftId, productId);

    res.json({ success: true, total });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
