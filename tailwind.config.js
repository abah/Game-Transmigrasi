/** Tailwind build config — scan index.html for `tw-`-prefixed classes */
module.exports = {
  prefix: 'tw-',
  content: ['./index.html'],
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
