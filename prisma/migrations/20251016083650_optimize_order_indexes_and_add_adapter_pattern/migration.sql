-- DropIndex
DROP INDEX `orders_payment_status_idx` ON `orders`;

-- DropIndex
DROP INDEX `orders_recharge_status_idx` ON `orders`;

-- DropIndex
DROP INDEX `orders_recharge_status_paid_at_idx` ON `orders`;

-- CreateIndex
CREATE INDEX `orders_phone_number_idx` ON `orders`(`phone_number`);

-- CreateIndex
CREATE INDEX `orders_product_operator_product_recharge_type_idx` ON `orders`(`product_operator`, `product_recharge_type`);

-- CreateIndex
CREATE INDEX `orders_payment_status_recharge_status_paid_at_idx` ON `orders`(`payment_status`, `recharge_status`, `paid_at`);
