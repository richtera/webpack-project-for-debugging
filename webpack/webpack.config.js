const Path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const Webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const ts = require('typescript');
const fs = require('fs');
const babel = require('babel-core');
const iconv  = require('iconv-lite');
const portScanner = require('portscanner');
const serveIndex = require("serve-index");
const express = require('express');
const WebSocket = require('ws');
const loaderUtils = require("loader-utils");
const Watchpack = require("watchpack");
const child_process = require("child_process");
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const wp = new Watchpack({
  // options:
  aggregateTimeout: 1000,
  // fire "aggregated" event when after a change for 1000ms no additonal change occured
  // aggregated defaults to undefined, which doesn't fire an "aggregated" event

  poll: true,
  // poll: true - use polling with the default interval
  // poll: 10000 - use polling with an interval of 10s
  // poll defaults to undefined, which prefer native watching methods
  // Note: enable polling when watching on a network path

  ignored: /node_modules/,
  // anymatch-compatible definition of files/paths to be ignored
  // see https://github.com/paulmillr/chokidar#path-filtering
});

let configPath = process.env.FIREBASE_CONFIG_FILE || null;
if (!configPath) {
  configPath = process.env.NODE_ENV === 'production' ? './prod.firebase.json' : './dev.firebase.json';
  configPath = Path.resolve(Path.join(__dirname, configPath));
} else if (!Path.isAbsolute(configPath)) {
  configPath = Path.resolve(configPath);
}
let fbConfig = {};
if (process.env.FIREBASE_API_KEY) {
  fbConfig = {
    apiKey: process.env.FIREBASE_API_KEY || null,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || null,
    databaseURL: process.env.FIREBASE_DATABASE_URL || null,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || null,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || null
  };
} else {
  const exists = fs.existsSync(configPath);
  console.log(`Loading config from ${exists ? "existing" : "missing"} ${configPath}...`);
  if (!fs.existsSync('./dist')) {
    fs.mkdirSync('./dist');
  }
  fbConfig = exists ? require(configPath) : {};
}

let commit = "t" + new Date().getTime();
let branch = 'detached';
const headFile = Path.join(".git", "HEAD");
if (process.env.BRANCH && process.env.COMMIT) {
  commit = process.env.COMMIT;
  branch = process.env.BRANCH;
} else if (fs.existsSync(headFile)) {
  console.log("Checking commit ID from " + headFile);
  try {
      const head = fs.readFileSync(headFile).toString().trim();
      const items = head.split(":");
      if (items.length > 1) {
          if (items[0] == 'ref') {
              branch = items[1].trim().split('/').slice(-1);
              commit = fs.readFileSync(Path.join(".git", items[1].trim())).toString().trim().substr(0, 7);
          }
      } else {
          commit = items[0].substr(0, 12);
      }
  }
  catch (e) {
    console.log(e);
  }
}

let version = '5.0-' + commit;
if (process.env.VERSION_STAMP) {
  version = process.env.VERSION_STAMP;
}
console.log("Version is " + version);

fs.writeFileSync('./VERSION.txt', version.replace(' ', '-'));
const data = JSON.parse(fs.readFileSync('./VERSION.json'));

const STRIP_FILENAME_RE = /^[^:]+: /;

const formatMessage = function(name, message, codeFrame) {
  return (name ? name + ': ' : '') + message + '\n\n' + codeFrame + '\n';
};

