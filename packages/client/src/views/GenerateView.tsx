import { CodeEditor } from '@xomda/codeeditor'
import { CheckIcon, FilePresentIcon, GenerateIcon, HistoryIcon, UploadIcon } from '@xomda/icons'
import { computed, defineComponent, ref } from 'vue'
import {
  VAlert,
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VChip,
  VDivider,
  VIcon,
  VList,
  VListItem,
  VProgressCircular,
  VTextField,
} from 'vuetify/components'

import { TitleBar } from '@xomda/ui'
import { useAsyncState } from '../composables'
import { trpc } from '../trpc'

type DiffEntry = { outputPath: string; generated: string; current: string | null }
type SnapshotEntry = { filename: string; timestamp: string; label: string }

export const GenerateView = defineComponent({
  name: 'GenerateView',
  setup() {
    // Generate section
    const results = ref<{ outputPath: string; templateId: string }[]>([])
    const {
      loading: genLoading,
      error: genError,
      execute: genExecute,
    } = useAsyncState<typeof results.value>()

    const generate = () =>
      genExecute(async () => {
        const res = await trpc.handlebarsTemplate.generate.mutate()
        results.value = res
        return res
      })

    // Promote section
    const diffEntries = ref<DiffEntry[]>([])
    const selectedDiff = ref<DiffEntry | null>(null)
    const selectedPaths = ref<Set<string>>(new Set())
    const { loading: diffLoading, error: diffError, execute: diffExecute } = useAsyncState()
    const {
      loading: promoteLoading,
      error: promoteError,
      execute: promoteExecute,
    } = useAsyncState()
    const promoteResult = ref<string[]>([])

    const changedEntries = computed(() =>
      diffEntries.value.filter((e) => e.current !== e.generated)
    )

    const loadDiff = () =>
      diffExecute(async () => {
        const entries = await trpc.handlebarsTemplate.getDiff.query()
        diffEntries.value = entries
        selectedPaths.value = new Set(
          entries.filter((e) => e.current !== e.generated).map((e) => e.outputPath)
        )
        if (entries.length > 0) selectedDiff.value = entries[0]
      })

    const togglePath = (path: string) => {
      const next = new Set(selectedPaths.value)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      selectedPaths.value = next
    }

    const promote = () =>
      promoteExecute(async () => {
        const paths = [...selectedPaths.value]
        const promoted = await trpc.handlebarsTemplate.promote.mutate(paths)
        promoteResult.value = promoted
        await loadDiff()
      })

    // Snapshot section
    const snapshots = ref<SnapshotEntry[]>([])
    const snapshotLabel = ref('')
    const {
      loading: snapshotLoading,
      error: snapshotError,
      execute: snapshotExecute,
    } = useAsyncState()
    const { loading: listLoading, execute: listExecute } = useAsyncState()

    const loadSnapshots = () =>
      listExecute(async () => {
        snapshots.value = await trpc.model.listSnapshots.query()
      })

    const takeSnapshot = () =>
      snapshotExecute(async () => {
        const label = snapshotLabel.value.trim() || new Date().toLocaleString()
        await trpc.model.snapshot.mutate({ label })
        snapshotLabel.value = ''
        await loadSnapshots()
      })

    // Load snapshots on mount
    loadSnapshots()

    return () => (
      <div class="fill-height d-flex flex-column">
        <TitleBar>
          {{
            title: () => 'Template Generation',
            actions: () => (
              <VBtn
                prepend-icon={GenerateIcon as any}
                color="primary"
                onClick={generate}
                loading={genLoading.value}
              >
                Generate All
              </VBtn>
            ),
          }}
        </TitleBar>

        <div class="flex-grow-1 overflow-auto pa-4 d-flex flex-column ga-6">
          {/* Generate results */}
          {genError.value && (
            <VAlert
              type="error"
              closable
              onUpdate:modelValue={(v) => !v && (genError.value = null)}
            >
              {genError.value}
            </VAlert>
          )}

          {results.value.length > 0 && (
            <VCard>
              <VCardTitle>Generated Files ({results.value.length})</VCardTitle>
              <VCardText class="pa-0">
                <VList>
                  {results.value.map((res, i) => (
                    <VListItem
                      key={i}
                      prependIcon={FilePresentIcon as any}
                      title={res.outputPath}
                      subtitle={`Template: ${res.templateId}`}
                    >
                      {{
                        append: () => <VIcon icon={CheckIcon} color="success" />,
                      }}
                    </VListItem>
                  ))}
                </VList>
              </VCardText>
            </VCard>
          )}

          {genLoading.value && results.value.length === 0 && (
            <div class="d-flex align-center justify-center fill-height">
              <VProgressCircular indeterminate color="primary" size="64" />
            </div>
          )}

          {!genLoading.value && results.value.length === 0 && !genError.value && (
            <div class="d-flex flex-column align-center justify-center pa-8 text-grey">
              <VIcon icon={GenerateIcon} size="64" class="mb-4" />
              <p>Click "Generate All" to render templates according to your model.</p>
            </div>
          )}

          <VDivider />

          {/* Promote to source section */}
          <VCard>
            <VCardTitle class="d-flex align-center ga-2">
              <VIcon icon={UploadIcon as any} />
              Promote to Source
            </VCardTitle>
            <VCardText>
              <p class="text-body-2 text-grey mb-3">
                Preview diffs between generated output and the current files on disk, then promote
                selected files.
              </p>
              <VBtn variant="tonal" size="small" onClick={loadDiff} loading={diffLoading.value}>
                Load Diff
              </VBtn>

              {diffError.value && (
                <VAlert type="error" class="mt-2" density="compact">
                  {diffError.value}
                </VAlert>
              )}

              {promoteResult.value.length > 0 && (
                <VAlert
                  type="success"
                  closable
                  class="mt-2"
                  onUpdate:modelValue={(v) => !v && (promoteResult.value = [])}
                >
                  Promoted {promoteResult.value.length} file(s).
                </VAlert>
              )}

              {diffEntries.value.length > 0 && (
                <div class="mt-4 d-flex ga-3" style="min-height:420px">
                  {/* File list */}
                  <div style="width:260px;flex-shrink:0">
                    <VList density="compact" nav>
                      {diffEntries.value.map((entry) => {
                        const changed = entry.current !== entry.generated
                        const selected = selectedPaths.value.has(entry.outputPath)
                        return (
                          <VListItem
                            key={entry.outputPath}
                            title={entry.outputPath.split('/').pop()}
                            subtitle={entry.outputPath}
                            active={selectedDiff.value?.outputPath === entry.outputPath}
                            onClick={() => (selectedDiff.value = entry)}
                            class={!changed ? 'text-grey' : ''}
                          >
                            {{
                              prepend: () => (
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={!changed}
                                  style="margin-right:8px"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (changed) togglePath(entry.outputPath)
                                  }}
                                />
                              ),
                              append: () =>
                                changed ? (
                                  <VChip size="x-small" color="warning">
                                    changed
                                  </VChip>
                                ) : (
                                  <VIcon icon={CheckIcon} color="success" size="small" />
                                ),
                            }}
                          </VListItem>
                        )
                      })}
                    </VList>
                  </div>

                  {/* Diff viewer */}
                  <div class="flex-grow-1 rounded overflow-hidden" style="min-height:400px">
                    {selectedDiff.value ? (
                      <CodeEditor
                        diffEditor
                        original={selectedDiff.value.current ?? ''}
                        modelValue={selectedDiff.value.generated}
                        language="typescript"
                        height="400px"
                        options={{ readOnly: true }}
                      />
                    ) : (
                      <div class="d-flex align-center justify-center fill-height text-grey">
                        Select a file to preview
                      </div>
                    )}
                  </div>
                </div>
              )}
            </VCardText>
            {changedEntries.value.length > 0 && (
              <VCardActions>
                <VBtn
                  color="primary"
                  onClick={promote}
                  loading={promoteLoading.value}
                  disabled={selectedPaths.value.size === 0}
                >
                  Promote {selectedPaths.value.size} File(s)
                </VBtn>
                {promoteError.value && (
                  <span class="text-error text-body-2 ml-2">{promoteError.value}</span>
                )}
              </VCardActions>
            )}
          </VCard>

          <VDivider />

          {/* Snapshot history section */}
          <VCard>
            <VCardTitle class="d-flex align-center ga-2">
              <VIcon icon={HistoryIcon as any} />
              Model Snapshots
            </VCardTitle>
            <VCardText>
              <p class="text-body-2 text-grey mb-3">
                Save a point-in-time snapshot of the model. Use two snapshots to generate migration
                diffs.
              </p>
              <div class="d-flex align-center ga-2 mb-4">
                <VTextField
                  v-model={snapshotLabel.value}
                  label="Snapshot label"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="max-width:320px"
                  placeholder={new Date().toLocaleString()}
                />
                <VBtn
                  color="secondary"
                  onClick={takeSnapshot}
                  loading={snapshotLoading.value}
                  disabled={snapshotLoading.value}
                >
                  Take Snapshot
                </VBtn>
              </div>

              {snapshotError.value && (
                <VAlert type="error" class="mb-2" density="compact">
                  {snapshotError.value}
                </VAlert>
              )}

              {listLoading.value && snapshots.value.length === 0 ? (
                <VProgressCircular indeterminate size="24" />
              ) : snapshots.value.length === 0 ? (
                <p class="text-grey text-body-2">No snapshots yet.</p>
              ) : (
                <VList border rounded density="compact">
                  {snapshots.value.map((s) => (
                    <VListItem
                      key={s.filename}
                      prependIcon={HistoryIcon as any}
                      title={s.label}
                      subtitle={new Date(s.timestamp).toLocaleString()}
                    />
                  ))}
                </VList>
              )}
            </VCardText>
          </VCard>
        </div>
      </div>
    )
  },
})
