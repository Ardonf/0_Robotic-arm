import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  // 部署到后端 wwwroot 时使用相对路径，确保资源在任何子目录下都能正确加载
  base: './',
})
