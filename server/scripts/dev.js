import { watch } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import net from 'node:net'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const srcDir = path.join(projectRoot, 'src')

let child = null
let restartTimer = null
let shuttingDown = false
let restartAfterExit = false
const SERVER_PORT = 4000

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

async function waitForPortToClose(port, timeoutMs = 3000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (!(await isPortOpen(port))) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

function startServer() {
  if (shuttingDown || child) return

  child = spawn(process.execPath, ['src/index.js'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  })

  child.on('exit', (code, signal) => {
    child = null

    if (shuttingDown) {
      process.exit(code ?? (signal ? 1 : 0))
      return
    }

    if (restartAfterExit) {
      restartAfterExit = false
      waitForPortToClose(SERVER_PORT)
        .catch(() => {})
        .finally(() => startServer())
      return
    }

    if (code && code !== 0) {
      console.error(`[dev:api] server stopped unexpectedly with code ${code}. Waiting for file changes.`)
    }
  })
}

function scheduleRestart(reason) {
  if (shuttingDown) return
  if (restartTimer) clearTimeout(restartTimer)

  restartTimer = setTimeout(() => {
    restartTimer = null
    console.log(`[dev:api] restarting after ${reason}`)

    if (!child) {
      startServer()
      return
    }

    restartAfterExit = true
    child.kill()
  }, 150)
}

function shutdown() {
  shuttingDown = true
  if (restartTimer) clearTimeout(restartTimer)
  if (child) {
    child.kill()
    return
  }
  process.exit(0)
}

watch(srcDir, { recursive: true }, (_eventType, filename) => {
  scheduleRestart(filename || 'src change')
})

console.log('[dev:api] watching server/src')
startServer()

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
