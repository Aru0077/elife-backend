-- AlterTable
ALTER TABLE `orders` ADD COLUMN `anomaly_details` TEXT NULL,
    ADD COLUMN `anomaly_reason` VARCHAR(100) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `orders_recharge_status_recharge_at_seq_id_idx` ON `orders`(`recharge_status`, `recharge_at`, `seq_id`);

-- CreateIndex
CREATE INDEX `orders_payment_status_recharge_status_recharge_at_idx` ON `orders`(`payment_status`, `recharge_status`, `recharge_at`);

-- CreateIndex
CREATE INDEX `orders_anomaly_reason_idx` ON `orders`(`anomaly_reason`);
