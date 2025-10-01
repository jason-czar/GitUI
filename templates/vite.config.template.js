import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,           // accepts 0.0.0.0
    port: Number(process.env.PORT) || 3000,
    strictPort: true      // fail if port 3000 is taken (so mapping stays consistent)
  }
});
