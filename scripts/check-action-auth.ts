/**
 * Guards against Server Actions shipping without an auth check.
 *
 * Every exported async function in a `'use server'` file must either:
 *   1. Call one of the auth guards from lib/auth.ts as its first statement, or
 *   2. Delegate to another exported function in the same file that does (1).
 *
 * This is a heuristic regex-based scan, not a type-aware AST check — it is meant
 * to catch the common mistake (a brand new mutation with zero auth call) rather
 * than prove exhaustive correctness. Run via `npm run check:action-auth`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const GUARD_CALLS = [
  'requireAuth',
  'requireRole',
  'requireSuperAdmin',
  'requireAdminMutator',
  'requireManager',
  'requireVA',
  'getAdmin', // local wrapper around requireAdminMutator() used in admin/users/actions.ts
]

const GUARD_PATTERN = new RegExp(`\\b(${GUARD_CALLS.join('|')})\\s*\\(`)

function findActionFiles(dir: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      findActionFiles(fullPath, results)
    } else if (entry.name === 'actions.ts') {
      results.push(fullPath)
    }
  }
  return results
}

function splitTopLevelFunctions(source: string): { name: string; body: string }[] {
  const results: { name: string; body: string }[] = []
  const fnHeader = /export\s+async\s+function\s+(\w+)\s*\([^)]*\)[^{]*\{/g
  let match: RegExpExecArray | null

  while ((match = fnHeader.exec(source))) {
    const name = match[1]
    const bodyStart = match.index + match[0].length
    let depth = 1
    let i = bodyStart
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') depth--
      i++
    }
    results.push({ name, body: source.slice(bodyStart, i - 1) })
  }

  return results
}

function main() {
  const files = findActionFiles(path.join(process.cwd(), 'app'))
  const violations: { file: string; fn: string }[] = []

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    if (!source.includes("'use server'")) continue

    const fns = splitTopLevelFunctions(source)
    const guarded = new Set<string>()
    const delegatesTo = new Map<string, string[]>()

    for (const { name, body } of fns) {
      if (GUARD_PATTERN.test(body)) {
        guarded.add(name)
        continue
      }
      const calledLocalFns = fns
        .map((f) => f.name)
        .filter((otherName) => otherName !== name && new RegExp(`\\b${otherName}\\s*\\(`).test(body))
      delegatesTo.set(name, calledLocalFns)
    }

    // Resolve delegation chains (handles the *ByForm() -> real action pattern).
    let changed = true
    while (changed) {
      changed = false
      for (const [name, callees] of delegatesTo) {
        if (guarded.has(name)) continue
        if (callees.some((c) => guarded.has(c))) {
          guarded.add(name)
          changed = true
        }
      }
    }

    for (const { name } of fns) {
      if (!guarded.has(name)) {
        violations.push({ file, fn: name })
      }
    }
  }

  if (violations.length > 0) {
    console.error('Server Actions missing an auth guard (or a delegation to one):\n')
    for (const v of violations) {
      console.error(`  ${path.relative(process.cwd(), v.file)} — ${v.fn}()`)
    }
    console.error(
      `\n${violations.length} violation(s). Add a call to one of: ${GUARD_CALLS.join(', ')} as the first statement, or delegate to a function that does.`
    )
    process.exit(1)
  }

  console.log(`check-action-auth: OK — scanned ${files.length} file(s), all exported Server Actions are guarded.`)
}

main()
