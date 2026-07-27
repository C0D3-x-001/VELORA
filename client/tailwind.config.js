/* BRAND COLOR: Primary #5b3eff (blue, from logo).
   To revert to purple: find-replace #5b3eff → #5b3eff, #4a2dff → #4a2dff, rgb(91 62 255 → rgb(91 62 255 */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep charcoal base (not pure black)
        bg: '#0a0a0f',
        'bg-elevated': '#111118',
        'bg-overlay': '#16161f',
        surface: '#14141c',
        'surface-subtle': '#1a1a24',
        'surface-overlay': '#1e1e2a',
        'surface-hover': '#22222e',

        // Refined accent - deep violet/indigo
        primary: '#5b3eff',
        'primary-hover': '#4a2dff',
        'primary-muted': '#5b3eff20',
        'primary-glow': '#5b3eff40',

        // Supporting neutrals
        border: '#2a2a3a',
        'border-strong': '#3a3a4a',
        'border-focus': '#5b3eff',

        // Text hierarchy
        text: '#f4f4f8',
        'text-secondary': '#a8a8b8',
        'text-muted': '#686878',
        'text-inverse': '#0a0a0f',

        // Status colors (muted, refined)
        success: '#10b981',
        'success-muted': '#10b98120',
        warning: '#f59e0b',
        'warning-muted': '#f59e0b20',
        danger: '#ef4444',
        'danger-muted': '#ef444420',

        // Viral score colors
        viral: '#5b3eff',
        'viral-low': '#6b7280',
        'viral-med': '#f59e0b',
        'viral-high': '#10b981',
        'viral-max': '#5b3eff',
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-lg': ['clamp(1.875rem, 3.5vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['clamp(1.5rem, 2.5vw, 1.875rem)', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '600' }],
        'display-sm': ['clamp(1.25rem, 2vw, 1.5rem)', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-lg': ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-md': ['1.125rem', { lineHeight: '1.35', letterSpacing: '-0.005em', fontWeight: '600' }],
        'heading-sm': ['1rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.55', fontWeight: '400' }],
        'body-xs': ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.6875rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.02em', textTransform: 'uppercase' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        'card': '0 2px 8px -2px rgb(0 0 0 / 0.3), 0 1px 3px -1px rgb(0 0 0 / 0.2)',
        'card-hover': '0 12px 32px -8px rgb(0 0 0 / 0.4), 0 4px 12px -4px rgb(0 0 0 / 0.25)',
        'card-glass': '0 2px 8px -2px rgb(0 0 0 / 0.3), 0 1px 3px -1px rgb(0 0 0 / 0.2), inset 0 1px 0 rgb(255 255 255 / 0.03)',
        'card-glass-hover': '0 12px 32px -8px rgb(0 0 0 / 0.45), 0 4px 12px -4px rgb(0 0 0 / 0.3), inset 0 1px 0 rgb(255 255 255 / 0.05)',
        'button': '0 1px 2px rgb(0 0 0 / 0.3)',
        'button-hover': '0 4px 12px -2px rgb(91 62 255 / 0.35)',
        'glow-primary': '0 0 0 1px rgb(91 62 255 / 0.3), 0 0 24px -4px rgb(91 62 255 / 0.25)',
        'glow-viral': '0 0 0 1px currentColor, 0 0 16px -2px currentColor',
        'inner-glow': 'inset 0 1px 0 rgb(255 255 255 / 0.05)',
      },
      backdropBlur: {
        'glass': '16px',
        'glass-strong': '24px',
      },
      backgroundImage: {
        'mesh-gradient': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgb(91 62 255 / 0.15) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 100% 100%, rgb(91 62 255 / 0.1) 0%, transparent 50%), radial-gradient(ellipse 50% 30% at 0% 0%, rgb(91 62 255 / 0.08) 0%, transparent 50%)',
        'mesh-subtle': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgb(91 62 255 / 0.08) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 100% 100%, rgb(91 62 255 / 0.05) 0%, transparent 50%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-out': 'scaleOut 0.15s cubic-bezier(0.4, 0, 1, 1)',
        'progress-fill': 'progressFill 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'progress-pulse': 'progressPulse 2s ease-in-out infinite',
        'ring-draw': 'ringDraw 1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'ring-pulse': 'ringPulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'float-subtle': 'floatSubtle 6s ease-in-out infinite',
        'border-glow': 'borderGlow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
        progressFill: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        progressPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        ringDraw: {
          '0%': { strokeDashoffset: '283' },
          '100%': { strokeDashoffset: 'var(--ring-offset, 0)' },
        },
        ringPulse: {
          '0%, 100%': { filter: 'drop-shadow(0 0 0 currentColor)' },
          '50%': { filter: 'drop-shadow(0 0 8px currentColor)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        floatSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        borderGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(91 62 255 / 0)' },
          '50%': { boxShadow: '0 0 24px -4px rgb(91 62 255 / 0.3)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring-tight': 'cubic-bezier(0.2, 1, 0.25, 1)',
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '75': '75ms',
        '150': '150ms',
        '250': '250ms',
        '350': '350ms',
        '500': '500ms',
      },
      zIndex: {
        'sidebar': '40',
        'header': '30',
        'modal': '50',
        'toast': '60',
        'tooltip': '70',
      },
    },
  },
  plugins: [],
}