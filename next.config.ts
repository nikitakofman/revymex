import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      "batiment.imag.fr",
      "images.unsplash.com",
      "www.the-rhumesque.com",
    ],
  },
  webpack: (config, { isServer }) => {
    // Exclude binary node modules from webpack processing
    config.module.noParse = [
      /sharp-linux-x64\.node$/,
      /onnxruntime_binding\.node$/,
      /\.node$/,
    ];

    return config;
  },
  // For background removal operations, use Edge runtime
  experimental: {
    serverComponentsExternalPackages: [
      "@imgly/background-removal-node",
      "onnxruntime-node",
    ],
  },
  // Ignore TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignore ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
