import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: isHmrDisabled ? { overlay: false } : true,
      watch: {
        ignored: isHmrDisabled ? ['**/*'] : undefined,
      }
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 600,
      cssCodeSplit: true,
      cssMinify: true,
      minify: 'esbuild',
      reportCompressedSize: true,
      rollupOptions: {
        treeshake: {
          preset: 'recommended',
          propertyReadSideEffects: false,
        },
        output: {
          compact: true,
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // Heavy Sheet & CSV parsing (isolated and lazy loaded on-demand)
              if (id.includes('xlsx') || id.includes('papaparse')) {
                return 'vendor-sheets';
              }
              // Graphical SVG / Canvas Charts (isolated and lazy loaded)
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'vendor-charts';
              }
              // UI Animation Engine
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              // Query & State Caching
              if (id.includes('@tanstack')) {
                return 'vendor-query';
              }
              // Lucide Icons
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              // Lightweight UI Utilities
              if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('sonner')) {
                return 'vendor-ui';
              }
              return 'vendor-core';
            }
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
    esbuild: {
      legalComments: 'none',
      treeShaking: true,
    },
  };
});
