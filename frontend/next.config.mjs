import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/v1/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
