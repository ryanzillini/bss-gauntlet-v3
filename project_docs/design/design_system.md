# BSS Magic Design System

## Brand Identity

### Core Values
- AI-First Innovation
- Modern & Professional
- Intuitive & Accessible
- Bold & Confident

### Logo & Branding
- Primary Logo: "AI'm Totogi" with AI emphasis
- Logo Variations:
  - Full color (Purple gradient)
  - White (for dark backgrounds)
  - Monochrome (for limited color usage)
- Minimum Clear Space: 2x logo height
- Minimum Size: 100px width

### Color Palette

#### Primary Colors
```css
--totogi-purple: #9747FF;      /* Main brand color */
--electric-blue: #00A3FF;      /* Secondary accent */
--coral-pink: #FF5C72;         /* CTA & highlights */
--dark-navy: #0A1929;          /* Background */
--pure-white: #FFFFFF;         /* Text & UI elements */
```

#### Gradient Combinations
```css
--primary-gradient: linear-gradient(135deg, #9747FF 0%, #00A3FF 100%);
--accent-gradient: linear-gradient(135deg, #FF5C72 0%, #9747FF 100%);
--dark-gradient: linear-gradient(180deg, #0A1929 0%, #1A2B3B 100%);
```

#### UI State Colors
```css
--success: #2ECC71;
--warning: #F1C40F;
--error: #E74C3C;
--info: #3498DB;
```

### Typography

#### Font Families
```css
--primary-font: 'Inter', sans-serif;      /* Main text */
--display-font: 'Space Grotesk', sans-serif;  /* Headings */
--code-font: 'Fira Code', monospace;      /* Code blocks */
```

#### Type Scale
```css
--h1: 3rem;    /* 48px - Main headlines */
--h2: 2.5rem;  /* 40px - Section headers */
--h3: 2rem;    /* 32px - Subsections */
--h4: 1.5rem;  /* 24px - Card titles */
--body: 1rem;  /* 16px - Body text */
--small: 0.875rem; /* 14px - Supporting text */
```

### Spacing System
```css
--space-xs: 0.25rem;   /*  4px */
--space-sm: 0.5rem;    /*  8px */
--space-md: 1rem;      /* 16px */
--space-lg: 1.5rem;    /* 24px */
--space-xl: 2rem;      /* 32px */
--space-2xl: 3rem;     /* 48px */
```

## Components

### Cards & Containers

#### Glass Card
```css
.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

#### AI Feature Card
```css
.ai-card {
  background: var(--dark-gradient);
  border: 1px solid var(--totogi-purple);
  border-radius: 12px;
  box-shadow: 0 0 24px rgba(151, 71, 255, 0.2);
}
```

### Buttons

#### Primary Button
```css
.btn-primary {
  background: var(--primary-gradient);
  color: var(--pure-white);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(151, 71, 255, 0.3);
}
```

#### AI Action Button
```css
.btn-ai {
  background: var(--accent-gradient);
  color: var(--pure-white);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}
```

### AI Visual Elements

#### Glow Effects
```css
.ai-glow {
  box-shadow: 0 0 20px rgba(151, 71, 255, 0.4);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 20px rgba(151, 71, 255, 0.4); }
  50% { box-shadow: 0 0 30px rgba(151, 71, 255, 0.6); }
  100% { box-shadow: 0 0 20px rgba(151, 71, 255, 0.4); }
}
```

#### Neural Network Background
```css
.neural-bg {
  background-image: radial-gradient(circle at 10px 10px, rgba(151, 71, 255, 0.1) 2px, transparent 0);
  background-size: 40px 40px;
}
```

### Animations

#### Transition Defaults
```css
.transition-base {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

#### AI Processing
```css
@keyframes ai-processing {
  0% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 0.6; }
}
```

### Icons & Graphics

#### AI Icons
- Use outlined style with 2px stroke weight
- Primary color: var(--totogi-purple)
- Size variations: 16px, 24px, 32px
- Hover state: Add glow effect

#### Illustrations
- Modern, minimal style
- Purple and blue gradient fills
- Subtle texture overlays
- AI-themed elements

## Layout Guidelines

### Grid System
- 12-column grid
- Gutter width: 24px
- Container max-width: 1440px
- Responsive breakpoints:
  ```css
  --mobile: 375px;
  --tablet: 768px;
  --laptop: 1024px;
  --desktop: 1440px;
  ```

### Spacing Principles
- Use 8px grid for all spacing decisions
- Maintain consistent vertical rhythm
- Increase spacing with container size
- Use white space to create hierarchy

## Motion & Interaction

### Transitions
- Duration: 300ms
- Easing: cubic-bezier(0.4, 0, 0.2, 1)
- Properties: transform, opacity, background-color

### Hover States
- Scale: 1.02-1.05
- Add glow effect
- Increase shadow depth
- Smooth color transitions

### Loading States
- Pulsing animations
- Progress indicators
- Skeleton screens
- AI processing visualizations

## Accessibility

### Color Contrast
- Minimum contrast ratio: 4.5:1
- Large text contrast ratio: 3:1
- Interactive elements: 3:1

### Focus States
- Visible focus rings
- High contrast indicators
- Keyboard navigation support

### Typography
- Minimum body text size: 16px
- Line height: 1.5
- Maximum line length: 75 characters

## Implementation Guidelines

### CSS Architecture
- Use CSS custom properties
- BEM naming convention
- Utility classes for common patterns
- Component-based organization

### Responsive Design
- Mobile-first approach
- Fluid typography
- Flexible layouts
- Breakpoint consistency

### Performance
- Optimize animations
- Lazy load images
- Minimize CSS bundle
- Use modern CSS features

### Browser Support
- Modern browsers (last 2 versions)
- Progressive enhancement
- Fallback strategies
- Cross-browser testing 