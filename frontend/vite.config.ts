import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { localDiskStoragePlugin } from './vite-plugins/localDiskStorage';

export default defineConfig({
  plugins: [
    vue(),
    localDiskStoragePlugin() // 🚀 原生自包含物理硬盘存储，npm run dev 直接全部拉起，零额外黑窗口！
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/bridge': {
        target: 'http://localhost:5201',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:5200',
        changeOrigin: true
      }
    }
  }
});
