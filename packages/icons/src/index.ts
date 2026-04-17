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

export const HomeIcon = getIconPath('home-outline')
export const ModelIcon = getIconPath('schema-outline')
export const TemplatesIcon = getIconPath('code-blocks-outline')
export const AddIcon = getIconPath('add')
export const CloseIcon = getIconPath('close')
export const CodeXmlIcon = getIconPath('code-xml')
export const LightModeIcon = getIconPath('light-mode-outline')
export const DarkModeIcon = getIconPath('dark-mode-outline')
export const DeleteIcon = getIconPath('delete-outline')
export const SaveIcon = getIconPath('save-outline')
export const EditIcon = getIconPath('edit-outline')
export const SettingsIcon = getIconPath('settings-outline')
export const SearchIcon = getIconPath('search')
export const ChevronRightIcon = getIconPath('chevron-right')
export const ChevronLeftIcon = getIconPath('chevron-left')
export const ChevronDownIcon = getIconPath('keyboard-arrow-down')
export const ChevronUpIcon = getIconPath('keyboard-arrow-up')
export const InfoIcon = getIconPath('info-outline')
export const WarningIcon = getIconPath('warning-outline')
export const ErrorIcon = getIconPath('error-outline')
export const CheckIcon = getIconPath('check')
export const MoreIcon = getIconPath('more-vert')
export const DragIndicatorIcon = getIconPath('drag-indicator')

export const FilePresentIcon = getIconPath('file-present-outline')
export const DataTable = getIconPath('data-table-outline')
export const DraftIcon = getIconPath('draft-outline')
export const DescriptionIcon = getIconPath('description-outline')
export const FolderIcon = getIconPath('folder-outline')
export const FolderXomdaIcon = getIconPath('folder-special-outline')
export const ParentFolderIcon = getIconPath('drive-folder-upload-outline')
export const RocketIcon = getIconPath('rocket-outline')
export const VisibilityIcon = getIconPath('visibility-outline')
export const VisibilityOffIcon = getIconPath('visibility-off-outline')
export const PackageIcon = getIconPath('package-2-outline')
export const EntityIcon = getIconPath('memory-outline')
export const EnumIcon = getIconPath('data-table-outline')
export const GenerateIcon = getIconPath('rocket-launch-outline')
export const HistoryIcon = getIconPath('history')
export const UploadIcon = getIconPath('upload-file-outline')
export const ListViewIcon = getIconPath('format-list-bulleted')
export const TreeViewIcon = getIconPath('account-tree-outline')
