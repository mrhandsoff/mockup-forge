/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.mockuuups.studio' },
      { protocol: 'https', hostname: '**.mockup.delivery' },
      { protocol: 'https', hostname: '**.fal.media' },
    ],
  },
};

module.exports = nextConfig;
