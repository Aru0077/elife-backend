-- AlterTable
ALTER TABLE `orders` MODIFY `payment_status` VARCHAR(20) NOT NULL DEFAULT 'unpaid';

-- CreateTable
CREATE TABLE `exchange_rates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `currency` VARCHAR(20) NOT NULL,
    `rate` DECIMAL(10, 4) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `exchange_rates_currency_key`(`currency`),
    INDEX `exchange_rates_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
