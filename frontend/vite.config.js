import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // sockjs-client'ın beklediği "global" değişkenini window olarak tanımlıyoruz
    global: 'window',
  },
})