import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type Cypress from 'cypress'

import {
  addMarkdown,
  type AddMarkdownOptions,
  addMavenProject,
  type AddMavenProjectOptions,
  addSamplePackage,
  type AddSamplePackageOptions,
  addTemplate,
  type AddTemplateOptions,
  buildSandbox,
} from '../../sandbox/buildSandbox'

const __dirname = dirname(fileURLToPath(import.meta.url))
/**
 * Same path the `setup:sandbox` npm script writes to. Hardcoded so the
 * server (`--cwd target/sandbox`) and the Cypress task layer agree without
 * a runtime handshake.
 */
const SANDBOX_DIR = resolve(__dirname, '..', '..', 'target', 'sandbox')

/**
 * Register the `sandbox:*` Cypress tasks that delegate to the sandbox
 * primitives. Call from `setupNodeEvents` in cypress.config.ts.
 *
 * Tasks return `null` to keep Cypress's "no undefined returns" rule happy.
 */
export function registerSandboxTasks(on: Cypress.PluginEvents): void {
  on('task', {
    async 'sandbox:reset'(): Promise<null> {
      await buildSandbox(SANDBOX_DIR, { clean: true })
      return null
    },
    async 'sandbox:addPackage'(opts: AddSamplePackageOptions): Promise<null> {
      await addSamplePackage(SANDBOX_DIR, opts)
      return null
    },
    async 'sandbox:addMavenProject'(opts: AddMavenProjectOptions): Promise<null> {
      await addMavenProject(SANDBOX_DIR, opts)
      return null
    },
    async 'sandbox:addMarkdown'(opts: AddMarkdownOptions): Promise<null> {
      await addMarkdown(SANDBOX_DIR, opts)
      return null
    },
    async 'sandbox:addTemplate'(opts: AddTemplateOptions): Promise<null> {
      await addTemplate(SANDBOX_DIR, opts)
      return null
    },
  })
}
