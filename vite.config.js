import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  root: 'react-ui',
  plugins: [react()],
  build: {
    assetsDir: '.',
    emptyOutDir: true
  },
  experimental: {
    renderBuiltUrl(filename) {
      return './' + filename;
    }
  }
})
