import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import handler from '../../api/index.js'

async function withAdapter(callback) {
  const server = http.createServer(handler).listen(0)
  try { await callback(`http://127.0.0.1:${server.address().port}`) } finally { server.close() }
}

test('Vercel adapter restores the public health endpoint path', async () => {
  await withAdapter(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/index?__path=health`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { success: true, message: 'StudyMate AI API is running' })
  })
})

test('Vercel adapter preserves the existing invalid request contract', async () => {
  await withAdapter(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/index?__path=chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'INVALID_REQUEST')
  })
})
