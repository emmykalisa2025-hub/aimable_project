import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createServer } from "./server";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      // Allow access to client, shared and project root so index.html can be served
      allow: [path.resolve(__dirname, "./client"), path.resolve(__dirname, "./shared"), path.resolve(__dirname, "./")],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      const app = createServer();

      // Add Express app as middleware to Vite dev server
      server.middlewares.use(app);

      // Return a function to be called after internal middlewares are set up
      return () => {
        // Add SPA fallback middleware - must be last to catch all unhandled routes
        server.middlewares.use((req: any, res: any, next: any) => {
          // Skip API routes, static assets, Vite internals, and already-processed requests
          if (
            req.path.startsWith("/api") ||
            req.path.startsWith("/@") ||
            req.path.startsWith("/node_modules") ||
            path.extname(req.path)
          ) {
            return next();
          }

          // For client-side routes, rewrite to index.html
          // Vite will process this normally with HMR
          req.url = "/index.html";
          next();
        });
      };
    },
  };
}
