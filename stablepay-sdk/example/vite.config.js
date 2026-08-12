import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// By default this example resolves `stablepay-sdk` to the package's built
// bundle (dist/), which is what a real merchant installs — so the demo also
// serves as a check that the Rollup build works.
//
// That means **every change to stablepay-sdk/src requires `npm run build`**
// before it shows up here. While iterating on the SDK that gets tedious, so
// set VITE_SDK_SRC=1 to alias the package straight to source instead:
//
//   VITE_SDK_SRC=1 VITE_TECTONIC_ADDRESS=0x... npm run dev
//
// Use source mode for fast iteration; do a final pass without it to confirm
// the build output is correct too.
const useSrc = process.env.VITE_SDK_SRC === '1'

const srcAlias = {
  'stablepay-sdk': fileURLToPath(new URL('../src/index.js', import.meta.url)),
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: useSrc ? srcAlias : {},
  },
  server: {
    fs: {
      // Allow serving files from the SDK and its local workspace siblings.
      allow: ['../..'],
    },
  },
})
