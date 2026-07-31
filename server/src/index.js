import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import app from './app.js'

dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
})

const port = Number(process.env.PORT) || 3000

app.listen(port, () => {
  console.info(`StudyMate AI API listening on http://localhost:${port}`)
})
