import DOMPurify from 'dompurify'
import { marked } from 'marked'

const SUPERSCRIPT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ' }
const SUBSCRIPT = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' }
const mapScript = (value, characters) => [...value].map((character) => characters[character] ?? character).join('')
const normalizeCommonCommands = (value) => value
  .replace(/\\times\b/g, '×')
  .replace(/\\div\b/g, '÷')

export function normalizeStudyNotation(markdown) {
  const normalizedMath = String(markdown ?? '').replace(/\$([^$\n]+)\$/g, (wrapped, expression) => {
    if (!/[\\^_=+\-*/<>]/.test(expression) && !/^[A-Za-z][A-Za-z0-9]*$/.test(expression.trim())) return wrapped
    return expression
      .replace(/\\(?:text|mathrm|mathbf|ce)\{([^{}]+)\}/g, '$1')
      .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
      .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
      .replace(/\\(?:rightarrow|to)\b/g, '→')
      .replace(/\\times\b/g, '×')
      .replace(/\\cdot\b/g, '·')
      .replace(/\\pm\b/g, '±')
      .replace(/\\(?:leq|le)\b/g, '≤')
      .replace(/\\(?:geq|ge)\b/g, '≥')
      .replace(/\\neq\b/g, '≠')
      .replace(/\^(?:\{)?\\circ(?:\})?/g, '°')
      .replace(/\^\{([^{}]+)\}/g, (_match, value) => mapScript(value, SUPERSCRIPT))
      .replace(/\^([0-9+\-=()ni]+)/g, (_match, value) => mapScript(value, SUPERSCRIPT))
      .replace(/_\{([^{}]+)\}/g, (_match, value) => mapScript(value, SUBSCRIPT))
      .replace(/_([0-9+\-=()]+)/g, (_match, value) => mapScript(value, SUBSCRIPT))
  })
  return normalizeCommonCommands(normalizedMath)
}

export function renderSafeMarkdown(markdown) {
  const unsafeHtml = marked.parse(normalizeStudyNotation(markdown), { gfm: true })
  const purifier = DOMPurify(globalThis.window)
  return purifier.sanitize(unsafeHtml, { USE_PROFILES: { html: true } })
}
