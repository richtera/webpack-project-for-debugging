#!/bin/bash
echo "Build and test without UglifyJsPlugin"
yarn run build
echo "\nShow Errors:"
find dist/assets/js/ -name "*.js" -exec ./findErrors.sh {} \;
echo "Build and test with UglifyJsPlugin"
NODE_ENV=production yarn run build
echo "\nShow Errors:"
find dist/assets/js/ -name "*.js" -exec ./findErrors.sh {} \;
