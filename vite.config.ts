import { defineConfig } from 'vite';
import { claudeDirector } from './tools/generator';

export default defineConfig({
  base: './',
  plugins: [claudeDirector()],
});
