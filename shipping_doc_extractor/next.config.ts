import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
    "/**/*": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
  },
  serverExternalPackages: ["sql.js", "pdf-parse"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
