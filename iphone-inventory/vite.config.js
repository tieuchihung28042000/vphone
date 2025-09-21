import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables from root .env
  const env = loadEnv(mode, '../', '');
  
  return {
    base: '/',
    plugins: [react()],
    server: {
      port: 5174,
      open: true,
      proxy: {
        '/api': env.VITE_API_URL || 'http://localhost:4000',
      },
    },
    build: {
      outDir: 'dist',
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || 'development'),
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:4000')
    }
  };
});
