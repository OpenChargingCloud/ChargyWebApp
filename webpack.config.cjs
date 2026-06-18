const path                 = require('path');
const webpack              = require('webpack');
const HtmlWebpackPlugin    = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin    = require('copy-webpack-plugin');

const modeArgIndex = process.argv.indexOf('--mode');
const cliMode      = modeArgIndex >= 0 ? process.argv[modeArgIndex + 1] : undefined;
const mode         = process.env.NODE_ENV === 'production' ? 'production' : cliMode || 'development';

module.exports = {
  mode,
  entry:   './src/ts/chargyApp.ts',
  target:  'web',
  //devtool: "eval-source-map",  // Do not use in production!
  devtool: mode === 'production' ? false : 'source-map',
  ignoreWarnings: [
    warning =>
      warning.module?.resource?.includes(`${path.sep}node_modules${path.sep}file-type${path.sep}source${path.sep}index.js`) &&
      warning.message.includes('Critical dependency: the request of a dependency is an expression')
  ],
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      "fs":           false,
      "original-fs":  false,
      "path":         require.resolve("path-browserify"),
      "http":         require.resolve("stream-http"),
      "url":          require.resolve("url/"),
      "stream":       require.resolve("stream-browserify"),
      "vm":           require.resolve("vm-browserify"),
      "buffer":       require.resolve("buffer/"),
      "node:buffer":  require.resolve("buffer/")
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        include: path.resolve(__dirname, 'node_modules/@open-charging-cloud/chargy-core'),
        use: ['source-map-loader']
      },
      {
        test: /\.ts$/,
        include: path.resolve(__dirname, 'src/ts'),
        use: [{
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              // tsconfig.json sets "noEmit": true to keep direct 'tsc' runs
              // from littering src/ts with .js files — but ts-loader itself
              // must emit, so override it here.
              noEmit: false
            }
          }
        }]
      },
      {
        // Only .scss files are included, that are included in a .ts file
        // e.g. "import './chargy.scss'" within chargyApp.ts
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader'
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf|svg)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name][ext][query]' // Path and naming of your fonts
        }
      },
      {
        test: /\.(png|jpe?g|gif)$/i,
        type: 'asset/resource',
        generator: {
          // Keep original filename and extension
          filename: 'images/[name][ext]'
        }
      }
    ]
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
      template: 'src/index.html'
    }),
    new MiniCssExtractPlugin({
      filename: 'css/chargy.css',
      chunkFilename: '[id].css'
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from:    '*.css',
          to:       path.resolve(__dirname, 'build/css'),
          context: 'static/css'
        },
        {
          from:     path.resolve(__dirname, 'static/css/images'),
          to:       path.resolve(__dirname, 'build/css/images')
        },
        {
          from:     path.resolve(__dirname, 'static/images'),
          to:       path.resolve(__dirname, 'build/images')
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
      directory: path.join(__dirname, 'static'),
    },
    port:  1608,
    hot:   true,
    allowedHosts: ['.chargeit-mobility.com'],
    open:  true
  }
};
