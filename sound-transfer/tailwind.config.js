/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sonic: {
          50:  '#f0fffe',
          100: '#ccfef8',
          200: '#99fdf3',
          300: '#5ef5eb',
          400: '#2be4db',
          500: '#12c8c0',
          600: '#0da09a',
          700: '#0f7f7a',
          800: '#126463',
          900: '#145352',
          950: '#062f30',
        },
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-subtle': 'bounce 1.5s infinite',
      },
    },
  },
  plugins: [],
};
