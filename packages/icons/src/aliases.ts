/**
 * Semantic-name aliases for Material Symbols icons whose auto-generated
 * name (PascalCase of the iconify name + `Icon`) doesn't read naturally
 * in app code. Examples:
 *
 *   - `keyboard-arrow-down` auto-generates as `KeyboardArrowDownIcon`,
 *     but consumers want `ChevronDownIcon`.
 *   - `save-outline` auto-generates as `SaveOutlineIcon`, but we use
 *     the `-outline` variant pervasively and want the shorthand
 *     `SaveIcon`.
 *
 * Every entry here re-exports an auto-generated icon under a friendlier
 * name. Aliases shadow auto-generated names of the same identifier:
 * if a key here collides with a name the generator would have emitted,
 * the alias wins (the auto re-export is skipped).
 *
 * Adding a new icon **does not** require touching this file — import
 * the auto-generated name directly (e.g. `import { CloudUploadIcon }
 * from '@xomda/icons'`). Add an entry here only when the natural
 * shorthand differs from `pascalCase(iconifyName) + 'Icon'`.
 */
export const MATERIAL_ALIASES: Readonly<Record<string, string>> = {
  BufferIcon: 'data-array',
  ChevronDownIcon: 'keyboard-arrow-down',
  ChevronUpIcon: 'keyboard-arrow-up',
  CreateNewFolderIcon: 'create-new-folder-outline',
  DarkModeIcon: 'dark-mode-outline',
  DataTable: 'data-table-outline',
  DeleteIcon: 'delete-outline',
  DescriptionIcon: 'description-outline',
  DraftIcon: 'draft-outline',
  DuplicateIcon: 'content-copy-outline',
  EditIcon: 'edit-outline',
  EntityIcon: 'memory-outline',
  EnumIcon: 'data-table-outline',
  ErrorIcon: 'error-outline',
  FilePresentIcon: 'file-present-outline',
  FolderIcon: 'folder-outline',
  FolderXomdaIcon: 'folder-special-outline',
  GenerateIcon: 'rocket-launch-outline',
  HandlebarsIcon: 'data-object',
  HomeIcon: 'home-outline',
  InfoIcon: 'info-outline',
  LightModeIcon: 'light-mode-outline',
  ListViewIcon: 'format-list-bulleted',
  LockIcon: 'lock-outline',
  LogicIcon: 'code',
  LoopIcon: 'repeat',
  ModelIcon: 'schema-outline',
  MoreIcon: 'more-vert',
  MoveToFolderIcon: 'drive-file-move-outline',
  NotificationsIcon: 'notifications-outline',
  PackageIcon: 'package-2-outline',
  ParentFolderIcon: 'drive-folder-upload-outline',
  PreviewIcon: 'preview-outline',
  PropertiesIcon: 'tune',
  RocketIcon: 'rocket-outline',
  SaveIcon: 'save-outline',
  SelectToolIcon: 'arrow-selector-tool-outline',
  SettingsIcon: 'settings-outline',
  TemplatesIcon: 'code-blocks-outline',
  TreeViewIcon: 'account-tree-outline',
  UploadIcon: 'upload-file-outline',
  VisibilityIcon: 'visibility-outline',
  VisibilityOffIcon: 'visibility-off-outline',
  WarningIcon: 'warning-outline',

  // Analysis-plugin Material fallbacks (no devicon equivalent for these).
  PluginAntIcon: 'package-2-outline',
  PluginBinaryIcon: 'data-array',
  PluginPrettierIcon: 'format-paint-outline',
  PluginStylelintIcon: 'palette-outline',
  PluginXomdaIcon: 'wand-stars',
}

/**
 * Same as `MATERIAL_ALIASES` but for brand glyphs from the `devicon`
 * npm package. Auto-name is `pascalCase(deviconName) + 'BrandIcon'`
 * (e.g. `typescript` → `TypescriptBrandIcon`). The `Brand` suffix
 * keeps them from colliding with Material icons of the same root name.
 *
 * Used for the existing `Plugin*Icon` semantic names so analysis
 * plugins keep working unchanged. Add an entry here when you want a
 * friendlier shorthand for a brand icon — otherwise just import the
 * auto-generated `<Name>BrandIcon` directly.
 */
export const DEVICON_ALIASES: Readonly<Record<string, string>> = {
  PluginCsharpIcon: 'csharp',
  PluginEslintIcon: 'eslint',
  PluginGradleIcon: 'gradle',
  PluginIntellijIcon: 'intellij',
  PluginJavaIcon: 'java',
  PluginMarkdownIcon: 'markdown',
  PluginMavenIcon: 'maven',
  PluginNodeIcon: 'nodejs',
  PluginRustIcon: 'rust',
  PluginTypeScriptIcon: 'typescript',
  PluginVisualStudioIcon: 'visualstudio',
  PluginViteIcon: 'vitejs',
  PluginVscodeIcon: 'vscode',
  PluginWebpackIcon: 'webpack',
}
