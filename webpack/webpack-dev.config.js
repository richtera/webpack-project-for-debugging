const fs = require('fs');
const path = require('path');
const debugName = process.env.DEBUG_NAME || (
  process.env.NODE_ENV !== 'production'
    ? process.env.C9_USER || process.env.USERNAME || process.env.USER_NAME || process.env.USER || null
    : null);
console.log(`Using ${debugName} reactors`);
const options = {
  isProduction: false,
  devtool: 'source-map',
  jsFileName: 'index.js',
  cssFileName: 'application.css',
  host: '0.0.0.0',
  port: 3000,
  public: process.env.C9_PROJECT ? `${process.env.C9_HOSTNAME}` : 'localhost',
  debugName: debugName,
  disableHostCheck: process.env.C9_PROJECT != null
};
let cert = path.resolve(__dirname, `./${process.env.C9_HOSTNAME}.pem`);
if (fs.existsSync(cert)) {
  options.cert = options.key = fs.readFileSync(cert);
  options.https = true;
}
module.exports = require('./webpack.config.js')(options);
