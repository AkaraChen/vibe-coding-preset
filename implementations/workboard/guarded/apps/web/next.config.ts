import type { NextConfig } from "next";

const apiOrigin = process.env.API_ORIGIN ?? "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@workboard/shared"],
  rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
