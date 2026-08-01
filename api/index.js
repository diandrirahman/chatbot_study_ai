import createApp from '../server/src/app.js'

const app = createApp()

export default function handler(request, response) {
  const incomingUrl = new URL(request.url, 'http://localhost')
  const routedPath = incomingUrl.searchParams.get('__path') ?? ''
  incomingUrl.searchParams.delete('__path')
  const query = incomingUrl.searchParams.toString()

  request.url = `/api/${routedPath}${query ? `?${query}` : ''}`
  return app(request, response)
}
