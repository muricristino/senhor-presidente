import { defineConfig } from 'vite';
import { claudeDirector } from './tools/generator';

// Domínios do Cloudflare Tunnel liberados para jogar pelo celular.
const tunnelHosts = ['.trycloudflare.com'];

export default defineConfig({
  base: './',
  plugins: [claudeDirector()],
  server: { allowedHosts: tunnelHosts },
  preview: { port: 4173, allowedHosts: tunnelHosts },
});
