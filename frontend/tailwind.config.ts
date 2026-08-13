/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
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
        line: '#E4E8F0',       // borders
        page: '#F3F5F9',       // page background
        success: '#1E8E5A',
        danger: '#D8432C',
        // ---- shadcn/ui tokens (brand-mapped) ----
        border: '#E4E8F0',
        input: '#E4E8F0',
        ring: '#F2701A',
        background: '#F3F5F9',
        foreground: '#16233D',
        primary: { DEFAULT: '#F2701A', foreground: '#FFFFFF' },
        secondary: { DEFAULT: '#EAF1FC', foreground: '#0F2648' },
        destructive: { DEFAULT: '#D8432C', foreground: '#FFFFFF' },
        muted: { DEFAULT: '#EEF0F4', foreground: '#6B7686' }, // bg-muted light / text-muted-foreground #6B7686
        accent: { DEFAULT: '#FBF3EA', foreground: '#C85A10' },
        popover: { DEFAULT: '#FFFFFF', foreground: '#16233D' },
        card: { DEFAULT: '#FFFFFF', foreground: '#16233D' },
      },
      fontFamily: {
        display: ['var(--font-poppins)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: '0 24px 60px -18px rgba(15, 38, 72, 0.22)',
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(150deg, #DCEBFF 0%, #EAF1FC 35%, #FCE3C6 78%, #FBD5A6 100%)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
