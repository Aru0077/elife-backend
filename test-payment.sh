#!/bin/bash
# 微信支付功能测试脚本

echo "==================================="
echo "微信支付功能测试"
echo "==================================="
echo ""

# 配置
BASE_URL="http://localhost:3000"
TEST_OPENID="test_user_001"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}1. 测试健康检查${NC}"
curl -s ${BASE_URL}/health | jq '.'
echo ""
echo ""

echo -e "${YELLOW}2. 创建测试订单${NC}"
CREATE_ORDER_RESPONSE=$(curl -s -X POST ${BASE_URL}/orders \
  -H "Content-Type: application/json" \
  -H "X-Mock-Openid: ${TEST_OPENID}" \
  -d '{
    "phoneNumber": "85512345678",
    "productOperator": "Unitel",
    "productRechargeType": "data",
    "productName": "测试充值套餐",
    "productCode": "TEST_CODE",
    "productPriceTg": 10000,
    "productPriceRmb": 10,
    "productUnit": "GB",
    "productDays": 30
  }')

echo "${CREATE_ORDER_RESPONSE}" | jq '.'
ORDER_NUMBER=$(echo "${CREATE_ORDER_RESPONSE}" | jq -r '.data.orderNumber')
echo ""
echo -e "${GREEN}订单号: ${ORDER_NUMBER}${NC}"
echo ""
echo ""

if [ -z "${ORDER_NUMBER}" ] || [ "${ORDER_NUMBER}" = "null" ]; then
  echo -e "${RED}❌ 创建订单失败，请检查服务是否正常运行${NC}"
  exit 1
fi

echo -e "${YELLOW}3. 创建支付订单${NC}"
PAYMENT_RESPONSE=$(curl -s -X POST ${BASE_URL}/payment/create \
  -H "Content-Type: application/json" \
  -H "X-Mock-Openid: ${TEST_OPENID}" \
  -d "{
    \"orderNumber\": \"${ORDER_NUMBER}\"
  }")

echo "${PAYMENT_RESPONSE}" | jq '.'
echo ""
echo ""

# 检查支付响应
if echo "${PAYMENT_RESPONSE}" | jq -e '.data.appId' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 支付订单创建成功${NC}"
  echo ""
  echo "支付参数（用于小程序 wx.requestPayment）:"
  echo "${PAYMENT_RESPONSE}" | jq '.data'
else
  echo -e "${RED}❌ 支付订单创建失败${NC}"
  echo ""
  echo "可能的原因:"
  echo "1. 未配置 WECHAT_MCH_ID 和 WECHAT_ENV_ID"
  echo "2. 未开启微信云托管开放接口服务"
  echo "3. 商户号未授权"
fi
echo ""
echo ""

echo -e "${YELLOW}4. 模拟微信支付回调（测试）${NC}"
CALLBACK_RESPONSE=$(curl -s -X POST ${BASE_URL}/payment/callback/${ORDER_NUMBER} \
  -H "Content-Type: application/json" \
  -d '{
    "returnCode": "SUCCESS",
    "resultCode": "SUCCESS",
    "openid": "test_openid",
    "transactionId": "4200001234567890",
    "outTradeNo": "'${ORDER_NUMBER}'",
    "totalFee": 1000,
    "timeEnd": "20230315120000"
  }')

echo "${CALLBACK_RESPONSE}" | jq '.'
echo ""

if echo "${CALLBACK_RESPONSE}" | jq -e '.errcode == 0' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 支付回调处理成功${NC}"
else
  echo -e "${RED}❌ 支付回调处理失败${NC}"
fi
echo ""
echo ""

echo -e "${YELLOW}5. 查询订单状态${NC}"
ORDER_STATUS=$(curl -s ${BASE_URL}/orders/${ORDER_NUMBER} \
  -H "X-Mock-Openid: ${TEST_OPENID}")

echo "${ORDER_STATUS}" | jq '.'
echo ""

PAYMENT_STATUS=$(echo "${ORDER_STATUS}" | jq -r '.data.paymentStatus')
RECHARGE_STATUS=$(echo "${ORDER_STATUS}" | jq -r '.data.rechargeStatus')

echo "订单状态:"
echo "  - 支付状态: ${PAYMENT_STATUS}"
echo "  - 充值状态: ${RECHARGE_STATUS}"
echo ""

if [ "${PAYMENT_STATUS}" = "paid" ]; then
  echo -e "${GREEN}✅ 订单已支付${NC}"
else
  echo -e "${YELLOW}⚠️  订单未支付${NC}"
fi

if [ "${RECHARGE_STATUS}" = "pending" ] || [ "${RECHARGE_STATUS}" = "success" ]; then
  echo -e "${GREEN}✅ 充值流程已触发${NC}"
fi

echo ""
echo "==================================="
echo "测试完成"
echo "==================================="
