import type { NextConfig } from "next";

const isProduction = process.env.IS_PRODUCTION === '1';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.12'],
  devIndicators: {
    appIsrStatus: !isProduction,
    buildActivity: !isProduction,
  },
};

export default nextConfig;
