import { createHash } from 'crypto'
import { readFileSync } from 'fs'

export function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

export function sha256String(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}
