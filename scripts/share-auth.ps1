# 保存 cpolar authtoken（只做一次）
# 用法：npm run share:auth -- 你的token

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$cpolar = Join-Path $projectRoot "tools\cpolar\cpolar.exe"
$token = $args[0]

if (-not $token) {
  Write-Host "用法: npm run share:auth -- <authtoken>" -ForegroundColor Yellow
  Write-Host "authtoken 在 https://www.cpolar.com 登录后「验证」页面获取。" -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path $cpolar)) {
  Write-Host "未找到 cpolar.exe" -ForegroundColor Red
  exit 1
}

& $cpolar authtoken $token
Write-Host "authtoken 已保存。接下来执行: npm run share" -ForegroundColor Green
