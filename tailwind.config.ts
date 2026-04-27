import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A12',
        surface: '#12121E',
        'surface-2': '#1A1A2E',
        border: '#2A2A3E',
        primary: '#7F77DD',
        'primary-hover': '#9B94E8',
        'text-primary': '#F0EFF8',
        'text-secondary': '#8B8AA0',
        'text-tertiary': '#55546A',
        success: '#4ADE80',
        warning: '#FBBF24',
        danger: '#F87171',
        streak: '#FF6B35',
      },
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        body: ['var(--font-dm-sans)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      fontSize: {
        '2xs': '12px',
        xs: '12px',
        sm: '14px',
        base: '14px',
        md: '16px',
        lg: '18px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
        '4xl': '64px',
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
      },
      backgroundImage: {
        'gradient-surface': 'linear-gradient(to bottom, #12121E, #0A0A12)',
      },
    },
  },
  plugins: [],
}

export default config
