import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import terser from '@rollup/plugin-terser';
import babel from "@rollup/plugin-babel";
import postcss from "rollup-plugin-postcss";
import url from "@rollup/plugin-url";
export default {
  input: "src/index.js",
  output: [
    {
      format: "es",
      file: "dist/esm/index.js",
      assetFileNames: "assets/[name][extname]",
    },
    {
      format: "umd",
      name: "StablePay",
      file: "dist/umd/index.js",
      globals: {
        "djed-sdk": "DjedSdk",
        web3: "Web3",
        react: "React",
        "react-dom": "ReactDOM",
        viem: "viem",
        "viem/chains": "viemChains",
      },
      sourcemap: true,
      assetFileNames: "assets/[name][extname]",
    },
  ],
  external: ["djed-sdk", "web3", "react", "react-dom", "viem", "viem/chains"],
  plugins: [
    resolve({
      extensions: [".js", ".jsx"],
    }),
    commonjs({
      include: "node_modules/",
    }),
    json(),
    url({
      include: ["**/*.svg", "**/*.png", "**/*.jpg", "**/*.gif"],
      limit: 0,
      fileName: "[name][extname]",
      destDir: "dist/assets",
      publicPath: "../assets/", //note:use relative path here
      emitFiles: true,
    }),
    postcss({
      plugins: [],
      extract: "styles.css",
      minimize: true,
      modules: true,

      use: ["sass"],

      url: {
        url: "rebase", 
      },
    }),
    terser(),
    babel({
      exclude: "node_modules/**",
      presets: ["@babel/preset-react"],
      babelHelpers: "bundled",
    }),
  ],
};
