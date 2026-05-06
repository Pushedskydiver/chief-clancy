/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#FF0080',
        'brand-soft': '#FFEEF6',
      },
      spacing: {
        128: '32rem',
      },
      fontSize: {
        mega: ['4rem', { lineHeight: '1.1' }],
      },
    },
  },
};
