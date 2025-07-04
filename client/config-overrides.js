const { override, addWebpackResolve } = require('customize-cra');

module.exports = override(
  addWebpackResolve({
    fallback: {
      https: require.resolve('https-browserify'),
      stream: require.resolve('stream-browserify'),
      // Add other fallbacks from previous errors if needed
      http: require.resolve('stream-http'),
      util: require.resolve('util/'),
      zlib: require.resolve('browserify-zlib'),
      url: require.resolve('url/'),
      crypto: require.resolve('crypto-browserify'),
      assert: require.resolve('assert/')
    }
  })
);