#!/usr/bin/env bash
set -euo pipefail

# postdeploy-smoke-ops.sh
# Minimal post-deploy smoke checks for:
# - /ops routing
# - Ops v2 clients hub page
# - Ops v2 analytics API (+ page when authorized)
#
# Usage:
#   BASE_URL="https://<your-vercel-domain>" ./scripts/postdeploy-smoke-ops.sh
#
# Optional (to test authenticated flows):
#   OPS_COOKIE_HEADER='Cookie: authjs.session-token=...; other=...' \
#     BASE_URL="https://..." ./scripts/postdeploy-smoke-ops.sh
#
# Notes:
# - If OPS_COOKIE_HEADER is omitted, the script asserts redirects to /login for /ops routes.
# - If provided, it will also test HTML contains expected markers and analytics API returns JSON.

BASE_URL=${BASE_URL:-}
OPS_COOKIE_HEADER=${OPS_COOKIE_HEADER:-}

if [[ -z "${BASE_URL}" ]]; then
  echo "ERROR: BASE_URL is required (e.g., https://my-app.vercel.app)" >&2
  exit 2
fi

# Normalize: no trailing slash
BASE_URL=${BASE_URL%/}

say() { printf "\n==> %s\n" "$*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

have_cmd() { command -v "$1" >/dev/null 2>&1; }

if ! have_cmd curl; then
  fail "curl is required"
fi

_tmpdir=$(mktemp -d)
trap 'rm -rf "${_tmpdir}"' EXIT

curl_common=(
  --silent --show-error
  --connect-timeout 10
  --max-time 30
)

# Returns: status_code, and writes headers/body to files.
request() {
  local method=$1 url=$2 hdr_file=$3 body_file=$4
  shift 4

  local extra_headers=()
  if [[ -n "${OPS_COOKIE_HEADER}" ]]; then
    extra_headers+=( -H "${OPS_COOKIE_HEADER}" )
  fi

  local code
  code=$(curl "${curl_common[@]}" -X "${method}" "${url}" \
    -D "${hdr_file}" -o "${body_file}" \
    "${extra_headers[@]}" \
    "$@" \
    -w "%{http_code}")
  echo "${code}"
}

expect_status() {
  local got=$1 want=$2 context=$3
  [[ "${got}" == "${want}" ]] || fail "${context}: expected HTTP ${want}, got ${got}"
}

expect_header_includes() {
  local hdr_file=$1 needle=$2 context=$3
  grep -qi -- "${needle}" "${hdr_file}" || fail "${context}: expected header containing: ${needle}"
}

expect_body_includes() {
  local body_file=$1 needle=$2 context=$3
  grep -q -- "${needle}" "${body_file}" || fail "${context}: expected body to include: ${needle}"
}

say "Smoke: /ops routing"
{
  hdr="${_tmpdir}/ops.hdr"; body="${_tmpdir}/ops.body"
  code=$(request GET "${BASE_URL}/ops" "${hdr}" "${body}")

  if [[ -z "${OPS_COOKIE_HEADER}" ]]; then
    # Next.js redirects unauthenticated requests via middleware
    if [[ "${code}" != "307" && "${code}" != "302" ]]; then
      echo "--- headers ---"; cat "${hdr}"; echo "--- body ---"; head -n 40 "${body}" || true
      fail "/ops unauth: expected redirect (302/307), got ${code}"
    fi
    expect_header_includes "${hdr}" "location: /login" "/ops unauth"
  else
    expect_status "${code}" "200" "/ops auth"
    expect_body_includes "${body}" "Ops" "/ops auth"
  fi
}

say "Smoke: /ops/v2 routing (compat redirect)"
{
  hdr="${_tmpdir}/ops-v2.hdr"; body="${_tmpdir}/ops-v2.body"
  code=$(request GET "${BASE_URL}/ops/v2" "${hdr}" "${body}")

  if [[ -z "${OPS_COOKIE_HEADER}" ]]; then
    if [[ "${code}" != "307" && "${code}" != "302" ]]; then
      fail "/ops/v2 unauth: expected redirect (302/307), got ${code}"
    fi
    expect_header_includes "${hdr}" "location: /login" "/ops/v2 unauth"
  else
    # /ops/v2 is a compatibility entrypoint and should redirect to /ops.
    if [[ "${code}" != "307" && "${code}" != "302" ]]; then
      echo "--- headers ---"; cat "${hdr}"; echo "--- body ---"; head -n 40 "${body}" || true
      fail "/ops/v2 auth: expected redirect (302/307), got ${code}"
    fi
    expect_header_includes "${hdr}" "location: /ops" "/ops/v2 auth"
  fi
}

say "Smoke: Ops Clients hub page"
{
  hdr="${_tmpdir}/clients.hdr"; body="${_tmpdir}/clients.body"
  code=$(request GET "${BASE_URL}/ops/clients" "${hdr}" "${body}")

  if [[ -z "${OPS_COOKIE_HEADER}" ]]; then
    if [[ "${code}" != "307" && "${code}" != "302" ]]; then
      fail "/ops/clients unauth: expected redirect (302/307), got ${code}"
    fi
    expect_header_includes "${hdr}" "location: /login" "/ops/clients unauth"
  else
    expect_status "${code}" "200" "/ops/clients auth"
    expect_body_includes "${body}" "Ops — Clients" "/ops/clients auth"
    # Works even with empty DB (page shows 'No clients yet.')
    if grep -q "No clients yet" "${body}"; then
      echo "NOTE: No clients found (DB empty or seeded differently). Page rendering still OK."
    fi
  fi
}

say "Smoke: Ops v2 Analytics API"
{
  hdr="${_tmpdir}/analytics-api.hdr"; body="${_tmpdir}/analytics-api.body"
  # Keep query deterministic; server will default if omitted, but include anyway.
  code=$(request GET "${BASE_URL}/api/ops/v2/analytics?from=2026-01-01&to=2026-01-02" "${hdr}" "${body}")

  if [[ -z "${OPS_COOKIE_HEADER}" ]]; then
    # API returns JSON 401 with {ok:false}
    if [[ "${code}" != "401" && "${code}" != "403" ]]; then
      echo "--- headers ---"; cat "${hdr}"; echo "--- body ---"; cat "${body}" || true
      fail "/api/ops/v2/analytics unauth: expected 401/403, got ${code}"
    fi
    expect_body_includes "${body}" "\"ok\":false" "/api/ops/v2/analytics unauth"
  else
    if [[ "${code}" == "200" ]]; then
      expect_body_includes "${body}" "\"ok\":true" "/api/ops/v2/analytics auth"
      expect_body_includes "${body}" "\"minutesByDay\"" "/api/ops/v2/analytics auth"
      expect_body_includes "${body}" "\"totals\"" "/api/ops/v2/analytics auth"
    elif [[ "${code}" == "403" ]]; then
      echo "NOTE: Authenticated cookie lacks ADMIN/ACCOUNT_MANAGER role; API correctly returns 403."
      expect_body_includes "${body}" "\"ok\":false" "/api/ops/v2/analytics forbidden"
    else
      echo "--- headers ---"; cat "${hdr}"; echo "--- body ---"; cat "${body}" || true
      fail "/api/ops/v2/analytics auth: expected 200 or 403, got ${code}"
    fi
  fi
}

say "Optional: Ops Analytics page (HTML)"
{
  hdr="${_tmpdir}/analytics-page.hdr"; body="${_tmpdir}/analytics-page.body"
  code=$(request GET "${BASE_URL}/ops/analytics" "${hdr}" "${body}")

  if [[ -z "${OPS_COOKIE_HEADER}" ]]; then
    if [[ "${code}" != "307" && "${code}" != "302" ]]; then
      fail "/ops/analytics unauth: expected redirect (302/307), got ${code}"
    fi
    expect_header_includes "${hdr}" "location: /login" "/ops/analytics unauth"
  else
    expect_status "${code}" "200" "/ops/analytics auth"
    # Depending on role, page shows dashboard or Forbidden.
    if grep -q "Ops — Analytics" "${body}"; then
      echo "OK: Analytics page rendered dashboard shell."
    elif grep -q "Forbidden" "${body}"; then
      echo "NOTE: Analytics page correctly forbidden for this user role."
    else
      echo "--- body (head) ---"; head -n 60 "${body}" || true
      fail "/ops/analytics auth: expected 'Ops — Analytics' or 'Forbidden'"
    fi
  fi
}

say "DONE: ops routing + clients hub + analytics smoke tests passed."