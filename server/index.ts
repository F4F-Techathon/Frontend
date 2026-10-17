import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { createIntakeHandler } from './intake.ts'

for (const file of ['.env', '.env.local']) if (existsSync(file)) process.loadEnvFile(file)
const root = resolve('dist')
if (!existsSync(resolve(root, 'index.html'))) throw new Error('Run npm run build before npm start')
const intake = createIntakeHandler({ apiKey: process.env.LLM_API_KEY || '', baseUrl: process.env.LLM_BASE_URL || '', model: process.env.LLM_MODEL || '' })
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.png': 'image/png' }

// Serve the built SPA and its API together so production never depends on Vite's dev proxy.
const server = createServer((request, response) => {
  void intake(request, response, () => {
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return }
    let path
    try { path = resolve(root, '.' + decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)) }
    catch { response.writeHead(400); response.end(); return }
    if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return }
    if (!existsSync(path) || !statSync(path).isFile()) {
      if (extname(path) || request.url?.startsWith('/api/')) { response.writeHead(404); response.end(); return }
      path = resolve(root, 'index.html')
    }
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' })
    if (request.method === 'HEAD') response.end()
    else createReadStream(path).pipe(response)
  })
})
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => console.log(`Dining app listening on port ${(server.address() as { port: number }).port}`))
