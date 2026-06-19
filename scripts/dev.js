import { spawn } from 'node:child_process'
import net from 'node:net'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

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

function spawnWorkspace(name, args) {
  console.log(`[dev] starting ${name}`)
  return spawn(npmCommand, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: false,
  })
}

const processes = []

if (await isPortOpen(4000)) {
  console.log('[dev] API server already responds on http://localhost:4000')
} else {
  processes.push(spawnWorkspace('API server', ['run', 'dev', '-w', 'server']))
}

if (await isPortOpen(3000)) {
  console.log('[dev] Web server already responds on http://localhost:3000')
} else {
  processes.push(spawnWorkspace('web server', ['run', 'dev', '-w', 'web']))
}

if (processes.length === 0) {
  console.log('[dev] Both servers are already running.')
  process.exit(0)
}

let shuttingDown = false

function stopAll(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of processes) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

for (const child of processes) {
  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      console.error('[dev] One server stopped unexpectedly. Keeping any already-running external server untouched.')
      stopAll(code || 1)
    }
  })
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
