module.exports = {
  // ... other config
  resolve: {
    fallback: {
      https: require.resolve('https-browserify'),
      stream: require.resolve('stream-browserify'),
      // Include other fallbacks for completeness
      http: require.resolve('stream-http'),
      util: require.resolve('util/'),
      zlib: require.resolve('browserify-zlib'),
      url: require.resolve('url/'),
      crypto: require.resolve('crypto-browserify'),
      assert: require.resolve('assert/')
    }
  }
};