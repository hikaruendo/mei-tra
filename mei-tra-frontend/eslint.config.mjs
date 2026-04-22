import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals.js';
import nextTypeScript from 'eslint-config-next/typescript.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.config(nextCoreWebVitals),
  ...compat.config(nextTypeScript),
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright/**',
      'test-results/**',
      'jest.config.js',
      'test-com-takeover.js',
      'test-waiting-room.js',
      'test-waiting-room2.js',
    ],
  },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },
];

export default eslintConfig;
