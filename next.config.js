/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: false,
  },
  // 禁用 styled-jsx 以解决 single-transition 语法错误
  experimental: {
    styledJsx: false,
  },
}

module.exports = nextConfig
