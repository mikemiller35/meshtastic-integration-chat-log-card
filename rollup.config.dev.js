import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import serve from 'rollup-plugin-serve';
import json from '@rollup/plugin-json';
import image from '@rollup/plugin-image';
import replace from '@rollup/plugin-replace';

// Where the dev bundle is written. Defaults to ./dist-dev so the build never
// escapes the repository unless you explicitly opt in.
//
// To live-reload directly into a Home Assistant config, set:
//   DEV_OUTPUT_DIR=/path/to/homeassistant/config/www yarn start
const outputDir = process.env.DEV_OUTPUT_DIR ?? './dist-dev';

export default {
  input: 'src/index.ts',
  output: {
    file: `${outputDir}/meshtastic-chat-card.js`,
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __MESHTASTIC_CARD_DEV__: 'true',
      },
    }),
    image(),
    nodeResolve(),
    commonjs(),
    typescript({
      tsconfigOverride: {
        exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
      },
    }),
    json(),
    serve({
      contentBase: outputDir,
      host: '0.0.0.0',
      port: 5001,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }),
  ],
  onwarn(warning, warn) {
    warn(warning);
  },
};
