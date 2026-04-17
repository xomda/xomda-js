import { CodeEditor } from '@xomda/codeeditor'
import { CloseIcon } from '@xomda/icons'
import { defineComponent } from 'vue'
import { VBtn, VCard, VCardTitle, VDialog, VToolbar, VTooltip } from 'vuetify/components'

/**
 * Last-resort extension → Monaco language map. Plugins own per-extension
 * routing now (see `@xomda/plugin-analysis-markdown`, `-typescript`, etc.):
 * the file browser preview pipeline consults `project.fileTypesFor` first
 * and only falls back to this map when no plugin claims a preview hint.
 * Add a plugin (or extend an existing one) rather than growing this table.
 */
const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  java: 'java',
  kt: 'kotlin',
  py: 'python',
  md: 'markdown',
  html: 'html',
  css: 'css',
  scss: 'scss',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  hbs: 'handlebars',
  sh: 'shell',
  toml: 'ini',
}

export function languageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}

export const FilePreviewDialog = defineComponent({
  name: 'FilePreviewDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    language: { type: String, default: 'plaintext' },
  },
  emits: {
    'update:modelValue': (_value: boolean) => true,
  },
  setup(props, { emit }) {
    const close = () => emit('update:modelValue', false)

    return () => (
      <VDialog
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit('update:modelValue', v)}
        max-width="900"
        max-height="80vh"
      >
        {{
          default: () => (
            <VCard style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
              <VToolbar density="compact">
                <VCardTitle class="text-body-2 text-truncate flex-grow-1">{props.title}</VCardTitle>
                <VTooltip text="Close" location="bottom">
                  {{
                    activator: ({ props }: { props: Record<string, unknown> }) => (
                      <VBtn
                        {...props}
                        icon={CloseIcon}
                        variant="text"
                        density="compact"
                        aria-label="Close"
                        onClick={close}
                      />
                    ),
                  }}
                </VTooltip>
              </VToolbar>
              <div style={{ flex: 1, minHeight: 0 }}>
                <CodeEditor
                  modelValue={props.content}
                  language={props.language}
                  options={{ readOnly: true }}
                  height="100%"
                />
              </div>
            </VCard>
          ),
        }}
      </VDialog>
    )
  },
})
