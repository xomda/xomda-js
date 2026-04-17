import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { wrapper } from '../wrapper'

const FAKE_XOMDA_BIN = `#!/usr/bin/env node
process.stdout.write('XOMDA_OK ' + process.argv.slice(2).join(' ') + '\\n')
`

const FAKE_XOMDA_PKG = {
  name: 'xomda',
  version: '0.0.0-test',
  bin: { xomda: 'bin.js' },
}

describe('wrapper e2e: xomdaw bootstraps and execs xomda', () => {
  let workDir: string
  let fakeXomda: string
  let project: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'xomda-wrapper-e2e-'))
    fakeXomda = join(workDir, 'fake-xomda')
    project = join(workDir, 'project')

    await mkdir(fakeXomda, { recursive: true })
    await writeFile(join(fakeXomda, 'package.json'), JSON.stringify(FAKE_XOMDA_PKG, null, 2))
    await writeFile(join(fakeXomda, 'bin.js'), FAKE_XOMDA_BIN)

    await mkdir(project, { recursive: true })
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  it('generates xomdaw scripts and they exec the bootstrapped xomda', async () => {
    const spec = `file:${fakeXomda}`
    await wrapper(project, { version: spec })

    const xomdaw = join(project, 'xomdaw')
    expect(existsSync(xomdaw)).toBe(true)

    const run = spawnSync('sh', [xomdaw, 'hello', 'world'], {
      cwd: project,
      encoding: 'utf-8',
    })

    if (run.status !== 0) {
      throw new Error(`xomdaw exited ${run.status}\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`)
    }
    expect(run.stdout).toContain('XOMDA_OK hello world')

    expect(
      existsSync(join(project, '.xomda', 'wrapper', 'node_modules', 'xomda', 'package.json'))
    ).toBe(true)
  })

  it('re-bootstraps after the cache is wiped', async () => {
    const spec = `file:${fakeXomda}`
    await wrapper(project, { version: spec })
    const xomdaw = join(project, 'xomdaw')

    let run = spawnSync('sh', [xomdaw], { cwd: project, encoding: 'utf-8' })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain('XOMDA_OK')

    await rm(join(project, '.xomda', 'wrapper', 'node_modules'), { recursive: true, force: true })

    run = spawnSync('sh', [xomdaw, 'second'], { cwd: project, encoding: 'utf-8' })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain('XOMDA_OK second')
    expect(
      existsSync(join(project, '.xomda', 'wrapper', 'node_modules', 'xomda', 'package.json'))
    ).toBe(true)
  })

  it('fails with a helpful message when the config is missing', async () => {
    await wrapper(project, { version: `file:${fakeXomda}` })
    await rm(join(project, '.xomda', 'wrapper', 'xomda-wrapper.json'))

    const run = spawnSync('sh', [join(project, 'xomdaw')], { cwd: project, encoding: 'utf-8' })
    expect(run.status).not.toBe(0)
    expect(run.stderr).toContain('missing')
    expect(run.stderr).toContain('xomda-wrapper.json')
  })
})
