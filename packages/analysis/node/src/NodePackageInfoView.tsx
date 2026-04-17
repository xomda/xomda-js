import { defineComponent, type PropType } from 'vue'
import { VTable } from 'vuetify/components'

import type { NodePackageMeta } from './package-parser'

const DEP_TABLE = (title: string, deps: Record<string, string>) => {
  const entries = Object.entries(deps)
  if (entries.length === 0) return null
  return (
    <section>
      <div class="text-subtitle-2 mb-2">
        {title} ({entries.length})
      </div>
      <VTable density="compact" hover>
        {{
          default: () => (
            <>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([name, version]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>
                      <code>{version}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          ),
        }}
      </VTable>
    </section>
  )
}

/**
 * package.json "Info" tab. Renders the parsed manifest's identity,
 * scripts, and dependency tables. Receives the parsed payload from the
 * server-side `loadViewData` (parsePackageJson) via the `data` prop —
 * shows a small loading hint when the data hasn't arrived yet.
 */
export const NodePackageInfoView = defineComponent({
  name: 'NodePackageInfoView',
  props: {
    data: { type: Object as PropType<NodePackageMeta | null | undefined>, default: undefined },
  },
  setup(props) {
    return () => {
      const meta = props.data
      if (!meta) {
        return <div class="pa-4 text-disabled">Loading…</div>
      }

      const identityRows: Array<[string, string | undefined]> = [
        ['Name', meta.name],
        ['Version', meta.version],
        ['Description', meta.description],
        ['License', meta.license],
        ['Module type', meta.type],
        ['Main', meta.main],
        ['Module', meta.module],
        ['packageManager', meta.packageManager],
      ]

      return (
        <div class="pa-4 d-flex flex-column ga-4" style="overflow:auto; height:100%">
          <section>
            <div class="text-subtitle-2 mb-2">Package</div>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(120px, max-content) 1fr',
                gap: '0.25rem 1rem',
                fontSize: '0.9rem',
              }}
            >
              {identityRows
                .filter(([, value]) => !!value)
                .map(([key, value]) => (
                  <>
                    <dt style="opacity:0.7">{key}</dt>
                    <dd style="font-family:monospace; font-size:0.85rem; word-break:break-word">
                      {value}
                    </dd>
                  </>
                ))}
            </dl>
          </section>

          {Object.keys(meta.scripts).length > 0 ? (
            <section>
              <div class="text-subtitle-2 mb-2">Scripts ({Object.keys(meta.scripts).length})</div>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, max-content) 1fr',
                  gap: '0.25rem 1rem',
                  fontSize: '0.85rem',
                }}
              >
                {Object.entries(meta.scripts).map(([key, value]) => (
                  <>
                    <dt style="opacity:0.7">{key}</dt>
                    <dd style="font-family:monospace; word-break:break-word">{value}</dd>
                  </>
                ))}
              </dl>
            </section>
          ) : null}

          {meta.workspaces.length > 0 ? (
            <section>
              <div class="text-subtitle-2 mb-2">Workspaces ({meta.workspaces.length})</div>
              <ul style="margin:0; padding-left:1.25rem">
                {meta.workspaces.map((w) => (
                  <li key={w}>
                    <code>{w}</code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {DEP_TABLE('Dependencies', meta.dependencies)}
          {DEP_TABLE('Dev dependencies', meta.devDependencies)}
          {DEP_TABLE('Peer dependencies', meta.peerDependencies)}
          {DEP_TABLE('Optional dependencies', meta.optionalDependencies)}
        </div>
      )
    }
  },
})
