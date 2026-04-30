/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/', destination: '/landing.html' },
      { source: '/about', destination: '/about.html' },
      { source: '/privacy', destination: '/privacy-policy.html' },
      { source: '/terms', destination: '/terms-and-conditions.html' },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
}

module.exports = nextConfig
