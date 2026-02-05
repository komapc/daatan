# i18n Setup Requirements

## Overview
Set up internationalization (i18n) infrastructure for DAATAN to support multiple languages, starting with English (en) and Hebrew (he). No translations in this phase - just the framework.

## User Stories

### As a user
- I want to select my preferred language
- I want the UI to remember my language choice
- I want the language to persist across sessions

### As a developer
- I want a simple way to mark strings for translation
- I want type-safe translation keys
- I want to add new languages easily

## Technical Approach

### Library Selection
**next-intl** - Recommended for Next.js 14 App Router
- Native App Router support
- Server Component compatible
- Type-safe translations
- Automatic locale detection
- Small bundle size

### Alternative Considered
- `next-i18next` - Older, Pages Router focused
- `react-intl` - More complex setup
- Custom solution - Reinventing the wheel

## Architecture

### URL Structure
**Option 1: Subdirectory** (Recommended)
```
/en/profile
/he/profile
```

**Option 2: Domain**
```
en.daatan.com
he.daatan.com
```

**Option 3: Query Parameter**
```
/profile?lang=en
/profile?lang=he
```

**Decision**: Use subdirectory approach - SEO friendly, clear, standard

### File Structure
```
src/
  i18n/
    locales/
      en.json          # English translations
      he.json          # Hebrew translations
    config.ts          # i18n configuration
    request.ts         # Server-side locale detection
  app/
    [locale]/          # Locale-based routing
      layout.tsx       # Root layout with locale
      page.tsx         # Home page
      profile/
        page.tsx
      ...
```

### Locale Detection Priority
1. URL path (`/he/...`)
2. User preference (DB: `preferredLanguage`)
3. Cookie (`NEXT_LOCALE`)
4. Accept-Language header
5. Default to English

## Database Integration

### User Model (Already Added)
```prisma
model User {
  preferredLanguage String @default("en") @db.VarChar(10)
}
```

### API Endpoint
```
PATCH /api/profile/language
Body: { language: "en" | "he" }
```

## Implementation Steps

### Phase 1: Infrastructure
1. Install `next-intl`
2. Create locale files (empty for now)
3. Set up `[locale]` routing
4. Configure middleware for locale detection
5. Update layout to provide locale context

### Phase 2: Integration
1. Add language selector component
2. Create API endpoint to save preference
3. Update profile edit page with language option
4. Test locale switching

### Phase 3: Developer Experience
1. Create translation helper functions
2. Add TypeScript types for translation keys
3. Document how to add new strings
4. Create example components

## Configuration

### next-intl Config
```typescript
// src/i18n/config.ts
export const locales = ['en', 'he'] as const
export type Locale = typeof locales[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  he: 'עברית'
}
```

### Middleware
```typescript
// src/middleware.ts
import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './i18n/config'

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always' // Always show locale in URL
})

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}
```

## Translation File Structure

### English (en.json)
```json
{
  "common": {
    "loading": "Loading...",
    "error": "Error",
    "save": "Save",
    "cancel": "Cancel"
  },
  "nav": {
    "home": "Home",
    "profile": "Profile",
    "predictions": "Predictions"
  },
  "profile": {
    "title": "Profile",
    "edit": "Edit Profile",
    "settings": "Settings"
  }
}
```

### Hebrew (he.json)
```json
{
  "common": {
    "loading": "טוען...",
    "error": "שגיאה",
    "save": "שמור",
    "cancel": "ביטול"
  },
  "nav": {
    "home": "בית",
    "profile": "פרופיל",
    "predictions": "תחזיות"
  },
  "profile": {
    "title": "פרופיל",
    "edit": "ערוך פרופיל",
    "settings": "הגדרות"
  }
}
```

## Usage Examples

### Server Component
```typescript
import { useTranslations } from 'next-intl'

export default function ProfilePage() {
  const t = useTranslations('profile')
  
  return <h1>{t('title')}</h1>
}
```

### Client Component
```typescript
'use client'
import { useTranslations } from 'next-intl'

export default function SaveButton() {
  const t = useTranslations('common')
  
  return <button>{t('save')}</button>
}
```

## RTL Support for Hebrew

### CSS Changes
```css
html[dir="rtl"] {
  direction: rtl;
}

html[dir="rtl"] .sidebar {
  left: auto;
  right: 0;
}
```

### Layout Update
```typescript
<html lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'}>
```

## Language Selector Component

### Location
- Profile edit page
- Sidebar footer (optional)
- Settings page

### UI
```typescript
<select value={currentLocale} onChange={handleChange}>
  <option value="en">English</option>
  <option value="he">עברית</option>
</select>
```

## Acceptance Criteria

### Must Have
1. `next-intl` installed and configured
2. Locale-based routing (`/en/...`, `/he/...`)
3. Empty translation files for en and he
4. Middleware for locale detection
5. Language selector in profile edit
6. API endpoint to save language preference
7. Locale persists across sessions

### Should Have
1. TypeScript types for translation keys
2. RTL support for Hebrew
3. Locale detection from user preference
4. Cookie-based locale storage
5. Documentation for adding translations

### Could Have
1. Automatic locale detection from browser
2. Language selector in sidebar
3. Translation management tool integration
4. Pluralization support
5. Date/number formatting per locale

## Dependencies

### NPM Packages
```json
{
  "next-intl": "^3.0.0"
}
```

## Migration Strategy

### Step 1: Install & Configure
- Install next-intl
- Create config files
- Set up middleware

### Step 2: Restructure Routes
- Move all routes under `[locale]` directory
- Update imports and links
- Test routing

### Step 3: Add Language Selector
- Create selector component
- Add to profile edit page
- Create API endpoint

### Step 4: Test
- Test locale switching
- Test persistence
- Test RTL layout

## SEO Considerations

### Hreflang Tags
```html
<link rel="alternate" hreflang="en" href="https://daatan.com/en/profile" />
<link rel="alternate" hreflang="he" href="https://daatan.com/he/profile" />
<link rel="alternate" hreflang="x-default" href="https://daatan.com/en/profile" />
```

### Sitemap
Generate separate sitemaps for each locale or include all locales in one sitemap with proper hreflang annotations.

## Open Questions
1. Should we redirect `/` to `/en` or detect locale?
2. Do we want language selector in sidebar or only in settings?
3. Should we support more languages in the future? (Arabic, Russian, etc.)
4. Do we need professional translations or community-driven?

## Recommendation
**Proceed with next-intl** - It's the modern standard for Next.js 14 App Router, has excellent TypeScript support, and handles both Server and Client Components seamlessly.

## Phase Scope
**This phase**: Infrastructure only
- Install and configure next-intl
- Set up routing and middleware
- Add language selector
- Create empty translation files

**Next phase**: Actual translations
- Translate all UI strings
- Add RTL styling
- Test with native speakers
