const webpack = require('webpack');

// webpack.config.js
module.exports = [
    {
      mode:    'development',
      entry:   './src/ts/chargyApp.ts',
      //target:  'electron-renderer',
      target:  'web',
      devtool: "eval-source-map",  // Do not use in production!
      //devtool: "source-map",     // Secure, but very slow: Use in production!
      resolve: {
        extensions: ["", ".ts", ".js"],
        fallback: {
          "fs":           false,
          "original-fs":  false,
          "path":         require.resolve("path-browserify"),
          "http":         require.resolve("stream-http"),
          "crypto":       require.resolve("crypto-browserify"),
          "url":          require.resolve("url/"),
          "stream":       require.resolve("stream-browserify"),
          "vm":           require.resolve("vm-browserify"),
          "buffer":       require.resolve("buffer/"),
          "node:buffer":  require.resolve("buffer/")
        }
      },
      module: {
        rules: [{
          test: /\.ts$/,
          //include: /src/,
          use: [{ loader: 'ts-loader' }]
        }]
      },
      externals: {
        'asn1':         'asn1.js',
        'base32decode': 'base32-decode'
      },
      output: {
        path: __dirname + '/src/build',
        filename: 'chargyWebApp-bundle.js'
      },
      plugins: [
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
      ]
    }
  ];
