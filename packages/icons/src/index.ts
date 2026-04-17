import icons from '@iconify-json/material-symbols-light/icons.json'

function getIconPath(name: string): string {
  const iconData = icons as unknown as { icons: Record<string, { body: string }> }
  const icon = iconData.icons[name]
  if (!icon) {
    console.warn(`Icon ${name} not found in material-symbols-light`)
    return 'M12,2L2,22H22L12,2Z'
  }

  // Extract path data from the icon body
  // Typical iconify body: <path d="..." />
  const match = icon.body.match(/d="([^"]+)"/)
  return match ? match[1] : ''
}

export const AddIcon = getIconPath('add')
export const ArrowUpwardIcon = getIconPath('arrow-upward')
export const BufferIcon = getIconPath('data-array')
export const CheckIcon = getIconPath('check')
export const ChevronDownIcon = getIconPath('keyboard-arrow-down')
export const ChevronLeftIcon = getIconPath('chevron-left')
export const ChevronRightIcon = getIconPath('chevron-right')
export const ChevronUpIcon = getIconPath('keyboard-arrow-up')
export const CloseIcon = getIconPath('close')
export const CodeXmlIcon = getIconPath('code-xml')
export const CreateNewFolderIcon = getIconPath('create-new-folder-outline')
export const DarkModeIcon = getIconPath('dark-mode-outline')
export const DataTable = getIconPath('data-table-outline')
export const DeleteIcon = getIconPath('delete-outline')
export const DescriptionIcon = getIconPath('description-outline')
export const DraftIcon = getIconPath('draft-outline')
export const DragIndicatorIcon = getIconPath('drag-indicator')
export const EditIcon = getIconPath('edit-outline')
export const EntityIcon = getIconPath('memory-outline')
export const EnumIcon = getIconPath('data-table-outline')
export const ErrorIcon = getIconPath('error-outline')
export const FilePresentIcon = getIconPath('file-present-outline')
export const FolderIcon = getIconPath('folder-outline')
export const FolderXomdaIcon = getIconPath('folder-special-outline')
export const GenerateIcon = getIconPath('rocket-launch-outline')
export const HandlebarsIcon = getIconPath('data-object')
export const HistoryIcon = getIconPath('history')
export const HomeIcon = getIconPath('home-outline')
export const InfoIcon = getIconPath('info-outline')
export const LightModeIcon = getIconPath('light-mode-outline')
export const ListViewIcon = getIconPath('format-list-bulleted')
export const LogicIcon = getIconPath('code')
export const LoopIcon = getIconPath('repeat')
export const MarkdownIcon = getIconPath('markdown')
export const ModelIcon = getIconPath('schema-outline')
export const MoreIcon = getIconPath('more-vert')
export const OutputIcon = getIconPath('output')
export const PackageIcon = getIconPath('package-2-outline')
export const ParentFolderIcon = getIconPath('drive-folder-upload-outline')
export const MoveToFolderIcon = getIconPath('drive-file-move-outline')
export const PropertiesIcon = getIconPath('tune')
export const RocketIcon = getIconPath('rocket-outline')
export const SaveIcon = getIconPath('save-outline')
export const SearchIcon = getIconPath('search')
export const SettingsIcon = getIconPath('settings-outline')
export const TemplatesIcon = getIconPath('code-blocks-outline')
export const TreeViewIcon = getIconPath('account-tree-outline')
export const UploadIcon = getIconPath('upload-file-outline')
export const VisibilityIcon = getIconPath('visibility-outline')
export const VisibilityOffIcon = getIconPath('visibility-off-outline')
export const WarningIcon = getIconPath('warning-outline')

// ─── Analysis-plugin icons (used by plugin client manifests) ──────────────
// Plugins pick a generic Material Symbol that conveys their kind; vendor
// brand marks (TypeScript, Vite, Maven, ...) aren't in material-symbols, so
// we lean on semantic glyphs (code, package, build, etc.).
export const PluginAntIcon = getIconPath('package-2-outline')
export const PluginCsharpIcon = getIconPath('code-blocks-outline')
export const PluginEslintIcon = getIconPath('rule')
export const PluginGradleIcon = getIconPath('construction')
export const PluginIntellijIcon = getIconPath('terminal')
export const PluginJavaIcon = getIconPath('coffee-outline')
export const PluginMarkdownIcon = getIconPath('markdown')
export const PluginMavenIcon = getIconPath('package-2-outline')
// Material-symbols has no clean Node.js mark; webhook-outline reads as a
// JS-runtime / interconnected-services glyph and is visually distinct
// from every other plugin icon in this list.
export const PluginNodeIcon = getIconPath('webhook')
export const PluginPrettierIcon = getIconPath('format-paint-outline')
export const PluginRustIcon = getIconPath('settings-outline')
export const PluginStylelintIcon = getIconPath('palette-outline')
export const PluginTypeScriptIcon = getIconPath('code')
export const PluginViteIcon = getIconPath('bolt-outline')
export const PluginVisualStudioIcon = getIconPath('code-blocks-outline')
export const PluginVscodeIcon = getIconPath('code-blocks-outline')
export const PluginWebpackIcon = getIconPath('inventory-2-outline')
export const PluginXomdaIcon = getIconPath('hub-outline')
