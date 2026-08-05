/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Türk bayrağı
        turkiye: {
          red: '#E30A17',
          dark: '#A00810',
          white: '#FFFFFF',
        },
        // Saha paleti — src/game/constants.js içindeki PALETTE ile aynı
        court: {
          in: '#8E1018',
          out: '#5C070D',
          line: '#FFFFFF',
          net: '#F2F2F2',
        },
        retro: {
          bg: '#0b0b12',
          panel: '#16162a',
          panelLight: '#1d1d38',
          accent: '#FFD24A',
          away: '#2B3A8F',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'ui-monospace', 'monospace'],
      },
      screens: {
        xs: '420px',
      },
    },
  },
  plugins: [],
};
