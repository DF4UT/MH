/**
 * Next.js 配置
 * - reactStrictMode：开发期严格模式，提前暴露潜在问题
 * - serverComponentsExternalPackages：数据库驱动包含网络/原生能力，
 *   标记为外部包以兼容服务端组件与 Vercel 部署
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client', 'postgres'],
  },
};

export default nextConfig;
