import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import image from '@rollup/plugin-image';
import replace from '@rollup/plugin-replace';
import gzipPlugin from 'rollup-plugin-gzip';

export default [
  {
    input: 'src/index.ts',
    output: {
      file: './dist/meshtastic-chat-card.js',
      format: 'es',
    },
    plugins: [
      replace({
        preventAssignment: true,
        values: {
          __MESHTASTIC_CARD_DEV__: 'false',
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
      terser(),
      gzipPlugin(),
    ],
    onwarn(warning, warn) {
      warn(warning);
    },
  },
];
