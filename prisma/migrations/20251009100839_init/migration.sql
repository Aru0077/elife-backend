-- CreateTable
CREATE TABLE `users` (
    `openid` VARCHAR(50) NOT NULL,
    `unionid` VARCHAR(50) NULL,
    `appid` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_unionid_key`(`unionid`),
    INDEX `users_created_at_idx`(`created_at`),
    PRIMARY KEY (`openid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `order_number` VARCHAR(32) NOT NULL,
    `openid` VARCHAR(50) NOT NULL,
    `phone_number` VARCHAR(20) NOT NULL,
    `product_operator` VARCHAR(50) NOT NULL,
    `product_recharge_type` VARCHAR(50) NOT NULL,
    `product_name` VARCHAR(100) NOT NULL,
    `product_code` VARCHAR(50) NOT NULL,
    `product_price_tg` DECIMAL(10, 2) NOT NULL,
    `product_price_rmb` DECIMAL(10, 2) NOT NULL,
    `product_unit` VARCHAR(20) NULL,
    `product_data` TEXT NULL,
    `product_days` INTEGER NULL,
    `payment_status` VARCHAR(20) NOT NULL,
    `recharge_status` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paid_at` DATETIME(3) NULL,
    `recharge_at` DATETIME(3) NULL,

    INDEX `orders_openid_idx`(`openid`),
    INDEX `orders_payment_status_idx`(`payment_status`),
    INDEX `orders_recharge_status_idx`(`recharge_status`),
    INDEX `orders_created_at_idx`(`created_at`),
    INDEX `orders_recharge_status_paid_at_idx`(`recharge_status`, `paid_at`),
    PRIMARY KEY (`order_number`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_openid_fkey` FOREIGN KEY (`openid`) REFERENCES `users`(`openid`) ON DELETE RESTRICT ON UPDATE CASCADE;
