/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: {
          DEFAULT: '#030712',
          secondary: '#0F1729'
        },
        primary: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
          light: '#818CF8'
        },
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          hover: 'rgba(255, 255, 255, 0.1)',
          border: 'rgba(255, 255, 255, 0.1)'
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6'
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(circle at center, var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-pattern': 'linear-gradient(to right, rgba(99, 102, 241, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(99, 102, 241, 0.05) 1px, transparent 1px)',
        'glow-primary': 'radial-gradient(circle at center, rgba(99, 102, 241, 0.15) 0%, transparent 70%)'
      },
      boxShadow: {
        'neon': '0 0 20px -5px rgba(99, 102, 241, 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
        'glass-hover': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        'glass-border': 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
      }
    },
  },
  plugins: [],
};