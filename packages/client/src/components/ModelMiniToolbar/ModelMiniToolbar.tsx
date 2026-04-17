import type { EntityData, EnumData, PackageData } from '@xomda/diagram'
import {
  AddIcon,
  CloseIcon,
  EntityIcon,
  EnumIcon,
  MoveToFolderIcon,
  OpenWithIcon,
  PackageIcon,
} from '@xomda/icons'
import { MenuButton, type MenuItemConfig } from '@xomda/ui'
import { computed, defineComponent, type PropType } from 'vue'
import { VBtn, VTooltip } from 'vuetify/components'

import { useFloatingDrag } from '../../composables'
import styles from './ModelMiniToolbar.module.scss'

/**
 * Selection a `ModelMiniToolbar` is acting on. Attribute selections are
 * deliberately omitted: attributes are scoped to an entity and aren't
 * first-class diagram nodes.
 */
export type ToolbarSelection =
  | { kind: 'entity'; entity: EntityData; packageId: string | undefined }
  | { kind: 'enum'; enum: EnumData; packageId: string | undefined }
  | { kind: 'package'; package: PackageData }

/**
 * Floating toolbar over the model canvas. Visible only when something
 * is selected — when nothing is selected the toolbar renders nothing.
 * Pending-layout Save / Cancel lives in the separate `LayoutSavePill`
 * (top-center) so it stays visible regardless of selection state.
 *
 * Action set depends on `selection.kind`:
 *   - entity:  "Add attribute"
 *   - enum:    "Add value"
 *   - package: "Add entity / Add enum / Add nested package"
 * Plus, for any selection: a "Move to…" package picker and a
 * "Drag scene" shortcut that flips the canvas into pan mode and hands
 * off to the `SceneMiniToolbar`.
 */
export const ModelMiniToolbar = defineComponent({
  name: 'ModelMiniToolbar',
  props: {
    selection: {
      type: Object as PropType<ToolbarSelection | null>,
      default: null,
    },
    /**
     * Anchor position (in pixels, relative to the canvas area) where the
     * toolbar should float. When provided, overrides the default top-left
     * placement and pops the toolbar next to the selected node.
     */
    anchor: {
      type: Object as PropType<{ top: number; left: number } | null>,
      default: null,
    },
    onClose: { type: Function as PropType<() => void>, default: undefined },
    movableTargets: {
      type: Array as PropType<{ id: string; label: string }[]>,
      default: () => [],
    },
    onAddAttribute: { type: Function as PropType<() => void>, default: undefined },
    onAddEnumValue: { type: Function as PropType<() => void>, default: undefined },
    onAddEntity: { type: Function as PropType<() => void>, default: undefined },
    onAddEnum: { type: Function as PropType<() => void>, default: undefined },
    onAddNestedPackage: { type: Function as PropType<() => void>, default: undefined },
    onMoveTo: { type: Function as PropType<(targetPackageId: string) => void>, default: undefined },
    /** Switch the canvas into pan mode and hand off to the scene toolbar. */
    onSwitchToPanMode: { type: Function as PropType<() => void>, default: undefined },
  },
  setup(props) {
    const visible = computed(() => props.selection != null)

    const moveItems = computed<MenuItemConfig[]>(() => {
      const targets = props.movableTargets
      if (targets.length === 0) {
        return [{ subheader: 'No other packages' }]
      }
      return [
        { subheader: 'Move to package' },
        ...targets.map(
          (t): MenuItemConfig => ({
            title: t.label,
            icon: PackageIcon,
            onClick: () => props.onMoveTo?.(t.id),
          })
        ),
      ]
    })

    // Manual drag offset on top of the anchor — wire the kind label's
    // pointer events to this and the user can reposition the toolbar by
    // grabbing the title. Resets to (0,0) whenever the anchor reference
    // changes (e.g. the user picks a different node).
    const drag = useFloatingDrag(() => props.anchor)
    const titleHandlers = {
      onPointerdown: drag.onPointerDown,
      onPointermove: drag.onPointerMove,
      onPointerup: drag.onPointerUp,
      onPointercancel: drag.onPointerUp,
    }

    return () => {
      if (!visible.value) return null
      const sel = props.selection
      const positionStyle = props.anchor
        ? {
            top: `${props.anchor.top + drag.offset.value.dy}px`,
            left: `${props.anchor.left + drag.offset.value.dx}px`,
          }
        : drag.offset.value.dx !== 0 || drag.offset.value.dy !== 0
          ? { transform: `translate(${drag.offset.value.dx}px, ${drag.offset.value.dy}px)` }
          : undefined
      return (
        <div
          class={styles.toolbar}
          style={positionStyle}
          role="toolbar"
          aria-label="Model view toolbar"
        >
          {sel?.kind === 'entity' && (
            <>
              <span class={[styles.label, styles.labelDraggable]} {...titleHandlers}>
                Entity
              </span>
              <VTooltip text="Add attribute" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={AddIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Add attribute"
                      onClick={() => props.onAddAttribute?.()}
                    />
                  ),
                }}
              </VTooltip>
              <div class={styles.divider} aria-hidden="true" />
            </>
          )}
          {sel?.kind === 'enum' && (
            <>
              <span class={[styles.label, styles.labelDraggable]} {...titleHandlers}>
                Enum
              </span>
              <VTooltip text="Add value" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={AddIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Add enum value"
                      onClick={() => props.onAddEnumValue?.()}
                    />
                  ),
                }}
              </VTooltip>
              <div class={styles.divider} aria-hidden="true" />
            </>
          )}
          {sel?.kind === 'package' && (
            <>
              <span class={[styles.label, styles.labelDraggable]} {...titleHandlers}>
                Package
              </span>
              <VTooltip text="Add entity" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={EntityIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Add entity"
                      onClick={() => props.onAddEntity?.()}
                    />
                  ),
                }}
              </VTooltip>
              <VTooltip text="Add enum" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={EnumIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Add enum"
                      onClick={() => props.onAddEnum?.()}
                    />
                  ),
                }}
              </VTooltip>
              <VTooltip text="Add nested package" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={PackageIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Add nested package"
                      onClick={() => props.onAddNestedPackage?.()}
                    />
                  ),
                }}
              </VTooltip>
              <div class={styles.divider} aria-hidden="true" />
            </>
          )}
          {sel != null && (
            <>
              <MenuButton
                icon={MoveToFolderIcon}
                tooltip="Move to package"
                ariaLabel="Move to package"
                items={moveItems.value}
              />
              <div class={styles.divider} aria-hidden="true" />
              <VTooltip text="Drag scene" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={OpenWithIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Drag scene"
                      onClick={() => props.onSwitchToPanMode?.()}
                    />
                  ),
                }}
              </VTooltip>
            </>
          )}
          {sel != null && props.onClose && (
            <>
              <div class={styles.divider} aria-hidden="true" />
              <VTooltip text="Close" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={CloseIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Close toolbar"
                      onClick={() => props.onClose?.()}
                    />
                  ),
                }}
              </VTooltip>
            </>
          )}
        </div>
      )
    }
  },
})
