import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import serve from 'rollup-plugin-serve';
import json from '@rollup/plugin-json';
import image from '@rollup/plugin-image';
import replace from '@rollup/plugin-replace';

const plugins = (withServe) => {
  const list = [
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
        include: ['src/**/*.ts', 'demo/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
      },
    }),
    json(),
  ];
  if (withServe) {
    list.push(
      serve({
        contentBase: 'demo',
        host: '0.0.0.0',
        port: 5050,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }),
    );
  }
  return list;
};

const onwarn = (warning, warn) => warn(warning);

// Two configs (rather than one with multi-input) so each entry produces a
// self-contained ES module — no rollup-generated shared chunks to wire up in
// the HTML. The harness intentionally inlines the one runtime constant it
// shares with the card.
export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'demo/dist/meshtastic-chat-card.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: plugins(false),
    onwarn,
  },
  {
    input: 'demo/demo.ts',
    output: {
      file: 'demo/dist/demo.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: plugins(true),
    onwarn,
  },
];
