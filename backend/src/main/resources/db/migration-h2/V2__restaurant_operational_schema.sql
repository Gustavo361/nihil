-- Initial operational schema. Monetary values use NUMERIC; business calculations stay in application code.

CREATE TABLE app_user (
  id UUID PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permission (
  code VARCHAR(80) PRIMARY KEY,
  description VARCHAR(160) NOT NULL
);

CREATE TABLE user_permission (
  user_id UUID NOT NULL REFERENCES app_user(id),
  permission_code VARCHAR(80) NOT NULL REFERENCES permission(code),
  PRIMARY KEY (user_id, permission_code)
);

CREATE TABLE employee (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES app_user(id),
  name VARCHAR(160) NOT NULL,
  role_name VARCHAR(120) NOT NULL,
  monthly_cost NUMERIC(19,2) NOT NULL CHECK (monthly_cost >= 0),
  status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
  notes VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supplier (
  id UUID PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  document_number VARCHAR(32),
  contact_name VARCHAR(160),
  phone VARCHAR(40),
  email VARCHAR(254),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_item (
  id UUID PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  minimum_quantity NUMERIC(19,3) NOT NULL DEFAULT 0 CHECK (minimum_quantity >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock_movement (
  id UUID PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES inventory_item(id),
  type VARCHAR(24) NOT NULL CHECK (type IN ('PURCHASE_RECEIPT', 'SALE_CONSUMPTION', 'LOSS', 'ADJUSTMENT', 'INVENTORY_COUNT')),
  quantity NUMERIC(19,3) NOT NULL,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reference_type VARCHAR(40),
  reference_id UUID,
  notes VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_stock_movement_item_occurred_at ON stock_movement(item_id, occurred_at);

CREATE TABLE menu_item (
  id UUID PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  sale_price NUMERIC(19,2) NOT NULL CHECK (sale_price >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_recipe_item (
  menu_item_id UUID NOT NULL REFERENCES menu_item(id),
  inventory_item_id UUID NOT NULL REFERENCES inventory_item(id),
  quantity NUMERIC(19,3) NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (menu_item_id, inventory_item_id)
);

CREATE TABLE purchase (
  id UUID PRIMARY KEY,
  supplier_id UUID REFERENCES supplier(id),
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'RECEIVED', 'CANCELLED')),
  total_amount NUMERIC(19,2) NOT NULL CHECK (total_amount >= 0),
  notes VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_item (
  id UUID PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchase(id),
  inventory_item_id UUID NOT NULL REFERENCES inventory_item(id),
  quantity NUMERIC(19,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(19,2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE sale (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES employee(id),
  sold_at TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_method VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('CONFIRMED', 'CANCELLED')),
  total_amount NUMERIC(19,2) NOT NULL CHECK (total_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sale_sold_at ON sale(sold_at);

CREATE TABLE sale_item (
  id UUID PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sale(id),
  menu_item_id UUID REFERENCES menu_item(id),
  description VARCHAR(160) NOT NULL,
  quantity NUMERIC(19,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(19,2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE expense (
  id UUID PRIMARY KEY,
  description VARCHAR(200) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('FIXED', 'VARIABLE')),
  amount NUMERIC(19,2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
  paid_at TIMESTAMP WITH TIME ZONE,
  recurrence VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (recurrence IN ('NONE', 'MONTHLY', 'SEMIANNUAL', 'ANNUAL')),
  notes VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_expense_due_date ON expense(due_date);

CREATE TABLE payroll_run (
  id UUID PRIMARY KEY,
  reference_month DATE NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
  total_amount NUMERIC(19,2) NOT NULL CHECK (total_amount >= 0),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payroll_entry (
  id UUID PRIMARY KEY,
  payroll_run_id UUID NOT NULL REFERENCES payroll_run(id),
  employee_id UUID NOT NULL REFERENCES employee(id),
  amount NUMERIC(19,2) NOT NULL CHECK (amount >= 0),
  UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE cash_session (
  id UUID PRIMARY KEY,
  opened_by_employee_id UUID REFERENCES employee(id),
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
  opening_amount NUMERIC(19,2) NOT NULL CHECK (opening_amount >= 0),
  closed_at TIMESTAMP WITH TIME ZONE,
  closing_amount NUMERIC(19,2),
  status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  notes VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cash_movement (
  id UUID PRIMARY KEY,
  cash_session_id UUID NOT NULL REFERENCES cash_session(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('SALE', 'WITHDRAWAL', 'DEPOSIT', 'ADJUSTMENT')),
  amount NUMERIC(19,2) NOT NULL CHECK (amount >= 0),
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notes VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
