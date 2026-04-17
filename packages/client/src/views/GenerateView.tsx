import { getPreviewComponent } from '@xomda/analysis-client'
import { CodeEditor } from '@xomda/codeeditor'
import { CheckIcon, FilePresentIcon, GenerateIcon } from '@xomda/icons'
import { languageFromPath, useAsyncState, useDelayedLoading } from '@xomda/ui'
import { computed, defineComponent, h, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import {
  VAlert,
  VBtn,
  VCard,
  VEmptyState,
  VIcon,
  VList,
  VListItem,
  VProgressCircular,
} from 'vuetify/components'

import { AppTitleBar, PanelDivider } from '../components'
import { usePanelResize } from '../composables'
import { trpc } from '../trpc'

interface GeneratedResult {
  outputPath: string
  templateId: string
  content: string
}

/**
 * Resolved preview hint for the selected generated file. `kind` mirrors
 * the server's `PreviewHint` discriminated union narrowed to what makes
 * sense for in-memory template output (no on-disk image/binary bytes).
 */
interface GeneratedPreview {
  kind: 'text' | 'markdown' | 'custom'
  language: string
  componentId?: string
}

export const GenerateView = defineComponent({
  name: 'GenerateView',
  setup() {
    const theme = useTheme()
    const editorTheme = computed(() =>
      theme.global.current.value.dark ? 'xomda-dark' : 'xomda-light'
    )

    const results = ref<GeneratedResult[]>([])
    const {
      loading: genLoading,
      error: genError,
      run: genRun,
    } = useAsyncState<GeneratedResult[]>()
    const showGenLoading = useDelayedLoading(genLoading)

    const selectedPath = ref<string | null>(null)
    const selectedResult = computed<GeneratedResult | null>(
      () => results.value.find((r) => r.outputPath === selectedPath.value) ?? null
    )

    const preview = ref<GeneratedPreview | null>(null)
    const { loading: previewLoading, run: runPreviewHint } = useAsyncState<GeneratedPreview>()

    const { width: rightWidth, onResize: onResizeRight } = usePanelResize(480, 280, 900)

    const generate = () =>
      genRun(async () => {
        const res = await trpc.template.generate.mutate()
        results.value = res
        // Reset selection so a previous file from an older generation
        // can't linger with stale content.
        selectedPath.value = null
        preview.value = null
        return res
      })

    /**
     * Resolve the preview shape for `path` via the project analysis
     * router. Generated files aren't on disk yet (or may differ from
     * disk), so we deliberately skip `viewsFor`/`viewData` — those load
     * from the filesystem — and only consume the cheap `fileTypesFor`
     * hint that's derived from the path/pattern alone.
     */
    const resolvePreview = (path: string) =>
      runPreviewHint(async () => {
        let hintKind: 'text' | 'markdown' | 'image' | 'binary' | 'custom' = 'text'
        let hintLanguage: string | undefined
        let componentId: string | undefined
        try {
          const hint = await trpc.project.fileTypesFor.query({ path })
          if (hint.preview) {
            hintKind = hint.preview.kind
            if (hint.preview.kind === 'text') hintLanguage = hint.preview.language
            if (hint.preview.kind === 'custom') componentId = hint.preview.componentId
          }
        } catch {
          // Network/registry hiccup → fall back to extension-based text preview.
        }
        // image/binary preview hints don't apply to template-rendered
        // text output; degrade them to a syntax-highlighted text view.
        const kind: GeneratedPreview['kind'] =
          hintKind === 'markdown' || hintKind === 'custom' ? hintKind : 'text'
        const language =
          kind === 'markdown' ? 'markdown' : hintLanguage ?? languageFromPath(path)
        const next: GeneratedPreview = { kind, language }
        if (componentId !== undefined) next.componentId = componentId
        preview.value = next
        return next
      })

    watch(selectedPath, (path) => {
      if (!path) {
        preview.value = null
        return
      }
      void resolvePreview(path)
    })

    const selectResult = (r: GeneratedResult) => {
      selectedPath.value = r.outputPath
    }

    const showPreviewLoading = useDelayedLoading(previewLoading)

    return () => (
      <div class="fill-height d-flex flex-column">
        <AppTitleBar>
          {{
            title: () => 'Template Generation',
            actions: () => (
              <VBtn
                prepend-icon={GenerateIcon}
                variant="tonal"
                color="primary"
                onClick={generate}
                loading={genLoading.value}
              >
                Generate All
              </VBtn>
            ),
          }}
        </AppTitleBar>

        <div class="flex-grow-1 pa-2 pl-0 d-flex flex-column ga-2" style="min-height: 0">
          {genError.value && (
            <VAlert
              type="error"
              closable
              onUpdate:modelValue={(v) => !v && (genError.value = null)}
            >
              {genError.value}
            </VAlert>
          )}

          {results.value.length > 0 ? (
            <div class="d-flex flex-grow-1" style="min-height: 0; gap: 0">
              {/* Left: generated files list */}
              <VCard
                class="flex-grow-1 d-flex flex-column overflow-hidden"
                style="min-width: 0"
                elevation={2}
                rounded="lg"
              >
                <div
                  class="px-3 py-2 text-caption text-disabled"
                  style="border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); flex-shrink:0"
                >
                  Generated Files ({results.value.length})
                </div>
                <VList bgColor={'transparent'} class="overflow-y-auto flex-grow-1" density="compact">
                  {results.value.map((res) => (
                    <VListItem
                      key={res.outputPath}
                      prependIcon={FilePresentIcon}
                      title={res.outputPath}
                      subtitle={`Template: ${res.templateId}`}
                      active={selectedPath.value === res.outputPath}
                      onClick={() => selectResult(res)}
                    >
                      {{
                        append: () => <VIcon icon={CheckIcon} color="success" />,
                      }}
                    </VListItem>
                  ))}
                </VList>
              </VCard>

              <PanelDivider onResize={(delta) => onResizeRight(-delta)} />

              {/* Right: project-analysis-driven preview */}
              <VCard
                class="flex-shrink-0 d-flex flex-column overflow-hidden"
                style={{ width: `${rightWidth.value}px` }}
                elevation={2}
                rounded="lg"
              >
                {selectedResult.value ? (
                  <>
                    <div
                      class="px-3 py-2 text-caption text-disabled d-flex align-center"
                      style="border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); flex-shrink:0"
                    >
                      <span class="flex-grow-1 text-truncate" style="font-family:monospace">
                        {selectedResult.value.outputPath}
                      </span>
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                      {showPreviewLoading.value && !preview.value ? (
                        <div class="d-flex align-center justify-center fill-height">
                          <VProgressCircular indeterminate color="primary" size="32" />
                        </div>
                      ) : preview.value?.kind === 'custom' && preview.value.componentId ? (
                        (() => {
                          const Component = getPreviewComponent(preview.value.componentId)
                          return Component
                            ? h(Component, {
                                path: selectedResult.value.outputPath,
                                text: selectedResult.value.content,
                              })
                            : (
                                <CodeEditor
                                  modelValue={selectedResult.value.content}
                                  language={preview.value.language}
                                  height="100%"
                                  theme={editorTheme.value}
                                  options={{ readOnly: true }}
                                />
                              )
                        })()
                      ) : (
                        <CodeEditor
                          modelValue={selectedResult.value.content}
                          language={
                            preview.value?.language ??
                            languageFromPath(selectedResult.value.outputPath)
                          }
                          height="100%"
                          theme={editorTheme.value}
                          options={{ readOnly: true }}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div class="d-flex align-center justify-center fill-height">
                    <VEmptyState
                      icon={FilePresentIcon}
                      title="No file selected"
                      text="Select a generated file to preview."
                    />
                  </div>
                )}
              </VCard>
            </div>
          ) : showGenLoading.value ? (
            <div class="d-flex align-center justify-center fill-height">
              <VProgressCircular indeterminate color="primary" size="64" />
            </div>
          ) : !genLoading.value && !genError.value ? (
            <VEmptyState
              icon={GenerateIcon}
              title="No files generated yet"
              text={'Click "Generate All" to render templates according to your model.'}
            />
          ) : null}
        </div>
      </div>
    )
  },
})
