const options = {
  isProduction: true,
  devtool: 'source-map'
};

module.exports = require('./webpack.config.js')(options);
