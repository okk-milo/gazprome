import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('page declares the bundled SVG favicon', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/images\/milo-logo-mark\.svg"\s*\/>/)

  const icon = await readFile(new URL('../public/images/milo-logo-mark.svg', import.meta.url), 'utf8')
  assert.match(icon, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.match(icon, /viewBox="0 0 40 40"/)
  assert.match(icon, /aria-label="M\.I\.L\.O\."/)
})
