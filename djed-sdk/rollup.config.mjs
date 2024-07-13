import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.js',
  output: [
    {
      format: 'es',
      file: 'dist/esm/index.js'
    },
    {
      format: 'umd',
      name: 'DjedSdk',
      file: 'dist/umd/index.js',
      globals: {
        web3: 'Web3',
        ethers: 'ethers'
      }
    },
  ],
  external: ['web3', 'ethers'],
  plugins: [
    resolve({
      extensions: ['.js', '.jsx']
    }),
    commonjs({
      include: 'node_modules/**'
    }),
    
    json()
  ]
};
