import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const cwd = process.cwd()
const nextDir = path.join(cwd, 'web', '.next')
const args = new Set(process.argv.slice(2))
const skipPorts = args.has('--skip-ports')
const skipNext = args.has('--skip-next')
const keepApi = args.has('--keep-api')

function listWindowsPidsForPort(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line.includes('LISTENING'))
      .map((line) => line.split(/\s+/).pop())
      .filter((value) => /^\d+$/.test(value))
  } catch {
    return []
  }
}

function killPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, {
      cwd,
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

async function removeNextDir() {
  try {
    await fs.rm(nextDir, { recursive: true, force: true })
    console.log(`[reset-local] removed ${nextDir}`)
  } catch (error) {
    console.warn(`[reset-local] could not remove .next: ${error.message}`)
  }
}

function stopPorts() {
  const ports = keepApi ? [3000] : [3000, 4000]
  const seen = new Set()

  for (const port of ports) {
    const pids = listWindowsPidsForPort(port)
    for (const pid of pids) {
      if (seen.has(pid)) continue
      seen.add(pid)
      const stopped = killPid(pid)
      if (stopped) {
        console.log(`[reset-local] stopped PID ${pid} on port ${port}`)
      }
    }
  }
}

if (process.platform === 'win32' && !skipPorts) {
  stopPorts()
}

if (!skipNext) {
  await removeNextDir()
}

console.log('[reset-local] done')
