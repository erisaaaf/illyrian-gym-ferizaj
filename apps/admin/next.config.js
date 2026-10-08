/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@illyrian/config", "@illyrian/types"],
};

module.exports = nextConfig;
