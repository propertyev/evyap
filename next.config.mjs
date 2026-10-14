/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer', 'exceljs', 'pdf-parse', 'xlsx', '@prisma/client', 'bcryptjs'],
  },
};
export default nextConfig;
