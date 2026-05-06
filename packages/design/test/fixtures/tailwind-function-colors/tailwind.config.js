/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,ts,tsx}'],
  theme: {
    extend: {
      // Tailwind allows callback-form values for advanced theme composition.
      // Slice 2 deliberately treats non-plain-object values as empty record;
      // schema validation in slice 6 will tighten this.
      colors: ({ colors }) => ({
        accent: colors?.blue?.[500] ?? '#3B82F6',
      }),
      spacing: {
        128: '32rem',
      },
    },
  },
};
