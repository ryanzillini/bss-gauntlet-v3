/** @type {import('next').NextConfig} */
const withTM = require('next-transpile-modules')(['pg', 'mssql']);

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['react-syntax-highlighter'],
  serverRuntimeConfig: {
    // Will only be available on the server side
    projectRoot: process.cwd(),
  },
  webpack: (config, { isServer }) => {
    // If client-side, don't polyfill fs, net, etc.
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        dns: false,
        pg: false,
        mssql: false,
        path: false,
        crypto: false,
        os: false,
        stream: false,
        buffer: false,
        util: false,
      };
    }

    return config;
  },
}

module.exports = withTM(nextConfig); 