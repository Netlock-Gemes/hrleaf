import type { Config } from 'tailwindcss';

export default {
  darkMode: ["class", "(prefers-color-scheme: dark)"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'var(--font-geist-sans)'
  			],
  			mono: [
  				'var(--font-geist-mono)'
  			]
  		},
  		colors: {
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			'primary-10': 'var(--primary-10)',
  			'primary-20': 'var(--primary-20)',
  			'primary-50': 'var(--primary-50)',
  			'primary-80': 'var(--primary-80)',
  			'surface-dark': 'var(--surface-dark)',
  			'surface-medium': 'var(--surface-medium)',
  			'surface-light': 'var(--surface-light)',
  			'surface-dark-lighter': 'var(--surface-dark-lighter)',
  			'surface-dark-darker': 'var(--surface-dark-darker)',
  			'surface-medium-lighter': 'var(--surface-medium-lighter)',
  			'surface-medium-darker': 'var(--surface-medium-darker)',
  			text: 'var(--text)',
  			'text-secondary': 'var(--text-secondary)',
  			'text-tertiary': 'var(--text-tertiary)',
  			'text-disabled': 'var(--text-disabled)',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			'editor-bg': 'var(--editor-bg)',
  			'editor-border': 'var(--editor-border)',
  			'nav-link': 'var(--nav-link)',
  			'nav-link-hover': 'var(--nav-link-hover)',
  			accent: {
  				'10': 'var(--primary-10)',
  				'20': 'var(--primary-20)',
  				'50': 'var(--primary-50)',
  				'80': 'var(--primary-80)',
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		backgroundColor: {
  			DEFAULT: 'var(--background)',
  			'placeholder-text': 'var(--placeholder-text)',
  			'quote-border': 'var(--quote-border)',
  			'checkbox-border': 'var(--checkbox-border)',
  			'checkbox-checked-bg': 'var(--checkbox-checked-bg)',
  			'checkbox-checkmark': 'var(--checkbox-checkmark)',
  			'code-bg': 'var(--code-bg)',
  			'dropdown-chevron': 'var(--dropdown-chevron)',
  			'table-border': 'var(--table-border)',
  			'table-cell-bg': 'var(--table-cell-bg)',
  			'table-header-bg': 'var(--table-header-bg)',
  			'table-selected-bg': 'var(--table-selected-bg)',
  			'table-striping': 'var(--table-striping)',
  			'input-border': 'var(--input-border)',
  			'input-text': 'var(--input-text)',
  			'input-bg': 'var(--input-bg)',
  			'input-focus-border': 'var(--input-focus-border)',
  			'input-focus-bg': 'var(--input-focus-bg)',
  			'input-focus-shadow': 'var(--input-focus-shadow)',
  			'input-placeholder': 'var(--input-placeholder)',
  			'primary': 'var(--primary)',
  			'primary-10': 'var(--primary-10)',
  			'primary-20': 'var(--primary-20)',
  			'primary-50': 'var(--primary-50)',
  			'primary-80': 'var(--primary-80)',
  			'surface-dark-lighter': 'var(--surface-dark-lighter)',
  			'surface-dark-darker': 'var(--surface-dark-darker)',
  			'surface-medium-lighter': 'var(--surface-medium-lighter)',
  			'surface-medium-darker': 'var(--surface-medium-darker)'
  		},
  		textColor: {
  			DEFAULT: 'var(--foreground)',
  			'placeholder-text': 'var(--placeholder-text)',
  			'link': 'var(--text-link)',
  			'link-hover': 'var(--text-link-hover)',
  			'text-secondary': 'var(--text-secondary)',
  			'text-tertiary': 'var(--text-tertiary)',
  			'text-disabled': 'var(--text-disabled)',
  			'quote-border': 'var(--quote-border)',
  			'checkbox-border': 'var(--checkbox-border)',
  			'checkbox-checked-bg': 'var(--checkbox-checked-bg)',
  			'checkbox-checkmark': 'var(--checkbox-checkmark)',
  			'code-bg': 'var(--code-bg)',
  			'dropdown-chevron': 'var(--dropdown-chevron)',
  			'table-border': 'var(--table-border)',
  			'table-cell-bg': 'var(--table-cell-bg)',
  			'table-header-bg': 'var(--table-header-bg)',
  			'table-selected-bg': 'var(--table-selected-bg)',
  			'table-striping': 'var(--table-striping)',
  			'input-border': 'var(--input-border)',
  			'input-text': 'var(--input-text)',
  			'input-bg': 'var(--input-bg)',
  			'input-focus-border': 'var(--input-focus-border)',
  			'input-focus-bg': 'var(--input-focus-bg)',
  			'input-focus-shadow': 'var(--input-focus-shadow)',
  			'input-placeholder': 'var(--input-placeholder)'
  		},
  		borderColor: {
  			DEFAULT: 'var(--editor-border)',
  			'placeholder-text': 'var(--placeholder-text)',
  			'quote-border': 'var(--quote-border)',
  			'checkbox-border': 'var(--checkbox-border)',
  			'checkbox-checked-bg': 'var(--checkbox-checked-bg)',
  			'checkbox-checkmark': 'var(--checkbox-checkmark)',
  			'code-bg': 'var(--code-bg)',
  			'dropdown-chevron': 'var(--dropdown-chevron)',
  			'table-border': 'var(--table-border)',
  			'table-cell-bg': 'var(--table-cell-bg)',
  			'table-header-bg': 'var(--table-header-bg)',
  			'table-selected-bg': 'var(--table-selected-bg)',
  			'table-striping': 'var(--table-striping)',
  			'input-border': 'var(--input-border)',
  			'input-text': 'var(--input-text)',
  			'input-bg': 'var(--input-bg)',
  			'input-focus-border': 'var(--input-focus-border)',
  			'input-focus-bg': 'var(--input-focus-bg)',
  			'input-focus-shadow': 'var(--input-focus-shadow)',
  			'input-placeholder': 'var(--input-placeholder)'
  		},
  		caretColor: {
  			DEFAULT: 'var(--accent)',
  			'placeholder-text': 'var(--placeholder-text)',
  			'checkbox-border': 'var(--checkbox-border)',
  			'checkbox-checked-bg': 'var(--checkbox-checked-bg)',
  			'checkbox-checkmark': 'var(--checkbox-checkmark)',
  			'dropdown-chevron': 'var(--dropdown-chevron)',
  			'input-text': 'var(--input-text)'
  		},
  		outlineColor: {
  			'accent': 'var(--accent)'
  		},
  		borderRadius: {
  			squircle: '24px 24px 24px 24px / 28px 28px 28px 28px',
  			'squircle-sm': '10px 10px 10px 10px / 14px 14px 14px 14px',
  			'squircle-xs': '6px 6px 6px 6px / 8px 8px 8px 8px',
  			'squircle-xxs': '4px 4px 4px 4px / 6px 6px 6px 6px',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		transitionProperty: {
  			colors: 'color, background-color, border-color, text-decoration-color, fill, stroke'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
