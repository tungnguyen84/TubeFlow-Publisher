import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env vars
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Stringify API Key để thay thế trực tiếp trong code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Định nghĩa process.env rỗng để tránh lỗi "process is not defined" nếu có thư viện bên thứ 3 truy cập
      'process.env': {}
    }
  };
});