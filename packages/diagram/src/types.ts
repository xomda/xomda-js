// Diagram uses a `Data` suffix internally to distinguish the data type from
// the component of the same name (e.g. `<Entity>` component takes an
// `EntityData` prop). The shapes themselves live in `@xomda/core` as the
// canonical schemas — these are aliases, not parallel definitions.
export type {
  Attribute,
  Entity as EntityData,
  Enum as EnumData,
  EnumValue as EnumValueData,
  Layout,
  LayoutEntry,
  Package as PackageData,
} from '@xomda/core'
