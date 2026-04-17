import { defineComponent, type PropType } from 'vue'
import { VTable } from 'vuetify/components'

import type { PomMeta } from './pom-parser'

/**
 * Renders the parsed POM as a read-only info panel: identity, modules,
 * dependencies, build plugins. The host pipeline (file browser preview
 * tab) loads the data via `project.viewData` and hands it in as the
 * `data` prop; we accept `unknown` and narrow defensively so a missing
 * or partially-shaped payload doesn't blow up the surrounding tab bar.
 */
export const MavenPomInfoView = defineComponent({
  name: 'MavenPomInfoView',
  props: {
    data: { type: Object as PropType<PomMeta | null | undefined>, default: undefined },
  },
  setup(props) {
    return () => {
      const meta = props.data
      if (!meta) {
        return <div class="pa-4 text-disabled">Loading…</div>
      }

      const identityRows: Array<[string, string | undefined]> = [
        ['Group', meta.groupId],
        ['Artifact', meta.artifactId],
        ['Version', meta.version],
        ['Packaging', meta.packaging],
        ['Name', meta.name],
        ['Description', meta.description],
      ]

      return (
        <div class="pa-4 d-flex flex-column ga-4" style="overflow:auto; height:100%">
          <section>
            <div class="text-subtitle-2 mb-2">Project</div>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(110px, max-content) 1fr',
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

          {meta.modules.length > 0 ? (
            <section>
              <div class="text-subtitle-2 mb-2">Modules ({meta.modules.length})</div>
              <ul style="margin:0; padding-left:1.25rem">
                {meta.modules.map((m) => (
                  <li key={m}>
                    <code>{m}</code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {meta.dependencies.length > 0 ? (
            <section>
              <div class="text-subtitle-2 mb-2">Dependencies ({meta.dependencies.length})</div>
              <VTable density="compact" hover>
                {{
                  default: () => (
                    <>
                      <thead>
                        <tr>
                          <th>Group</th>
                          <th>Artifact</th>
                          <th>Version</th>
                          <th>Scope</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meta.dependencies.map((d, i) => (
                          <tr key={i}>
                            <td>{d.groupId ?? ''}</td>
                            <td>{d.artifactId}</td>
                            <td>{d.version ?? ''}</td>
                            <td>{d.scope ?? 'compile'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  ),
                }}
              </VTable>
            </section>
          ) : null}

          {meta.plugins.length > 0 ? (
            <section>
              <div class="text-subtitle-2 mb-2">Build plugins ({meta.plugins.length})</div>
              <VTable density="compact" hover>
                {{
                  default: () => (
                    <>
                      <thead>
                        <tr>
                          <th>Group</th>
                          <th>Artifact</th>
                          <th>Version</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meta.plugins.map((p, i) => (
                          <tr key={i}>
                            <td>{p.groupId ?? 'org.apache.maven.plugins'}</td>
                            <td>{p.artifactId}</td>
                            <td>{p.version ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  ),
                }}
              </VTable>
            </section>
          ) : null}
        </div>
      )
    }
  },
})
