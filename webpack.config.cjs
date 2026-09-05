const path                 = require('path');
const webpack              = require('webpack');
const HtmlWebpackPlugin    = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin    = require('copy-webpack-plugin');
const MinimizerPlugin      = require('minimizer-webpack-plugin');
const packageLock          = require('./package-lock.json');

const modeArgIndex = process.argv.indexOf('--mode');
const cliMode      = modeArgIndex >= 0 ? process.argv[modeArgIndex + 1] : undefined;
const mode         = process.env.NODE_ENV === 'production' ? 'production' : cliMode || 'development';

/**
 * The compile-time switches of a build.
 *
 * A live link document comes from outside and may name any URL at all, so the
 * application refuses plaintext transports (http://, ws://) and hosts on the
 * local network. A test bench needs those refusals lifted - but that decision
 * belongs to whoever builds the application, never to the document, and never
 * to a runtime setting a user could be talked into flipping.
 *
 * There are three kinds of build, and only one of them is relaxed: an ordinary
 * development build is exactly as strict as a production one - the rules follow
 * the switch, not the mode. What production adds is that it refuses to take the
 * switch at all: what is shipped can never speak plaintext, whatever asks.
 *
 * A development build takes it in any of these forms:
 *
 *     npm run start:testbench
 *     npm run bundle  -- --env insecureTransports --env privateNetworkTransports
 *     CHARGY_ALLOW_INSECURE_TRANSPORTS=1 npm run bundle
 */
// A switch can be asked for by an environment variable or, because exporting
// one into the right shell is its own source of mistakes, on the command line:
//
//     npm run start:testbench
//     npm run bundle -- --env insecureTransports
//
// webpack hands --env values only to a config that is a function; this one is
// an object, so they are read off the command line the same way --mode already
// is above.
const envArguments = process.argv.filter((argument, index) => process.argv[index - 1] === '--env');

const insecureTransportsRequested       = process.env.CHARGY_ALLOW_INSECURE_TRANSPORTS        === '1' ||
                                          envArguments.includes('insecureTransports');
const privateNetworkTransportsRequested = process.env.CHARGY_ALLOW_PRIVATE_NETWORK_TRANSPORTS === '1' ||
                                          envArguments.includes('privateNetworkTransports');

const allowInsecureTransports           = mode !== 'production' && insecureTransportsRequested;
const allowPrivateNetworkTransports     = mode !== 'production' && privateNetworkTransportsRequested;

for (const [ name, requested, allowed ] of [
  [ 'insecureTransports',       insecureTransportsRequested,       allowInsecureTransports       ],
  [ 'privateNetworkTransports', privateNetworkTransportsRequested, allowPrivateNetworkTransports ]
]) {
  if (allowed)
    console.warn(`\n  !!  ${name}: this build weakens a transport rule. Do not deploy it.  !!\n`);
  else if (requested)
    console.warn(`\n  !!  ${name} ignored: a production build never allows this.  !!\n`);
}

/**
 * The schemes the page may connect to at all, enforced by the BROWSER through
 * the Content-Security-Policy of index.html - a second gate, in front of every
 * rule the application applies itself.
 *
 * It has to follow the switch: a build that allows plaintext transports but
 * whose CSP still pins https would let the application decide to poll and the
 * browser refuse it, which looks exactly like a bug and is diagnosable only in
 * the console. The host decision stays with the application; only the scheme
 * list moves with the build.
 */
const liveLinkConnectSrc = [ "'self'", 'https:', 'wss:' ].
                             concat(allowInsecureTransports ? [ 'http:', 'ws:' ] : []).
                             join(' ');

const chargyCorePackageName  = '@open-charging-cloud/chargy-core';
const chargyCorePackage      = packageLock.packages?.[`node_modules/${chargyCorePackageName}`];
const chargyCoreIntegrity    = chargyCorePackage?.integrity ?? '';
const chargyCoreSHA512       = chargyCoreIntegrity.startsWith('sha512-')
  ? Buffer.from(chargyCoreIntegrity.substring('sha512-'.length), 'base64').toString('hex')
  : '';

/**
 * pdfjs-dist 6.2.108 uses private fields inside dynamic WASM imports. Terser
 * 5.50.0 renames their declarations inconsistently and produces
 * "Private field '#wasmUrl' must be declared in an enclosing class".
 * Keep only the PDF worker unminified until its minified production chunk
 * passes `node --check`; named chunk IDs keep this matcher stable in production.
 */
const pdfWorkerAssetPattern = /pdf[_-]worker/i;

const sourceMapModuleName = info => {
  let resourcePath = (info.resourcePath || info.absoluteResourcePath || '').replace(/\\/g, '/');

  resourcePath = resourcePath
    .replace(/^ignored\|.*\/node_modules\//, 'ignored|node_modules/')
    .replace(/^.*\/node_modules\//, 'node_modules/')
    .replace(/^\.\//, '');

  return `webpack://chargytransparenzsoftware/${resourcePath}`;
};

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
  optimization: {
    chunkIds: 'named',
    minimizer: [
      new MinimizerPlugin({
        exclude: pdfWorkerAssetPattern
      })
    ]
  },
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
  output: {
    path:                          path.resolve(__dirname, 'build'),
    filename:                      'chargyWebApp-bundle.js',
    // Remove stale numeric worker chunks created before chunkIds became stable.
    clean:                         true,
    devtoolModuleFilenameTemplate: sourceMapModuleName
  },
  plugins: [
    new webpack.DefinePlugin({
      __CHARGY_CORE_SHA512__:                      JSON.stringify(chargyCoreSHA512),
      __CHARGY_ALLOW_INSECURE_TRANSPORTS__:        JSON.stringify(allowInsecureTransports),
      __CHARGY_ALLOW_PRIVATE_NETWORK_TRANSPORTS__: JSON.stringify(allowPrivateNetworkTransports)
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new HtmlWebpackPlugin({
      template:    'src/index.html',
      connectSrc:  liveLinkConnectSrc
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
          from:     path.resolve(__dirname, 'static/externalURLs.conf'),
          to:       path.resolve(__dirname, 'build/externalURLs.conf')
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
