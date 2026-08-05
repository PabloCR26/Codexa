import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // El puerto debe coincidir con WEB_URL del .env de la API: el CORS del
    // backend compara el origen exacto. strictPort evita que Vite salte a otro
    // puerto en silencio y que todas las peticiones fallen por CORS.
    port: 5173,
    strictPort: true,
    // En desarrollo el proxy evita el CORS por completo: el navegador ve un
    // solo origen y la cookie de sesión viaja sin configuración extra.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
