import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true, // 確保監聽所有網絡介面
    allowedHosts: true, // 允許 ngrok / localtunnel 等外網域名訪問
    proxy: {
      // 當前端請求 /api 開頭的網址時，自動轉發給後端 3000 埠
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // 如果後端路由原本就包含 /api（例如 app.use('/api', orderRoutes)），下面這行保持註解即可
        // 如果後端路由沒有 /api 前綴，請取消下面這行的註解：
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})