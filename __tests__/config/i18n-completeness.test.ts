/**
 * i18n completeness tests
 *
 * 1. Key parity — en.json and he.json must have identical key sets.
 *    Prevents a translation being added in one locale but forgotten in another.
 *
 * 2. Source coverage — every static t('key') call paired with a
 *    useTranslations('namespace') in source files must resolve to a real key
 *    in en.json. Prevents MISSING_MESSAGE console errors at runtime.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROOT = join(__dirname, '../..')

function loadJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

/** Flatten a nested object to dot-notation keys: { a: { b: 1 } } → ['a.b'] */
function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k
    return v !== null && typeof v === 'object' && !Array.isArray(v)
      ? flatKeys(v as Record<string, unknown>, full)
      : [full]
  })
}

/** Read all .ts/.tsx source files under src/ recursively */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) return [full]
    return []
  })
}

// ─── Load message files ───────────────────────────────────────────────────────

const en = loadJson(join(ROOT, 'messages/en.json'))
const he = loadJson(join(ROOT, 'messages/he.json'))
const enKeys = new Set(flatKeys(en))
const heKeys = new Set(flatKeys(he))

// ─── Test 1: Key parity ───────────────────────────────────────────────────────

describe('i18n key parity (en ↔ he)', () => {
  it('en.json has no keys missing from he.json', () => {
    const missing = [...enKeys].filter(k => !heKeys.has(k))
    expect(missing, `Keys in en.json but missing from he.json:\n${missing.join('\n')}`).toEqual([])
  })

  it('he.json has no keys missing from en.json', () => {
    const extra = [...heKeys].filter(k => !enKeys.has(k))
    expect(extra, `Keys in he.json but missing from en.json:\n${extra.join('\n')}`).toEqual([])
  })
})

// ─── Test 2: Source coverage ──────────────────────────────────────────────────

/**
 * Extract all static translator('key') calls from a source file.
 * Maps each const variable assigned from useTranslations('ns') to its
 * namespace, then matches variable('key') call sites.
 *
 * Handles files with multiple translators:
 *   const t = useTranslations('forecast')
 *   const c = useTranslations('common')
 *   t('deadline') → forecast.deadline
 *   c('loading')  → common.loading
 *
 * Limitations (acceptable):
 * - Dynamic keys like t(variable) or t(`${x}`) are skipped.
 */
function extractTranslationUsages(source: string): { namespace: string; key: string }[] {
  // Build variable → namespace map
  const varToNs = new Map<string, string>()
  const nsRe = /const\s+(\w+)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g
  let m: RegExpExecArray | null
  while ((m = nsRe.exec(source)) !== null) varToNs.set(m[1], m[2])
  if (varToNs.size === 0) return []

  const usages: { namespace: string; key: string }[] = []
  // Match varName('key') — varName must be one of our translator variables
  const varPattern = [...varToNs.keys()].join('|')
  const tRe = new RegExp(`\\b(${varPattern})\\(\\s*'([^']+)'\\s*\\)`, 'g')
  while ((m = tRe.exec(source)) !== null) {
    const [, varName, key] = m
    // Skip keys that look like test strings or punctuation
    if (/^[\s.,!?:;/\\0-9%+\-]/.test(key)) continue
    usages.push({ namespace: varToNs.get(varName)!, key })
  }
  return usages
}

describe('i18n source coverage (static t() calls resolve in en.json)', () => {
  it('all static t() calls map to existing en.json keys', () => {
    const files = sourceFiles(join(ROOT, 'src'))
    const missing: string[] = []

    for (const file of files) {
      const source = readFileSync(file, 'utf-8')
      const usages = extractTranslationUsages(source)
      for (const { namespace, key } of usages) {
        const full = `${namespace}.${key}`
        if (!enKeys.has(full)) {
          const rel = file.replace(ROOT + '/', '')
          missing.push(`  ${rel}: t('${key}') → "${full}" not found`)
        }
      }
    }

    expect(
      missing,
      `Missing i18n keys detected:\n${missing.join('\n')}\n\nAdd them to messages/en.json (and messages/he.json).`
    ).toEqual([])
  })
})
