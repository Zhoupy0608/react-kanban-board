import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:5000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 监听 0.0.0.0，可用局域网 IP 访问
    // 允许 cpolar / 隧道域名访问（否则会出现 Blocked request）
    allowedHosts: true,
    proxy: apiProxy,
  },
  preview: {
    host: true,
    allowedHosts: true,
    proxy: apiProxy,
  },
})
