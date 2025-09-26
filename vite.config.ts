import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Optional plugins - only import if available
let vitePluginCartographer: any = null;
let vitePluginRuntimeErrorModal: any = null;

try {
  const cartographer = await import("@replit/vite-plugin-cartographer");
  vitePluginCartographer = cartographer.vitePluginCartographer;
} catch (e) {
  console.log("Cartographer plugin not available");
}

try {
  const errorModal = await import("@replit/vite-plugin-runtime-error-modal");
  vitePluginRuntimeErrorModal = errorModal.vitePluginRuntimeErrorModal;
} catch (e) {
  console.log("Runtime error modal plugin not available");
}

export default defineConfig({
  plugins: [
    react(),
    vitePluginCartographer ? vitePluginCartographer() : null,
    vitePluginRuntimeErrorModal ? vitePluginRuntimeErrorModal() : null,
  ].filter(Boolean), // Filter out null values if plugins are not loaded
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      external: [
        'fsevents',
        'chokidar',
        'esbuild',
        'rollup'
      ],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['fsevents']
  }
});