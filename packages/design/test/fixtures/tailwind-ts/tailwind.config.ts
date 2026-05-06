import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{html,js,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#00B0FF',
      },
      spacing: {
        gutter: '1.25rem',
      },
      fontSize: {
        display: ['3rem', { lineHeight: '1.05' }],
      },
    },
  },
};

export default config;
