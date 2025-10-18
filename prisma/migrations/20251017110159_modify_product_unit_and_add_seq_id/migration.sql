-- AlterTable: 修改 product_unit 从 VARCHAR 改为 INT
-- 注意: 如果有现有数据,需要先清空或转换数据
ALTER TABLE `orders` MODIFY COLUMN `product_unit` INT NULL;

-- AlterTable: 添加 seq_id 字段用于存储交易查询ID
ALTER TABLE `orders` ADD COLUMN `seq_id` VARCHAR(100) NULL;
