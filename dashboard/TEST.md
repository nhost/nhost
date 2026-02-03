  -- ============================================
  -- Test Schema for Database Objects Feature
  -- ============================================

  -- Create a test schema (optional, you can use 'public')
  CREATE SCHEMA IF NOT EXISTS test_db_objects;

  -- ============================================
  -- 1. TABLES WITH VARIOUS CONSTRAINTS
  -- ============================================

  -- Categories table (simple, will be referenced by products)
  CREATE TABLE test_db_objects.categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      slug VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),

      -- CHECK constraint on name length
      CONSTRAINT chk_category_name_length CHECK (LENGTH(name) >= 2)
  );

  -- Products table with multiple constraints
  CREATE TABLE test_db_objects.products (
      id SERIAL PRIMARY KEY,
      sku VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category_id INTEGER NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      quantity INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'draft',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),

      -- UNIQUE constraint
      CONSTRAINT uq_product_sku UNIQUE (sku),

      -- FOREIGN KEY constraint
      CONSTRAINT fk_product_category
          FOREIGN KEY (category_id)
          REFERENCES test_db_objects.categories(id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

      -- CHECK constraints
      CONSTRAINT chk_product_price_positive CHECK (price >= 0),
      CONSTRAINT chk_product_quantity_non_negative CHECK (quantity >= 0),
      CONSTRAINT chk_product_status CHECK (status IN ('draft', 'active', 'archived',
  'out_of_stock'))
  );

  -- Create index on products
  CREATE INDEX idx_products_category ON test_db_objects.products(category_id);
  CREATE INDEX idx_products_status ON test_db_objects.products(status);
  CREATE INDEX idx_products_price ON test_db_objects.products(price DESC);

  -- Orders table
  CREATE TABLE test_db_objects.orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(50) NOT NULL UNIQUE,
      customer_email VARCHAR(255) NOT NULL,
      total_amount DECIMAL(12, 2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),

      -- CHECK constraints
      CONSTRAINT chk_order_email CHECK (customer_email ~*
  '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
      CONSTRAINT chk_order_status CHECK (status IN ('pending', 'confirmed', 'shipped',
  'delivered', 'cancelled'))
  );

  -- Order items (junction table with composite constraints)
  CREATE TABLE test_db_objects.order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),

      -- FOREIGN KEY constraints
      CONSTRAINT fk_order_item_order
          FOREIGN KEY (order_id)
          REFERENCES test_db_objects.orders(id)
          ON DELETE CASCADE,

      CONSTRAINT fk_order_item_product
          FOREIGN KEY (product_id)
          REFERENCES test_db_objects.products(id)
          ON DELETE RESTRICT,

      -- UNIQUE constraint (prevent duplicate items in same order)
      CONSTRAINT uq_order_product UNIQUE (order_id, product_id),

      -- CHECK constraint
      CONSTRAINT chk_order_item_quantity CHECK (quantity > 0)
  );

  -- Audit log table (for triggers to write to)
  CREATE TABLE test_db_objects.audit_log (
      id SERIAL PRIMARY KEY,
      table_name VARCHAR(100) NOT NULL,
      record_id INTEGER,
      action VARCHAR(10) NOT NULL,
      old_data JSONB,
      new_data JSONB,
      changed_by TEXT DEFAULT current_user,
      changed_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- ============================================
  -- 2. TRIGGER FUNCTIONS
  -- ============================================

  -- Function to update 'updated_at' timestamp
  CREATE OR REPLACE FUNCTION test_db_objects.update_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Function to log changes to audit table
  CREATE OR REPLACE FUNCTION test_db_objects.log_changes()
  RETURNS TRIGGER AS $$
  BEGIN
      IF TG_OP = 'INSERT' THEN
          INSERT INTO test_db_objects.audit_log (table_name, record_id, action, new_data)
          VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));
          RETURN NEW;
      ELSIF TG_OP = 'UPDATE' THEN
          INSERT INTO test_db_objects.audit_log (table_name, record_id, action, old_data,
   new_data)
          VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
          RETURN NEW;
      ELSIF TG_OP = 'DELETE' THEN
          INSERT INTO test_db_objects.audit_log (table_name, record_id, action, old_data)
          VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
          RETURN OLD;
      END IF;
      RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;

  -- Function to update order total when items change
  CREATE OR REPLACE FUNCTION test_db_objects.update_order_total()
  RETURNS TRIGGER AS $$
  DECLARE
      new_total DECIMAL(12, 2);
  BEGIN
      -- Calculate new total for the order
      SELECT COALESCE(SUM(quantity * unit_price), 0)
      INTO new_total
      FROM test_db_objects.order_items
      WHERE order_id = COALESCE(NEW.order_id, OLD.order_id);

      -- Update the order
      UPDATE test_db_objects.orders
      SET total_amount = new_total,
          updated_at = NOW()
      WHERE id = COALESCE(NEW.order_id, OLD.order_id);

      RETURN COALESCE(NEW, OLD);
  END;
  $$ LANGUAGE plpgsql;

  -- Function to check product stock before order
  CREATE OR REPLACE FUNCTION test_db_objects.check_product_stock()
  RETURNS TRIGGER AS $$
  DECLARE
      available_qty INTEGER;
  BEGIN
      SELECT quantity INTO available_qty
      FROM test_db_objects.products
      WHERE id = NEW.product_id;

      IF available_qty < NEW.quantity THEN
          RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %',

              NEW.product_id, available_qty, NEW.quantity;
      END IF;

      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- ============================================
  -- 3. TRIGGERS
  -- ============================================

  -- Update timestamp triggers
  CREATE TRIGGER trg_products_updated_at
      BEFORE UPDATE ON test_db_objects.products
      FOR EACH ROW
      EXECUTE FUNCTION test_db_objects.update_timestamp();

  CREATE TRIGGER trg_orders_updated_at
      BEFORE UPDATE ON test_db_objects.orders
      FOR EACH ROW
      EXECUTE FUNCTION test_db_objects.update_timestamp();

  -- Audit log triggers for products
  CREATE TRIGGER trg_products_audit
      AFTER INSERT OR UPDATE OR DELETE ON test_db_objects.products
      FOR EACH ROW
      EXECUTE FUNCTION test_db_objects.log_changes();

  -- Audit log triggers for orders
  CREATE TRIGGER trg_orders_audit
      AFTER INSERT OR UPDATE OR DELETE ON test_db_objects.orders
      FOR EACH ROW
      EXECUTE FUNCTION test_db_objects.log_changes();

  -- Order total calculation trigger
  CREATE TRIGGER trg_order_items_total
      AFTER INSERT OR UPDATE OR DELETE ON test_db_objects.order_items
      FOR EACH ROW
      EXECUTE FUNCTION test_db_objects.update_order_total();

  -- Stock check trigger (BEFORE INSERT)
  CREATE TRIGGER trg_order_items_stock_check
      BEFORE INSERT ON test_db_objects.order_items
      FOR EACH ROW
      EXECUTE FUNCTION test_db_objects.check_product_stock();

  -- ============================================
  -- 4. SAMPLE DATA
  -- ============================================

  -- Insert categories
  INSERT INTO test_db_objects.categories (name, slug, description) VALUES
      ('Electronics', 'electronics', 'Electronic devices and accessories'),
      ('Clothing', 'clothing', 'Apparel and fashion items'),
      ('Books', 'books', 'Physical and digital books');

  -- Insert products
  INSERT INTO test_db_objects.products (sku, name, category_id, price, quantity, status)
  VALUES
      ('ELEC-001', 'Wireless Headphones', 1, 79.99, 50, 'active'),
      ('ELEC-002', 'USB-C Cable', 1, 12.99, 200, 'active'),
      ('CLTH-001', 'Cotton T-Shirt', 2, 24.99, 100, 'active'),
      ('BOOK-001', 'PostgreSQL Guide', 3, 49.99, 30, 'active');

  -- Insert an order
  INSERT INTO test_db_objects.orders (order_number, customer_email, status) VALUES
      ('ORD-2024-001', 'customer@example.com', 'pending');

  -- Insert order items (this will trigger stock check and total update)
  INSERT INTO test_db_objects.order_items (order_id, product_id, quantity, unit_price)
  VALUES
      (1, 1, 2, 79.99),
      (1, 2, 3, 12.99);

  -- ============================================
  -- 5. VERIFICATION QUERIES
  -- ============================================

  -- View all constraints
  SELECT
      conname AS constraint_name,
      contype AS type,
      pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
  WHERE connamespace = 'test_db_objects'::regnamespace
  ORDER BY conrelid::regclass::text, contype;

  -- View all triggers
  SELECT
      tgname AS trigger_name,
      tgrelid::regclass AS table_name,
      proname AS function_name,
      CASE
          WHEN tgtype & 2 = 2 THEN 'BEFORE'
          ELSE 'AFTER'
      END AS timing,
      ARRAY_REMOVE(ARRAY[
          CASE WHEN tgtype & 4 = 4 THEN 'INSERT' END,
          CASE WHEN tgtype & 8 = 8 THEN 'DELETE' END,
          CASE WHEN tgtype & 16 = 16 THEN 'UPDATE' END
      ], NULL) AS events
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE tgrelid::regclass::text LIKE 'test_db_objects.%'
      AND NOT tgisinternal
  ORDER BY tgrelid::regclass::text, tgname;

  -- View audit log
  SELECT * FROM test_db_objects.audit_log ORDER BY changed_at DESC;

  -- View order with calculated total
  SELECT * FROM test_db_objects.orders;
