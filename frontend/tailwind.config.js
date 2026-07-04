/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0F2648',
          light: '#173868',
        },
        orange: {
          DEFAULT: '#F2701A',
          light: '#FF8A3D',
        },
        ink: '#16233D',        // primary text
        muted: '#6B7686',      // secondary text
        line: '#E4E8F0',       // borders
        page: '#F3F5F9',       // page background
        success: '#1E8E5A',
        danger: '#D8432C',
      },
      fontFamily: {
        display: ['var(--font-poppins)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
      },
      boxShadow: {
        card: '0 24px 60px -18px rgba(15, 38, 72, 0.22)',
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(150deg, #DCEBFF 0%, #EAF1FC 35%, #FCE3C6 78%, #FBD5A6 100%)',
      },
    },
  },
  plugins: [],
};
