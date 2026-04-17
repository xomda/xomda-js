import type { EntityData, EnumData, PackageData } from '@xomda/diagram'
import { ChevronDownIcon, ChevronRightIcon, EntityIcon, EnumIcon, PackageIcon } from '@xomda/icons'
import { computed, defineComponent, type PropType, ref } from 'vue'
import { VIcon } from 'vuetify/components'

import { useModelSelectionStore } from '../../modules/model'
import styles from './ModelTree.module.scss'

interface TreeNode {
  kind: 'package' | 'entity' | 'enum'
  id: string
  label: string
  children?: TreeNode[]
}

function buildTree(packages: PackageData[]): TreeNode[] {
  return packages.map((pkg) => packageToNode(pkg))
}

function packageToNode(pkg: PackageData): TreeNode {
  const children: TreeNode[] = []
  for (const sub of pkg.packages) children.push(packageToNode(sub))
  for (const e of pkg.entities) {
    children.push({ kind: 'entity', id: e.id, label: e.name })
  }
  for (const en of pkg.enums) {
    children.push({ kind: 'enum', id: en.id, label: en.name })
  }
  return { kind: 'package', id: pkg.id, label: pkg.name, children }
}

const ICONS = {
  package: PackageIcon,
  entity: EntityIcon,
  enum: EnumIcon,
} as const

/**
 * Side-panel tree of the model's package / entity / enum hierarchy. Drives
 * selection through the `model` module's selection store and the
 * ModelView select callbacks — so clicking a node opens the same property
 * panel as clicking the element on the canvas.
 *
 * Intentionally model-specific for now. The plan's `useTreeView`
 * generalization in `@xomda/ui` waits for a second consumer (FileBrowser
 * still uses its bespoke `useFolderTree`) per the incremental-migration
 * rule — extracting now would be premature.
 */
export const ModelTree = defineComponent({
  name: 'ModelTree',
  props: {
    packages: { type: Array as PropType<PackageData[]>, required: true },
    /** Caller wires this to ModelView.selectPackage. */
    onSelectPackage: { type: Function as PropType<(p: PackageData) => void>, required: true },
    /** Caller wires this to ModelView.selectEntity. */
    onSelectEntity: { type: Function as PropType<(e: EntityData) => void>, required: true },
    /** Caller wires this to ModelView.selectEnum. */
    onSelectEnum: { type: Function as PropType<(e: EnumData) => void>, required: true },
  },
  setup(props) {
    const selection = useModelSelectionStore()
    // Default to every top-level package expanded; deeper levels collapsed
    // so users don't get a wall of names on first open.
    const expanded = ref(new Set<string>(props.packages.map((p) => p.id)))

    const tree = computed(() => buildTree(props.packages))

    function toggle(id: string) {
      if (expanded.value.has(id)) expanded.value.delete(id)
      else expanded.value.add(id)
      // Trigger reactivity on Set mutation
      expanded.value = new Set(expanded.value)
    }

    function findPackage(id: string, scope: PackageData[] = props.packages): PackageData | null {
      for (const p of scope) {
        if (p.id === id) return p
        const sub = findPackage(id, p.packages)
        if (sub) return sub
      }
      return null
    }

    function findEntity(id: string, scope: PackageData[] = props.packages): EntityData | null {
      for (const p of scope) {
        const e = p.entities.find((x) => x.id === id)
        if (e) return e
        const sub = findEntity(id, p.packages)
        if (sub) return sub
      }
      return null
    }

    function findEnum(id: string, scope: PackageData[] = props.packages): EnumData | null {
      for (const p of scope) {
        const e = p.enums.find((x) => x.id === id)
        if (e) return e
        const sub = findEnum(id, p.packages)
        if (sub) return sub
      }
      return null
    }

    function onNodeClick(node: TreeNode) {
      if (node.kind === 'package') {
        const pkg = findPackage(node.id)
        if (pkg) props.onSelectPackage(pkg)
      } else if (node.kind === 'entity') {
        const ent = findEntity(node.id)
        if (ent) props.onSelectEntity(ent)
      } else {
        const en = findEnum(node.id)
        if (en) props.onSelectEnum(en)
      }
    }

    function renderNode(node: TreeNode, depth: number): unknown {
      const isExpandable = node.kind === 'package' && (node.children?.length ?? 0) > 0
      const isOpen = expanded.value.has(node.id)
      const isSelected = selection.current?.id === node.id
      return (
        <div key={`${node.kind}-${node.id}`}>
          <div
            class={[styles.node, isSelected && styles.nodeSelected]}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            onClick={() => onNodeClick(node)}
          >
            {isExpandable ? (
              <span
                class={styles.chevron}
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(node.id)
                }}
              >
                <VIcon icon={isOpen ? ChevronDownIcon : ChevronRightIcon} size="14" />
              </span>
            ) : (
              <span class={styles.chevronEmpty} />
            )}
            <VIcon icon={ICONS[node.kind]} size="14" />
            <span class={styles.label}>{node.label}</span>
          </div>
          {isExpandable && isOpen && node.children?.map((c) => renderNode(c, depth + 1))}
        </div>
      )
    }

    return () => (
      <div class={styles.body} role="tree" aria-label="Model structure">
        {tree.value.map((n) => renderNode(n, 0))}
      </div>
    )
  },
})
