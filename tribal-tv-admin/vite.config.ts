import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE_PATH is only needed when the site is served from a sub-path, such as
// GitHub Pages project sites (https://<user>.github.io/<repo>/). It defaults to '/',
// which is correct for Vercel, Cloudflare Pages, Netlify and your own server.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
    },
  }
})
