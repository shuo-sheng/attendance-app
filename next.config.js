/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

}

module.exports = nextConfig
