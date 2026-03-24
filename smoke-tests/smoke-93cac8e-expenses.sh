#!/usr/bin/env bash
set -euo pipefail

# Optional curl-based smoke test for Expenses API (staging)
#
# Requirements:
#   OPSHUB_BASE_URL=https://<staging-host>
#   OPSHUB_COOKIE='__Secure-authjs.session-token=...; other=...'
#   CLIENT_ID='<cuid>'
#
# Notes:
# - This hits authenticated endpoints. Grab OPSHUB_COOKIE from browser DevTools.
# - Receipt uploads are not covered here (they’re easiest to test via UI).

: "${OPSHUB_BASE_URL:?Set OPSHUB_BASE_URL}"
: "${OPSHUB_COOKIE:?Set OPSHUB_COOKIE (copy from browser request headers)}"
: "${CLIENT_ID:?Set CLIENT_ID}"

hdr=(-H "cookie: ${OPSHUB_COOKIE}" -H "content-type: application/json")

echo "Creating expense..."
create_json=$(cat <<JSON
{
  "kind": "MANUAL",
  "clientId": "${CLIENT_ID}",
  "expenseDate": "$(date -u +%F)",
  "vendor": "SmokeTest",
  "description": "API smoke test expense",
  "amount": "1.23",
  "currency": "CAD",
  "notes": "created by smoke-93cac8e-expenses.sh",
  "receiptUrl": "https://example.com/receipt-placeholder"
}
JSON
)

created=$(curl -fsS "${OPSHUB_BASE_URL}/api/ops/v2/expenses" -X POST "${hdr[@]}" --data "$create_json")
echo "$created" | jq . >/dev/null
id=$(echo "$created" | jq -r '.item.id')

echo "Created id: $id"

echo "Listing expenses for client..."
list=$(curl -fsS "${OPSHUB_BASE_URL}/api/ops/v2/expenses?clientId=${CLIENT_ID}&limit=50" -X GET "${hdr[@]}")
echo "$list" | jq . >/dev/null

echo "Deleting expense..."
rmres=$(curl -fsS "${OPSHUB_BASE_URL}/api/ops/v2/expenses/${id}" -X DELETE -H "cookie: ${OPSHUB_COOKIE}")
echo "$rmres" | jq . >/dev/null

echo "Confirm deleted (expect 404)..."
set +e
curl -sS -o /dev/null -w "%{http_code}" "${OPSHUB_BASE_URL}/api/ops/v2/expenses/${id}" -X GET -H "cookie: ${OPSHUB_COOKIE}" | grep -q "404"
set -e

echo "OK"
