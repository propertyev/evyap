import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#11254B',
        yel: '#FFC000',
        ly: '#FBFD9B',
        grn: '#E2EFDA',
        grey: '#E7E6E6',
      },
      fontFamily: {
        head: ['Poppins', 'sans-serif'],
        body: ['"Open Sans"', 'Calibri', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
