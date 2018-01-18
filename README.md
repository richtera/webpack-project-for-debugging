# webpack-project-for-debugging

This is a partial copy of my source tree (with submodule) which reproduces the DefinePlugin, UglifyJSPlugin, CommonChunkPlugin problem in webpack.

# How to

```sh
git clone --recurse-submodules https://github.com/richtera/webpack-project-for-debugging.git
cd webpack-project-for-debugging
yarn install
yarn run build
find dist/assets/js/ -name "*.js" -exec ./findErrors.sh {} \;
NODE_ENV=production yarn run build
find dist/assets/js/ -name "*.js" -exec ./findErrors.sh {} \;
```

I also put the last few commands into demo.sh

```sh
git clone --recurse-submodules https://github.com/richtera/webpack-project-for-debugging.git
cd webpack-project-for-debugging
yarn install
./demo.sh
```

Under working conditions the grep should not return anything.