module.exports = (options) => {
  const extractGlobalCSS = new ExtractTextPlugin({
    filename: !options.isProduction ? 'assets/styles/app.global.[name].css' : 'assets/styles/app.global.[name].[hash].css',
    allChunks: true
  });
  const extractLocalCSS = new ExtractTextPlugin({
    filename: !options.isProduction ? 'assets/styles/app.local.[name].css' : 'assets/styles/app.local.[name].[hash].css',
    allChunks: true
  });

  return new Promise((resolve, reject) => {
    if (options.port) {
      portScanner.findAPortNotInUse(options.port, options.port + 30, {
        host: options.host || 'localhost',
        timeout: 1000
      }, (err, port) => {
        if (err) {
          console.error(err);
          return reject(err);
        }
        resolve(port);
      });
    } else {
      resolve(options.port);
    }
  }).then(port => {
    if (port) {
      if (process.env.WWW_PORT) {
        return {port, proxyPort: Number(process.env.WWW_PORT)};
      } else {
        return new Promise((resolve, reject) => {
          portScanner.findAPortNotInUse(9000, 9050, {
            host: 'localhost',
            timeout: 1000
          }, (err, proxyPort) => {
            if (err) {
              console.error(err);
              return reject(err);
            }
            resolve({port, proxyPort});
          });
        });
      }
    } else {
      return {port, proxyPort: null};
    }
  }).then(({port, proxyPort}) => {
    options.port = port;

    const info = require(Path.resolve(__dirname, '../src/info.json'));
    const infoPlugins = [];
    const infoRewrites = Object.keys(info).sort((a, b) => {
      const aa = info[a].path;
      const bb = info[b].path;
      if (aa !== '/' && bb === '/') {
        return -1;
      } else if (aa === '/' && bb !== '/') {
        return 1;
      }
      return 0;
    }).map(key => {
      const item = info[key];
      return { from: new RegExp(`^${item.path}/.*$`), to: `${item.path}/index.html` };
    });
    const infoEntry = Object.keys(info).reduce((out, key) => {
      const item = info[key];
      out[key] = Path.resolve(__dirname, '../src', item.root);
      return out;
    }, {});
    const context = Path.resolve(__dirname, '../src');
    let siteConfig = {};
    try {
      siteConfig = JSON.parse(process.env.SITE_CONFIG || '{}');
    }
    catch (e) {
      console.error("Unable to parse site config");
    }
    siteConfig = Object.assign({
      domain: (process.env.DOMAIN || '').split(',')[0] || 'study.selfstudy.plus',
      domain_plus: (process.env.DOMAIN_PLUS || '').split(',')[0] || 'study.selfstudy.plus',
      domain_qbank: (process.env.DOMAIN_QBANK || '').split(',')[0] || 'qbank.selfstudy.plus',
      domain_admin: (process.env.DOMAIN_ADMIN || '').split(',')[0] || 'admin.selfstudy.plus',
      support_email: (process.env.EMAIL_FROM || '')
    }, siteConfig);
    if (!options.isProduction) {
      delete siteConfig.persistence;
      siteConfig.showCorrect = true;
      siteConfig.debug = true;
    }
    Object.keys(info).forEach(key => {
      const item = info[key];
      infoPlugins.push(new HtmlWebpackPlugin({
        context: context,
        window: {
          fb: JSON.stringify(fbConfig),
          groups: JSON.stringify((process.env.SUPPORTED_GROUPS || 'oa').split(',')),
          version: version,
          sc: JSON.stringify(siteConfig),
          head: (options.isProduction || ((process.env.NODE_ENV || 'development') !== 'development')) ? `(
!function(a,b,c,d,e,f,g,h){a.RaygunObject=e,a[e]=a[e]||function(){
(a[e].o=a[e].o||[]).push(arguments)},f=b.createElement(c),g=b.getElementsByTagName(c)[0],
f.async=1,f.src=d,g.parentNode.insertBefore(f,g),h=a.onerror,a.onerror=function(b,c,d,f,g){
h&&h(b,c,d,f,g),g||(g=new Error(b)),a[e].q=a[e].q||[],a[e].q.push({
e:g})}}(window,document,"script","//cdn.raygun.io/raygun4js/raygun.min.js","rg4js")
);` : ''
        },
        inject: true,
        modulesDirectories: ["../node_modules"],
        template: Path.resolve(__dirname, '../src/', item.index),
        filename: item.path === '/' ? 'index.html' : `${item.path.replace(/^\//, '')}/index.html`,
        chunks: [key, 'commons']
      }));
    });
    const sassIncludePaths = [
      Path.resolve(__dirname, "../src/shared/styles"),
      Path.resolve(__dirname, "../src/shared"),
      Path.resolve(__dirname, "../node_modules/bootstrap-sass/assets/stylesheets"),
      "node_modules"
    ];
    const webpackConfig = {
      name: 'app',
      devtool: options.devtool,
      entry: infoEntry,
      output: !options.isProduction ? {
        path: Path.resolve(__dirname, '../dist/'),
        filename: 'assets/js/app.[name].js',
        publicPath: '/'
      } : {
        path: Path.resolve(__dirname, '../dist/'),
        filename: 'assets/js/app.[name].[hash].js',
        sourceMapFilename: '[file].map',
        publicPath: '/'
      },
      resolve: {
        extensions: ['.js', '.jsx', '.scss', '.css', '.ts', '.tsx'],
        modules: sassIncludePaths
      },
      plugins: infoPlugins.concat([
        new Webpack.optimize.CommonsChunkPlugin({
          name: 'commons',
          filename: !options.isProduction ? 'assets/js/commons.js' : 'assets/js/commons.[hash].js',
          minChunks: 2
        }),
        new Webpack.BannerPlugin('Version ' + version),
        new Webpack.DefinePlugin({
          'process.env.TRAVIS_BRANCH': JSON.stringify(process.env.BRANCH || 'dev'),
          'process.env.RELEASE_ENV': JSON.stringify(version),
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
          'process.env.DEBUG_NAME': JSON.stringify(options.debugName || null),
          'process.env.DB_LOG': process.env.DB_LOG ? "true" : "false",
          'process.env.RAYGUN_API_KEY': JSON.stringify(process.env.RAYGUN_API_KEY)
        }),
        new CopyWebpackPlugin([{
          context: 'src/learn/components/dynamic',
          from: '**/*',
          to: 'assets/js/defaults'
        }, {
          from: 'src/info.json',
          to: 'info.json'
        }, {
          from: 'node_modules/font-awesome/fonts',
          to: 'assets/font-awesome'
        }, {
          from: 'node_modules/roboto-fontface/fonts',
          to: 'assets/roboto-fontface'
        }, {
          from: 'node_modules/bootstrap-sass/assets/fonts/bootstrap',
          to: 'assets/bootstrap/fonts'
        }, {
          context: 'node_modules/jquery/dist',
          from: 'jquery*.js',
          to: 'assets/js/'
        }, {
          context: 'node_modules/tinymce',
          from: 'tinymce*.js',
          to: 'assets/js/'
        }, {
          context: 'node_modules/tinymce/plugins',
          from: '**/*',
          to: 'assets/js/plugins'
        }, {
          context: 'node_modules/tinymce/skins',
          from: '**/*',
          to: 'assets/js/skins'
        }, {
          context: 'node_modules/tinymce/themes',
          from: '**/*',
          to: 'assets/js/themes'
        }, {
          from: 'src/assets',
          to: 'assets/'
        }])
      ]),
      module: {
        loaders: [
          {test: /\.json$/, loader: 'json-loader',},
          {
            test: /(^~|node_modules|shared[\/\\]styles|src[\/\\]react-draft-wysiwyg).*\.s?css$/,
            loaders: extractGlobalCSS.extract({
              fallback: 'style-loader',
              use: [
                {
                  loader: 'css-loader',
                  query: {
                    minimize: options.isProduction,
                    modules: false, // enables CSS Modules spec
                    localIdentName: '[path]-[name]-[local]-[hash:base64:5]',
                    getLocalIdent(loaderContext, localIdentName, localName, options) {
                    	if(!options.context)
                    		options.context = loaderContext.options && typeof loaderContext.options.context === "string" ? loaderContext.options.context : loaderContext.context;
                      const request = Path.relative(options.context, loaderContext.resourcePath);
                    	if (/node_modules|shared[\\\/]styles/.test(request)) {
                    	  return localName;
                    	}
                    	options.content = options.hashPrefix + request + "+" + localName;
                    	localIdentName = localIdentName.replace(/\[local\]/gi, localName);
                      const hash = loaderUtils.interpolateName(loaderContext, localIdentName, options);
                    	return hash.replace(new RegExp("[^a-zA-Z0-9\\-_\u00A0-\uFFFF]", "g"), "-").replace(/^((-?[0-9])|--)/, "_$1");
                    },
                    context: context,
                    import: true,
                    sourceMap: !options.isProduction,
                    importLoaders: 2, // will import previous amount of loaders
                  },
                },
                // {
                //   loader: 'postcss-loader',
                //   query: {
                //     sourceMap: !options.isProduction,
                //     sourceMapContents: !options.isProduction,
                //   }
                // },
                {
                  loader: 'sass-loader',
                  query: {
                    sourceMap: !options.isProduction,
                    sourceMapContents: !options.isProduction,
                    includePaths: sassIncludePaths,
                    outputStyle: options.isProduction ? "compressed" : "nested"
                  },
                },
              ]
            })
          },
          {
            test: /\.s?css$/,
            exclude: [/node_modules/, /shared[\/\\]styles/, /src[\/\\]react-draft-wysiwyg/],
            loaders: extractLocalCSS.extract({
              fallback: 'style-loader',
              use: [
                {
                  loader: 'css-loader',
                  query: {
                    minimize: options.isProduction,
                    modules: true, // enables CSS Modules spec
                    localIdentName: '[path]-[name]-[local]-[hash:base64:5]',
                    getLocalIdent(loaderContext, localIdentName, localName, options) {
                    	if(!options.context)
                    		options.context = loaderContext.options && typeof loaderContext.options.context === "string" ? loaderContext.options.context : loaderContext.context;
                      const request = Path.relative(options.context, loaderContext.resourcePath);
                    	if (/node_modules|shared[\\\/]styles/.test(request)) {
                    	  return localName;
                    	}
                    	options.content = options.hashPrefix + request + "+" + localName;
                    	localIdentName = localIdentName.replace(/\[local\]/gi, localName);
                      const hash = loaderUtils.interpolateName(loaderContext, localIdentName, options);
                    	return hash.replace(new RegExp("[^a-zA-Z0-9\\-_\u00A0-\uFFFF]", "g"), "-").replace(/^((-?[0-9])|--)/, "_$1");
                    },
                    context: context,
                    import: true,
                    sourceMap: !options.isProduction,
                    importLoaders: 2, // will import previous amount of loaders
                  },
                },
                // {
                //   loader: 'postcss-loader',
                //   query: {
                //     sourceMap: !options.isProduction,
                //     sourceMapContents: !options.isProduction,
                //     extensions: ['.scss', '.css'],
                //     config: {
                //       path: Path.resolve(__dirname, '../postcss.config.js')
                //     }
                //   }
                // },
                {
                  loader: 'sass-loader',
                  query: {
                    sourceMap: !options.isProduction,
                    sourceMapContents: !options.isProduction,
                    includePaths: sassIncludePaths
                  },
                },
              ]
            })
          },
          {
            include: context,
            loader: 'ts-loader',
            query: {
              transpileOnly: true
            },
            exclude: /node_modules/,
            test: /.*\.(ts|tsx)/
          },
          {
            include: context,
            loader: 'babel-loader',
            exclude: /node_modules/,
            query: {
              cacheDirectory: false,
              "presets": [
                [
                  "env", {
                    modules: false,
                    targets: {
                      browsers: [
                        "last 2 versions",
                        "safari >= 7"
                      ]
                    }
                  }
                ],
                "react",
                "stage-3"
              ],
              babelrc: false,
              plugins: [
                'transform-class-properties',
                'transform-decorators-legacy',
                'check-es2015-constants',
                'transform-react-jsx',
                'transform-runtime',
                'transform-flow-strip-types',
                options.isProduction ? "babel-plugin-transform-remove-console" : null
                // 'transform-postcss',
                // [
                //   'react-css-modules',
                //   {
                //     context,
                //     webpackHotModuleReloading: !options.isProduction,
                //     filetypes: {
                //       ".scss": {
                //         syntax: "postcss-scss"
                //       }
                //     }
                //   }
                // ]
              ].filter(item => item != null)
            },
            test: /\.(js|jsx)$/
          },
          {
            test: /\.(gif|png|jpe?g|svg)$/i,
            loaders: [
              {
                loader: 'url-loader',
                options: {
                  limit: 8192
                }
              },
              {
                loader: 'image-webpack-loader',
                query: {
                  mozjpeg: {
                    progressive: true,
                  },
                  optipng: {
                    optimizationLevel: 7
                  },
                  gifsicle: {
                    interlaced: false
                  },
                  pngquant: {
                    quality: '65-90',
                    speed: 4
                  },
                  bypassOnDebug: true
                }
              }
            ]
          },
          {test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, loader: "file-loader"},
          {test: /\.woff(\?v=\d+\.\d+\.\d+)?$/, loader: "url-loader?limit=10000&mimetype=application/font-woff"},
          {test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/, loader: "url-loader?limit=10000&mimetype=application/font-woff"},
          {test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, loader: "url-loader?limit=10000&mimetype=application/octet-stream"}
        ],
      }
    };

    if (options.isProduction) {
      // webpackConfig.plugins.push(
      //   new Webpack.optimize.OccurrenceOrderPlugin()
      // );

      webpackConfig.plugins.push(
        extractGlobalCSS
      );
      webpackConfig.plugins.push(
        extractLocalCSS
      );

      webpackConfig.plugins.push(
        new Webpack.optimize.AggressiveMergingPlugin()
      );

      if (process.env.NODE_ENV === 'production') {
        webpackConfig.plugins.push(
          new UglifyJsPlugin({
            parallel: true,
            sourceMap: true,
            uglifyOptions: {
              compress: {
                global_defs: {
                    "process.env.NODE_ENV": "production"
                }
              }
            }
          })
          // new Webpack.optimize.UglifyJsPlugin({
          //   compressor: {
          //     'screw_ie8': true,
          //     'warnings': false,
          //     'unused': true,
          //     'dead_code': true,
          //   },
          //   sourceMap: true
          // })
        );
      }

      if (options.isDev) {
        webpackConfig.devServer = {
          contentBase: Path.join(__dirname, '../'),
          hot: false,
          port: options.port,
          inline: true,
          progress: true,
          disableHostCheck: options.disableHostCheck,
          public: options.public + ':' + options.port,
          https: options.https,
          cert: options.cert,
          key: options.key,
          historyApiFallback: {
            rewrites: infoRewrites
          }
        };
      }
    } else {
      webpackConfig.plugins.push(
        extractGlobalCSS
      );

      webpackConfig.plugins.push(
        extractLocalCSS
      );

      webpackConfig.plugins.push(
        new Webpack.NamedModulesPlugin()
      );

      webpackConfig.plugins.push(
        new Webpack.HotModuleReplacementPlugin()
      );

      webpackConfig.plugins.push(
        new ForkTsCheckerWebpackPlugin({ checkSyntacticErrors: true })
      );

      if (process.env.WWW_PORT) {
        console.log("Expecting WWW. Use something like:");
        console.log(`PORT=${process.env.WWW_PORT} LOCAL_PORT=${options.port} IGNORE_FILES=true IP=localhost node www.js`);
      } else {
        let wwwProcess = null;
        let wwwTimeout = null;

        const launchWWW = () => {
          console.log("Launching WWW...");
          console.log(process.argv);
          wwwProcess = child_process.spawn(process.argv[0], ['./www.js'], {
            env: Object.assign({}, process.env, {
              PORT: proxyPort.toString(),
              LOCAL_PORT: port,
              IP: 'localhost',
              IGNORE_FILES: 'true',
              UI_PORT: options.port.toString()
            }),
            stdio: ['inherit', 'inherit', 'inherit']
          });
          wwwProcess.on('exit', () => {
            if (wwwProcess) {
              wwwProsess = null;
              console.log("Error in server... restarting in 1 second.");
              if (wwwTimeout) {
                clearTimeout(wwwTimeout);
              }
              wwwTimeout = setTimeout(() => {
                wwwTimeout = null;
                launchWWW();
              }, 1000);
            }
          });
        };

        const wf = [require.resolve('../www.js')];

        console.log("Watching", wf);
        wp.watch(wf, [Path.resolve(__dirname, '../lib/www')], Date.now() - 10000);
        wp.on("change", (filePath, mtime) => {
          console.log(`Changed ${filePath}`);
          if (wwwProcess) {
            const proc = wwwProcess;
            wwwProcess = null;
            proc.kill();
          }
        });
        wp.on("aggregated", () => {
          if (!wwwProcess) {
            console.log("Reloading www.js");
            launchWWW();
          }
        });
        launchWWW();

        process.once('SIGINT', () => {
          if (wwwTimeout) {
            clearTimeout(wwwTimeout);
          }
          if (wwwProcess) {
            console.log(`SIGINT killing www`);
            const proc = wwwProcess;
            wwwProcess = null;
            if (wwwTimeout) {
              clearTimeout(wwwTimeout);
            }
            proc.kill();
          }
          setTimeout(() => {
            if (wwwTimeout) {
              clearTimeout(wwwTimeout);
            }
            process.kill(process.pid, 'SIGINT');
          }, 1000);
        });

        process.on('uncaughtException', (error) => {
          console.error(error);
          if (wwwTimeout) {
            clearTimeout(wwwTimeout);
          }
          if (wwwProcess) {
            console.log(`uncaughtException killing www`);
            const proc = wwwProcess;
            wwwProcess = null;
            if (wwwTimeout) {
              clearTimeout(wwwTimeout);
            }
            proc.kill();
          }
          process.nextTick(() => {
            if (wwwTimeout) {
              clearTimeout(wwwTimeout);
            }
            process.exit(1);
          });
        });
      }

      webpackConfig.devServer = {
        contentBase: Path.resolve(__dirname, '../src'),
        hot: true,
        port: options.port,
        host: options.host || 'localhost',
        disableHostCheck: options.disableHostCheck,
        public: options.public + (options.port ? ':' + options.port : ''),
        https: options.https,
        cert: options.cert,
        key: options.key,
        inline: true,
        historyApiFallback: {
          rewrites: infoRewrites
        },
        proxy: {
          '/ws': {
            target: 'http://localhost:' + proxyPort, // target host
            changeOrigin: true,
            ws: true
          },
          '/pdf': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/a': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/status': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/upload': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/compile': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/save': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/search': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/assignment': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/answer': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/user': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/answer/rating': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/answer/favorite': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/complete_assignment': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
          '/report': {
            target: 'http://localhost:' + proxyPort,
            changeOrigin: true
          },
        }
      };
    }
    return webpackConfig;
  });
};
