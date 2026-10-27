/**
 * Design Tokens & Theme Configuration
 * Single Source of Truth for application-wide colors and typography
 * Reference: Maison Neue typography & Brand Hex codes (#01B075, #464853, #1E1F24)
 */

export const THEME = {
  colors: {
    // Brand Colors from Reference
    primary: '#01B075',          // Vivid Emerald Green
    primaryDark: '#018F5F',      // Darker emerald for hover states
    primaryLight: '#E6F7F1',     // Soft emerald tint for badges/accents
    primaryMint: '#76D4B4',      // Light mint swatch from reference
    primaryMintBg: '#E9F8F2',    // Light background tint

    // Dark & Neutral Colors from Reference
    dark: '#1E1F24',             // Deep Obsidian for active pill tabs, headings, dark surfaces
    darkSurface: '#26282E',      // Card surface in dark contexts
    slate: '#464853',            // Charcoal Slate for body text, secondary labels, borders
    slateMuted: '#71737D',       // Light charcoal for hints/captions
    slateLight: '#94A3B8',       // Subtle border and inactive icons

    // Page Backgrounds & Surfaces
    bgPage: '#F4F6F8',           // Modern light gray canvas from HRM reference
    bgCard: '#FFFFFF',           // Crisp white card surface
    border: '#E8EEF4',           // Card and divider borders
    borderSubtle: '#F1F4F8',     // Subdued card dividers

    // Functional State Colors
    success: '#01B075',
    successBg: '#E6F7F1',
    warning: '#F59E0B',
    warningBg: '#FEF3C7',
    danger: '#EF4444',
    dangerBg: '#FEE2E2',
    info: '#3B82F6',
    infoBg: '#EFF6FF',
    purple: '#8B5CF6',
    purpleBg: '#F5F3FF',
  },

  typography: {
    fontFamily: "'Maison Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontMono: "'JetBrains Mono', Consolas, monospace",
    weights: {
      regular: 400,
      medium: 500,
      semiBold: 600,
      bold: 700,
    },
  },

  radii: {
    xs: '6px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    pill: '9999px',
  },

  shadows: {
    subtle: '0 1px 3px rgba(0, 0, 0, 0.02), 0 6px 16px rgba(17, 24, 39, 0.03)',
    card: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 4px 12px 0 rgba(0, 0, 0, 0.02)',
    hover: '0 8px 24px rgba(1, 176, 117, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
    elevated: '0 12px 32px rgba(30, 31, 36, 0.08)',
  },
} as const;

export type ThemeColors = typeof THEME.colors;
