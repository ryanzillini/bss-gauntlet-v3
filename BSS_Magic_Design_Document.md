# BSS Magic Design Document

## 1. Brand Identity

### 1.1 Brand Overview
BSS Magic is a modern, AI-powered Business Support System (BSS) solution that offers streamlined management of telecommunications adapters, endpoints, and services. The brand presents a professional yet innovative image, combining cutting-edge AI capabilities with intuitive user interfaces.

### 1.2 Logo
- **Primary Logo**: Totogi logo paired with "BSS Magic" text
- **Text Style**: "BSS Magic" uses a gradient effect transitioning from coral pink through purple to blue
- **Logo Lockup**: The Totogi logo and "BSS Magic" text are separated by a subtle vertical divider

## 2. Color Palette

### 2.1 Primary Colors
```css
--totogi-purple: #9747FF;      /* Main brand color */
--electric-blue: #00A3FF;      /* Secondary accent */
--coral-pink: #FF5C72;         /* CTA & highlights */
--dark-navy: #0A1929;          /* Background */
--pure-white: #FFFFFF;         /* Text & UI elements */
```

### 2.2 Gradient Combinations
```css
--primary-gradient: linear-gradient(135deg, #9747FF 0%, #00A3FF 100%);
--accent-gradient: linear-gradient(135deg, #FF5C72 0%, #9747FF 100%);
--dark-gradient: linear-gradient(180deg, #0A1929 0%, #1A2B3B 100%);
```

### 2.3 UI State Colors
```css
--success: #2ECC71;            /* Green for success messages */
--warning: #F1C40F;            /* Yellow for warnings */
--error: #E74C3C;              /* Red for errors */
--info: #3498DB;               /* Blue for information */
```

### 2.4 Method-Specific Colors (API Methods)
```css
GET: #2ECC71 (green-500)       /* Safe, read-only operations */
POST: #3498DB (blue-500)       /* Create operations */
PUT: #F1C40F (amber-500)       /* Update operations */
DELETE: #E74C3C (red-500)      /* Delete operations */
PATCH: #9747FF (purple-500)    /* Partial update operations */
```

## 3. Typography

### 3.1 Font Families
```css
--primary-font: 'Inter', sans-serif;      /* Main text */
--display-font: 'Space Grotesk', sans-serif;  /* Headings */
--code-font: 'Fira Code', monospace;      /* Code blocks */
```

### 3.2 Type Scale
```css
--h1: 3rem;    /* 48px - Main headlines */
--h2: 2.5rem;  /* 40px - Section headers */
--h3: 2rem;    /* 32px - Subsections */
--h4: 1.5rem;  /* 24px - Card titles */
--body: 1rem;  /* 16px - Body text */
--small: 0.875rem; /* 14px - Supporting text */
```

### 3.3 Font Weights
- **Regular**: 400 - Body text
- **Medium**: 500 - Emphasis
- **Semibold**: 600 - Subheadings
- **Bold**: 700 - Headings, important UI elements

### 3.4 Text Styles
- **Gradient Text**: Used for brand elements and key highlights
  ```css
  .gradient-text {
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  ```
- **Monospace**: Used for API paths, endpoints, and code snippets

## 4. Component Design

### 4.1 Cards

#### 4.1.1 Adapter Cards
- **Background**: Translucent glass effect with subtle gradient
- **Border**: 1px border with 10% opacity of brand colors
- **Border Radius**: 12px (rounded-xl)
- **Header**: Contains icon (Product/Customer/Service) and title
- **Hover Effect**: Subtle glow with increased border opacity

#### 4.1.2 Glass Cards
```css
.glass-card {
  background: rgba(10, 25, 41, 0.3);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(151, 71, 255, 0.2);
  border-radius: 12px;
}

.glass-card:hover {
  border-color: rgba(151, 71, 255, 0.4);
  box-shadow: 0 0 20px rgba(151, 71, 255, 0.2);
}
```

### 4.2 Buttons

#### 4.2.1 Primary Button
```css
.btn-primary {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  background: linear-gradient(135deg, #9747FF 0%, #00A3FF 100%);
  color: #FFFFFF;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(151, 71, 255, 0.3);
}
```

#### 4.2.2 Secondary Button
```css
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  border-color: rgba(151, 71, 255, 0.6);
  background: rgba(151, 71, 255, 0.1);
}
```

### 4.3 Navigation

#### 4.3.1 Sidebar Navigation
- **Background**: Dark gradient with glass effect
- **Active Item**: Highlighted with brand purple
- **Icons**: Outlined style, 24px
- **Hover Effect**: Subtle background highlight

#### 4.3.2 Breadcrumbs
- **Separator**: Custom chevron icon
- **Current Page**: White text
- **Previous Pages**: 70% opacity white text, hover effect to full opacity

