import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist', 'coverage', 'node_modules'],
  },
  {
    rules: {
      // 项目要求所有异步边界显式捕获异常。
      'no-useless-catch': 'off',
    },
  },
);
