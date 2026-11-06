ALTER TABLE purchase_item ADD COLUMN received_quantity NUMERIC(19,3) NOT NULL DEFAULT 0;
ALTER TABLE purchase_item ADD CONSTRAINT purchase_item_received_quantity_ck
  CHECK (received_quantity >= 0 AND received_quantity <= quantity);
CREATE INDEX idx_purchase_item_purchase ON purchase_item(purchase_id);
