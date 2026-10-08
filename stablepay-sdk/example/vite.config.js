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

const fromHere = (relative) => fileURLToPath(new URL(relative, import.meta.url))

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
      // Exactly what the demo resolves outside its own root, and no more.
      // Allowing the repository root ('../..') would let the dev server hand
      // out any file under it — a root-level .env or key material included —
      // to anything that can reach the port.
      //
      // Setting `allow` replaces Vite's workspace-root default, so the list
      // must cover the example too; the first entry does, since the example
      // lives inside stablepay-sdk.
      allow: [
        // stablepay-sdk (`file:..`): this example, dist/ by default, src/
        // with VITE_SDK_SRC=1, and the SDK's node_modules.
        fromHere('..'),
        // Sibling SDKs, reached through stablepay-sdk/node_modules symlinks
        // when the SDK is aliased to source.
        fromHere('../../tectonic-sdk'),
        fromHere('../../djed-sdk'),
      ],
    },
  },
})
