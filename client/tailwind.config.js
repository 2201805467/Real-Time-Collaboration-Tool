/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#faf8ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f3ff',
        'surface-container': '#eaedff',
        'surface-container-high': '#e2e7ff',
        'surface-container-highest': '#dae2fd',
        'surface-bright': '#faf8ff',
        'surface-dim': '#d2d9f4',
        'surface-variant': '#dae2fd',
        background: '#faf8ff',
        primary: '#3525cd',
        'primary-container': '#4f46e5',
        'primary-fixed': '#e2dfff',
        'primary-fixed-dim': '#c3c0ff',
        secondary: '#006c49',
        'secondary-container': '#6cf8bb',
        'secondary-fixed': '#6ffbbe',
        'secondary-fixed-dim': '#4edea3',
        tertiary: '#8f0055',
        'tertiary-container': '#b6166f',
        'tertiary-fixed': '#ffd9e4',
        'tertiary-fixed-dim': '#ffb0cd',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        outline: '#777587',
        'outline-variant': '#c7c4d8',
        'on-surface': '#131b2e',
        'on-surface-variant': '#464555',
        'on-background': '#131b2e',
        'on-primary': '#ffffff',
        'on-primary-container': '#dad7ff',
        'on-primary-fixed': '#0f0069',
        'on-primary-fixed-variant': '#3323cc',
        'on-secondary': '#ffffff',
        'on-secondary-container': '#00714d',
        'on-secondary-fixed': '#002113',
        'on-secondary-fixed-variant': '#005236',
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#ffcede',
        'on-tertiary-fixed': '#3e0022',
        'on-tertiary-fixed-variant': '#8c0053',
        'on-error': '#ffffff',
        'on-error-container': '#93000a',
        'inverse-surface': '#283044',
        'inverse-on-surface': '#eef0ff',
        'inverse-primary': '#c3c0ff',
        'surface-tint': '#4d44e3'
      },
      spacing: {
        'margin-mobile': '1rem',
        margin: '1.5rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '0.75rem',
        'space-lg': '1rem',
        'space-xl': '1.5rem',
        'space-2xl': '2rem',
        gutter: '1rem',
        'gutter-sm': '0.5rem',
        'gutter-lg': '1.5rem'
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'IBM Plex Sans', 'Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
        body: ['IBM Plex Sans Arabic', 'IBM Plex Sans', 'sans-serif'],
        code: ['JetBrains Mono', 'monospace']
      },
      fontSize: {
        'headline-lg': ['24px', { lineHeight: '34px', letterSpacing: '0', fontWeight: '600' }],
        'headline-md': ['20px', { lineHeight: '30px', letterSpacing: '0', fontWeight: '600' }],
        'headline-sm': ['16px', { lineHeight: '24px', letterSpacing: '0', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '26px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '22px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0', fontWeight: '600' }],
        'code-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }]
      },
      boxShadow: {
        stitch: '0 1px 8px rgb(0 0 0 / 0.04)',
        card: '0 6px 18px rgb(19 27 46 / 0.06)'
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem'
      }
    }
  },
  plugins: []
};
