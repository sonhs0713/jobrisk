const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  devIndicators: false,
  async redirects() {
    return [
      {
        source: '/rebuild',
        destination: '/',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
