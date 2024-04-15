const path              = require('path');
const webpack           = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode:    'development',
  entry:   './src/ts/chargyApp.ts',
  target:  'web',
  devtool: "eval-source-map",  // Do not use in production!
  //devtool: "source-map",     // Secure, but very slow: Use in production!
  resolve: {
    extensions: [".ts", ".js"],
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
      include: path.resolve(__dirname, 'src/ts'),
      use: [{ loader: 'ts-loader' }]
    }]
  },
  externals: {
    'asn1':         'asn1.js',
    'base32decode': 'base32-decode'
  },
  output: {
    path:     path.resolve(__dirname, 'build'),
    filename: 'chargyWebApp-bundle.js'
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new HtmlWebpackPlugin({
      template: 'html/index.html'
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from:     '*.css',
          to:       path.resolve(__dirname, 'build/css'),
          context: 'html/css' // Optional, but helps to flatten the structure!
        },
        {
          from:     path.resolve(__dirname, 'html/images'),
          to:       path.resolve(__dirname, 'build/images')
        },
        {
          from:     path.resolve(__dirname, 'html/webfonts'),
          to:       path.resolve(__dirname, 'build/webfonts')
        },
        {
          from:     path.resolve(__dirname, 'html/i18n.json'),
          to:       path.resolve(__dirname, 'build/i18n.json')
        },
        {
          from:     path.resolve(__dirname, 'package.json'),
          to:       path.resolve(__dirname, 'build/package.json')
        }
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'html'),
    },
    port:  1608,
    hot:   true,
    open:  true
  }
};
