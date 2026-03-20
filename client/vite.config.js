import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    // Gzip for text assets (JS, CSS, SVG)
    compression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
    // Brotli for even smaller sizes where supported
    compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
  ],

  server: {
    host: '0.0.0.0',
  },

  build: {
    // Use modern ES target for smaller output
    target: 'es2020',

    // Raise warning threshold (audio files are large)
    chunkSizeWarningLimit: 3000,

    // Enable CSS minification
    cssMinify: true,

    // Content-hash filenames → long-lived CDN/browser cache
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Separate vendor chunks so they are cached independently
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor-react';
          if (id.includes('node_modules/socket.io-client')) return 'vendor-socket';
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/qrcode.react') || id.includes('node_modules/react-confetti')) return 'vendor-ui';
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (info) => {
          // Keep audio in its own subfolder
          if (/\.(mp3|ogg|wav)$/.test(info.name ?? '')) return 'assets/audio/[name]-[hash][extname]';
          if (/\.(png|jpe?g|webp|svg|gif)$/.test(info.name ?? '')) return 'assets/img/[name]-[hash][extname]';
          if (/\.css$/.test(info.name ?? '')) return 'assets/css/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
