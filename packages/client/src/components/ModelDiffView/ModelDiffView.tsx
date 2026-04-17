import type { ModelDiff } from '@xomda/core'
import { defineComponent, type PropType } from 'vue'
import { VChip, VList, VListItem, VListSubheader } from 'vuetify/components'

const Section = defineComponent({
  name: 'ModelDiffSection',
  props: {
    title: { type: String, required: true },
    count: { type: Number, required: true },
  },
  setup(props, { slots }) {
    return () =>
      props.count === 0 ? null : (
        <div class="mb-4">
          <VListSubheader class="text-uppercase text-caption">
            {props.title} ({props.count})
          </VListSubheader>
          <VList density="compact" lines="two">
            {slots.default?.()}
          </VList>
        </div>
      )
  },
})

export const ModelDiffView = defineComponent({
  name: 'ModelDiffView',
  props: {
    diff: { type: Object as PropType<ModelDiff>, required: true },
  },
  setup(props) {
    const empty = (): boolean => {
      const d = props.diff
      return (
        d.added.packages.length +
          d.added.entities.length +
          d.added.enums.length +
          d.added.attributes.length +
          d.added.enumValues.length +
          d.removed.packages.length +
          d.removed.entities.length +
          d.removed.enums.length +
          d.removed.attributes.length +
          d.removed.enumValues.length +
          d.renamed.packages.length +
          d.renamed.entities.length +
          d.renamed.enums.length +
          d.renamed.attributes.length +
          d.renamed.enumValues.length +
          d.modified.packages.length +
          d.modified.entities.length +
          d.modified.enums.length +
          d.modified.attributes.length +
          d.loose.length ===
        0
      )
    }

    return () => {
      const d = props.diff
      if (empty()) {
        return <p class="text-grey text-body-2 pa-4">No differences.</p>
      }

      return (
        <div class="pa-2">
          <Section title="Added" count={countAdded(d)}>
            {d.added.packages.map((p) => (
              <VListItem key={`p-${p.id}`} title={p.name} subtitle="package">
                {{
                  append: () => (
                    <VChip size="x-small" color="success">
                      + pkg
                    </VChip>
                  ),
                }}
              </VListItem>
            ))}
            {d.added.entities.map((e) => (
              <VListItem
                key={`e-${e.entity.id}`}
                title={e.entity.name}
                subtitle={`entity in ${e.packageName}`}
              >
                {{
                  append: () => (
                    <VChip size="x-small" color="success">
                      + entity
                    </VChip>
                  ),
                }}
              </VListItem>
            ))}
            {d.added.enums.map((e) => (
              <VListItem
                key={`en-${e.enum.id}`}
                title={e.enum.name}
                subtitle={`enum in ${e.packageName}`}
              >
                {{
                  append: () => (
                    <VChip size="x-small" color="success">
                      + enum
                    </VChip>
                  ),
                }}
              </VListItem>
            ))}
            {d.added.attributes.map((a) => (
              <VListItem
                key={`a-${a.attribute.id}`}
                title={`${a.entityName}.${a.attribute.name}`}
                subtitle={`attribute (${a.attribute.type})`}
              >
                {{
                  append: () => (
                    <VChip size="x-small" color="success">
                      + attr
                    </VChip>
                  ),
                }}
              </VListItem>
            ))}
            {d.added.enumValues.map((v) => (
              <VListItem
                key={`ev-${v.value.id}`}
                title={`${v.enumName}.${v.value.name}`}
                subtitle="enum value"
              >
                {{
                  append: () => (
                    <VChip size="x-small" color="success">
                      + value
                    </VChip>
                  ),
                }}
              </VListItem>
            ))}
          </Section>

          <Section title="Removed" count={countRemoved(d)}>
            {d.removed.packages.map((p) => (
              <VListItem key={`p-${p.id}`} title={p.name} subtitle="package">
                {{
                  append: () => (
                    <VChip size="x-small" color="error">
                      − pkg
                    </VChip>
                  ),
                }}
              </VListItem>
            ))}
            {d.removed.entities.map((e) => (
              <VListItem
                key={`e-${e.entity.id}`}
                title={e.entity.name}
                subtitle={`entity from ${e.packageName}`}
              >
                {{
                  append: () => (
                    <VChip size="x-small" color="error">
                      − entity
                    </VChip>
                  ),
                }}
              </VListItem>
            ))}
            {d.removed.enums.map((e) => (
              <VListItem
                key={`en-${e.enum.id}`}
                title={e.enum.name}
                subtitle={`enum from ${e.packageName}`}
              >
                {{
                  append: () => (
                    <VChip size="x-small" color="error">
                      − enum
                    </VChip>
                  ),
                }}
              </VListItem>
            ))}
            {d.removed.attributes.map((a) => (
              <VListItem
                key={`a-${a.attribute.id}`}
                title={`${a.entityName}.${a.attribute.name}`}
                subtitle={`attribute (${a.attribute.type})`}
              >
                {{
                  append: () => (
                    <VChip size="x-small" color="error">
                      − attr
                    </VChip>
                  ),
                }}
              </VListItem>
            ))}
            {d.removed.enumValues.map((v) => (
              <VListItem
                key={`ev-${v.value.id}`}
                title={`${v.enumName}.${v.value.name}`}
                subtitle="enum value"
              >
                {{
                  append: () => (
                    <VChip size="x-small" color="error">
                      − value
                    </VChip>
                  ),
                }}
              </VListItem>
            ))}
          </Section>

          <Section title="Renamed" count={countRenamed(d)}>
            {d.renamed.packages.map((p) => (
              <VListItem
                key={`p-${p.id}`}
                title={`${p.oldName} → ${p.newName}`}
                subtitle="package"
              />
            ))}
            {d.renamed.entities.map((e) => (
              <VListItem
                key={`e-${e.id}`}
                title={`${e.oldName} → ${e.newName}`}
                subtitle={`entity in ${e.packageName}`}
              />
            ))}
            {d.renamed.enums.map((e) => (
              <VListItem
                key={`en-${e.id}`}
                title={`${e.oldName} → ${e.newName}`}
                subtitle={`enum in ${e.packageName}`}
              />
            ))}
            {d.renamed.attributes.map((a) => (
              <VListItem
                key={`a-${a.id}`}
                title={`${a.entityName}.${a.oldName} → ${a.newName}`}
                subtitle="attribute"
              />
            ))}
            {d.renamed.enumValues.map((v) => (
              <VListItem
                key={`ev-${v.id}`}
                title={`${v.enumName}.${v.oldName} → ${v.newName}`}
                subtitle="enum value"
              />
            ))}
          </Section>

          <Section title="Modified" count={countModified(d)}>
            {d.modified.packages.map((p) => (
              <VListItem
                key={`p-${p.id}`}
                title={p.after.name}
                subtitle={`package · changed: ${p.changes.join(', ')}`}
              />
            ))}
            {d.modified.entities.map((e) => (
              <VListItem
                key={`e-${e.id}`}
                title={e.after.name}
                subtitle={`entity in ${e.packageName} · changed: ${e.changes.join(', ')}`}
              />
            ))}
            {d.modified.enums.map((e) => (
              <VListItem
                key={`en-${e.id}`}
                title={e.after.name}
                subtitle={`enum in ${e.packageName} · changed: ${e.changes.join(', ')}`}
              />
            ))}
            {d.modified.attributes.map((a) => (
              <VListItem
                key={`a-${a.id}`}
                title={`${a.entityName}.${a.after.name}`}
                subtitle={`attribute · changed: ${a.changes.join(', ')}`}
              />
            ))}
          </Section>

          {d.loose.length > 0 && (
            <Section title="Extension fields changed" count={d.loose.length}>
              {d.loose.map((c) => (
                <VListItem
                  key={`l-${c.kind}-${c.id}`}
                  title={`${c.kind} ${c.id}`}
                  subtitle={Object.keys({ ...c.before, ...c.after }).join(', ')}
                />
              ))}
            </Section>
          )}
        </div>
      )
    }
  },
})

function countAdded(d: ModelDiff): number {
  return (
    d.added.packages.length +
    d.added.entities.length +
    d.added.enums.length +
    d.added.attributes.length +
    d.added.enumValues.length
  )
}
function countRemoved(d: ModelDiff): number {
  return (
    d.removed.packages.length +
    d.removed.entities.length +
    d.removed.enums.length +
    d.removed.attributes.length +
    d.removed.enumValues.length
  )
}
function countRenamed(d: ModelDiff): number {
  return (
    d.renamed.packages.length +
    d.renamed.entities.length +
    d.renamed.enums.length +
    d.renamed.attributes.length +
    d.renamed.enumValues.length
  )
}
function countModified(d: ModelDiff): number {
  return (
    d.modified.packages.length +
    d.modified.entities.length +
    d.modified.enums.length +
    d.modified.attributes.length
  )
}
