/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Türk bayrağı ve saha paleti
        turkiye: {
          red: '#E30A17',
          white: '#FFFFFF',
        },
        // Game.js içindeki PALETTE ile aynı tutulmalı
        court: {
          in: '#8E1018', // saha içi
          out: '#5C070D', // serbest bölge
          line: '#FFFFFF', // çizgiler
          net: '#F5F5F5', // file
        },
        retro: {
          bg: '#0b0b12',
          panel: '#16162a',
          accent: '#FFD700',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
    },
  },
  plugins: [],
};