### 4.4 Form Elements

#### 4.4.1 Text Inputs
```css
.input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  padding: 0.625rem 1rem;
  color: #FFFFFF;
  transition: all 0.3s ease;
}

.input:focus {
  border-color: rgba(151, 71, 255, 0.6);
  box-shadow: 0 0 0 2px rgba(151, 71, 255, 0.3);
  outline: none;
}
```

#### 4.4.2 Dropdowns
- **Styling**: Similar to text inputs
- **Dropdown Menu**: Dark background with lighter hover states
- **Selected Item**: Highlighted with brand purple

## 5. Layout

### 5.1 Grid System
- **Type**: 12-column grid
- **Gutter**: 24px
- **Container Max Width**: 1440px

### 5.2 Spacing Scale
```css
--space-xs: 0.25rem;   /*  4px */
--space-sm: 0.5rem;    /*  8px */
--space-md: 1rem;      /* 16px */
--space-lg: 1.5rem;    /* 24px */
--space-xl: 2rem;      /* 32px */
--space-2xl: 3rem;     /* 48px */
```

### 5.3 Responsive Breakpoints
```css
--mobile: 375px;
--tablet: 768px;
--laptop: 1024px;
--desktop: 1440px;
```

### 5.4 Page Structure
- **Header**: Fixed position, contains logo and global navigation
- **Sidebar**: Left-aligned, collapsible on mobile
- **Content Area**: Fluid width with max-width constraint
- **Dashboard Layout**: Grid of cards with responsive behavior

## 6. Visual Effects

### 6.1 Shadows
```css
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.12);
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.15);
--shadow-glow: 0 0 20px rgba(151, 71, 255, 0.3);
```

### 6.2 Transitions & Animations
- **Default Transition**: 0.3s cubic-bezier(0.4, 0, 0.2, 1)
- **Hover Animations**: Subtle scale (1.02-1.05) + shadow increase
- **Loading Animation**: Pulsing opacity or rotating gradient

### 6.3 Glassmorphism
- **Backdrop Filter**: blur(12px)
- **Background**: Semi-transparent (10-30% opacity)
- **Border**: 1px with gradient or 20% white/purple

## 7. Icons & Imagery

### 7.1 Icon System
- **Style**: Outlined, 2px stroke weight
- **Sizes**: 16px (small), 24px (default), 32px (large)
- **Colors**: Pure white or brand colors

### 7.2 Category Icons
- **Product**: Box/cube icon
- **Customer**: Person/user icon
- **Service**: Wrench/settings icon

### 7.3 Method Icons
- **GET**: Download/arrow-down icon
- **POST**: Plus/add icon
- **PUT**: Pencil/edit icon
- **DELETE**: Trash/bin icon
- **PATCH**: Paintbrush/edit-partial icon

## 8. Implementation Guidelines

### 8.1 CSS Architecture
- **Framework**: Tailwind CSS with custom extensions
- **Custom Properties**: Used for colors, spacing, and typography
- **Component Classes**: Follow BEM-like naming
- **Utility Classes**: Used for common patterns and quick adjustments

### 8.2 Responsive Design
- **Approach**: Mobile-first design
- **Fluid Typography**: Scales with viewport
- **Layout Changes**: Card grid adjusts columns at breakpoints

### 8.3 Accessibility
- **Color Contrast**: Minimum 4.5:1 for text, 3:1 for large text and UI elements
- **Focus States**: Visible indicators for keyboard navigation
- **Screen Readers**: Proper aria attributes and semantic HTML

## 9. Application-Specific Components

### 9.1 Adapter Cards
- **Purpose**: Display available adapters by category
- **Visual**: Glass card with category icon and title
- **States**: Configured vs. unconfigured (highlighted differently)

### 9.2 Endpoint Display
- **Method Badge**: Colored to match HTTP method
- **Path Display**: Monospace font for API paths
- **Description**: Regular text with proper spacing

### 9.3 Configuration Status
- **Progress Indicator**: Circular or linear progress showing percentage
- **Status Text**: Percentage with "configured" label
- **Color Coding**: Uses success green for complete items

## 10. File Organization

### 10.1 Component Structure
```
src/
├── components/
│   ├── common/           # Shared UI components like buttons, inputs
│   ├── layout/           # Layout components like header, sidebar
│   └── [feature]/        # Feature-specific components 
├── styles/
│   ├── globals.css       # Global styles and variables
│   └── components/       # Component-specific styles (if not co-located)
```

### 10.2 Assets
```
public/
├── images/
│   ├── logo/             # Logo variations
│   ├── icons/            # SVG icons
│   └── backgrounds/      # Background patterns/images
└── fonts/                # Self-hosted fonts
``` 