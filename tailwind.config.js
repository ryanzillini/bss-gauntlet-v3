/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'totogi': {
          purple: 'rgb(var(--totogi-purple) / <alpha-value>)',
          blue: 'rgb(var(--electric-blue) / <alpha-value>)',
          pink: 'rgb(var(--coral-pink) / <alpha-value>)',
          navy: 'rgb(var(--dark-navy) / <alpha-value>)',
        },
        'pure-white': 'rgb(var(--pure-white) / <alpha-value>)',
        'success': 'rgb(var(--success) / <alpha-value>)',
        'warning': 'rgb(var(--warning) / <alpha-value>)',
        'error': 'rgb(var(--error) / <alpha-value>)',
        'info': 'rgb(var(--info) / <alpha-value>)',
      },
      spacing: {
        'xs': 'var(--space-xs)',
        'sm': 'var(--space-sm)',
        'md': 'var(--space-md)',
        'lg': 'var(--space-lg)',
        'xl': 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
        code: ['Poppins', 'monospace'],
      },
      fontSize: {
        'h1': '3rem',
        'h2': '2.5rem',
        'h3': '2rem',
        'h4': '1.5rem',
        'body': '1rem',
        'small': '0.875rem',
      },
      screens: {
        'mobile': '375px',
        'tablet': '768px',
        'laptop': '1024px',
        'desktop': '1440px',
      },
      container: {
        center: true,
        padding: '1.5rem',
        screens: {
          'desktop': '1440px',
        },
      },
    },
  },
  plugins: [
    function({ addVariant }) {
      addVariant('light-mode', '.light-mode &');
    },
  ],
} 