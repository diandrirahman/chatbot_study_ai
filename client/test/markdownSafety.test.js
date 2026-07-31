import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'

global.window = new JSDOM('').window
global.document = global.window.document
const { normalizeStudyNotation, renderSafeMarkdown } = await import('../src/utils/renderMarkdown.js')

test('renders headings, lists, tables, and code blocks', () => {
  const html = renderSafeMarkdown('# Plan\n\n- Practice\n- Review\n\n| Day | Focus |\n| --- | --- |\n| 1 | JSX |\n\n```js\nconst study = true\n```')
  assert.match(html, /<h1>Plan<\/h1>/); assert.match(html, /<li>Practice<\/li>/); assert.match(html, /<table>/); assert.match(html, /<pre><code class="language-js">/)
})

test('removes scripts and event handlers before HTML is displayed', () => {
  const html = renderSafeMarkdown('# Safe\n\n<script>globalThis.compromised = true</script>\n<img src="x" onerror="globalThis.compromised = true">')
  assert.doesNotMatch(html, /<script|onerror|compromised/i)
  assert.equal(global.window.compromised, undefined)
})

test('renders common scientific notation without exposing raw LaTeX', () => {
  const markdown = '**Hibridisasi:** $sp^3$, $sp^2$, $sp$, $CH_4$, $C_2H_4$, dan sudut $109,5^\\circ$.'
  const normalized = normalizeStudyNotation(markdown)
  const html = renderSafeMarkdown(markdown)
  assert.equal(normalized, '**Hibridisasi:** sp³, sp², sp, CH₄, C₂H₄, dan sudut 109,5°.')
  assert.match(html, /<strong>Hibridisasi:<\/strong> sp³, sp², sp, CH₄, C₂H₄, dan sudut 109,5°/)
  assert.doesNotMatch(html, /\$|\\circ|\^3|_4/)
})

test('normalizes common multiplication and division commands outside math delimiters', () => {
  const normalized = normalizeStudyNotation('25 \\times 4 dan 100 \\div 2')
  assert.equal(normalized, '25 × 4 dan 100 ÷ 2')
  assert.doesNotMatch(renderSafeMarkdown(normalized), /\\(?:times|div)/)
})
