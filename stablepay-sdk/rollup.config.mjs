import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import terser from '@rollup/plugin-terser';
import babel from "@rollup/plugin-babel";
import postcss from "rollup-plugin-postcss";
import url from "@rollup/plugin-url";
import copy from "rollup-plugin-copy";
export default {
  input: "src/index.js",
  output: [
    {
      format: "es",
      file: "dist/esm/index.js",
      // src/index.js intentionally provides both a default export (the
      // established `import StablePay from 'stablepay-sdk'` API) and named
      // exports (tree-shakeable, and how tests reach the adapters).
      // Declaring "named" silences Rollup's mixed-exports warning; the emitted
      // UMD global keeps every member attached directly to window.StablePay,
      // so existing script-tag consumers are unaffected.
      exports: "named",
      assetFileNames: "assets/[name][extname]",
    },
    {
      format: "umd",
      name: "StablePay",
      file: "dist/umd/index.js",
      exports: "named",
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
  // Distribution model — keep in step with package.json:
  //
  //   external  = a runtime `dependency` the consumer's install resolves. Every
  //               entry here must be resolvable from the npm registry; a
  //               `file:` specifier only exists in this checkout.
  //               djed-sdk is published (^1.0.2), so it stays external.
  //   bundled   = inlined into dist/, so it is a `devDependency` only.
  //               tectonic-sdk is unpublished and is bundled for exactly that
  //               reason; its own peer dependency, viem, stays external.
  //
  // Moving a package between the two lists means moving it between
  // `dependencies` and `devDependencies` as well.
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
    copy({
      targets: [
        { src: 'src/assets/*', dest: 'dist/assets' }
      ]
    }),
  ],
};
