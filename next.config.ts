import type { NextConfig } from "next";

const isProduction = process.env.IS_PRODUCTION === '1';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.12'],
  devIndicators: isProduction ? false : undefined,
};

export default nextConfig;
