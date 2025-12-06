import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env vars
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Định nghĩa process.env thành một object chứa API_KEY
      // Điều này giúp code 'process.env.API_KEY' hoạt động và không gây lỗi runtime
      'process.env': {
        API_KEY: env.API_KEY || ''
      }
    }
  };
});