const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    "./**/*tmpl",
  ],
  theme: {
    extend: {
      fontFamily: {
        atkinson: ['atkinson']
      }
    }
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/forms'),
    plugin(function ({ addBase }) {
      addBase({
        '@font-face': {
            fontFamily: 'atkinson',
            fontWeight: 'normal',
            src: 'url(/static/font/AtkinsonHyperlegible-Regular.woff2)',
        }
      })
    }),
  ],
}
