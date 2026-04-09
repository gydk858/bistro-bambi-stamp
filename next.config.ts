import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/card/:user_id.png",
        destination: "/card/:user_id",
      },
    ];
  },
};

export default nextConfig;