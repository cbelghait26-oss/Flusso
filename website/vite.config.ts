import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// If deploying to https://username.github.io/repo-name/, set base to '/repo-name/'
// If using a custom domain (CNAME), set base to '/'
export default defineConfig({
  plugins: [react()],
  base: '/',
});
