// @ts-check
const baseConfig = require('./base');

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray} */
const reactConfig = [
  ...baseConfig,
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      react: require('eslint-plugin-react'),
      'react-hooks': require('eslint-plugin-react-hooks'),
      'jsx-a11y': require('eslint-plugin-jsx-a11y'),
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/jsx-no-target-blank': 'error',
      'react/no-danger': 'error',
      'react/no-danger-with-children': 'error',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Accessibility
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-labels': 'off',
      'jsx-a11y/no-autofocus': 'warn',
    },
  },
];

module.exports = reactConfig;
