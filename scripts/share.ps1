# 国内公网分享（cpolar）
# 1) npm start 保持 5000 运行
# 2) 首次已配置 authtoken 后直接：npm run share

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$port = if ($env:PORT) { $env:PORT } else { "5000" }

$candidates = @(
  "D:\cpolar\cpolar.exe",
  (Join-Path $projectRoot "tools\cpolar\cpolar.exe")
)
$cpolar = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $cpolar) {
  Write-Host "未找到 cpolar.exe。请确认 D:\cpolar\cpolar.exe 存在。" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "使用: $cpolar" -ForegroundColor DarkGray
Write-Host "正在通过 cpolar 暴露本机 http://127.0.0.1:$port ..." -ForegroundColor Cyan
Write-Host "保持此窗口运行；关闭后公网链接会失效。" -ForegroundColor Yellow
Write-Host ""

# cpolar 不支持 socks5h 代理环境变量，分享时临时清空，避免启动失败
foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy')) {
  Remove-Item "Env:$name" -ErrorAction SilentlyContinue
}

& $cpolar http $port -log=stdout
