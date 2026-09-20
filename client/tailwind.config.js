const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: token('bg'),
        card: token('card'),
        ink: token('ink'),
        muted: token('muted'),
        line: token('line'),
        brand: token('brand'),
        brass: token('brass'),
        good: token('good'),
        bad: token('bad'),
      },
      fontFamily: {
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / .05), 0 8px 20px -10px rgb(var(--shadow) / .16)',
        lift: '0 2px 4px rgb(var(--shadow) / .08), 0 14px 28px -12px rgb(var(--shadow) / .30)',
        pop: '0 -10px 50px -10px rgb(var(--shadow) / .35)',
      },
      borderRadius: { card: '20px', sheet: '28px' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { shimmer: 'shimmer 1.4s infinite' },
    },
  },
  plugins: [],
};
