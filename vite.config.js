import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 🚀 ADDED TAILWIND IMPORT

export default defineConfig({
  plugins: [
    react(),
    tailwindcss() // 🚀 ADDED TO PLUGINS ARRAY
  ],
  build: {
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return id.toString().split('node_modules/')[1].split('/')[0].toString();
          }
        }
      }
    }
  }
})