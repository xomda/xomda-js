export interface Attribute {
  id: string
  name: string
  type: string
  required?: boolean
  multiValue?: boolean
  primaryKey?: boolean
  unique?: boolean
  description?: string
}

export interface EntityData {
  id: string
  name: string
  attributes: Attribute[]
  description?: string
}

export interface EnumValueData {
  id: string
  name: string
}

export interface EnumData {
  id: string
  name: string
  values: EnumValueData[]
  description?: string
}

export interface PackageData {
  id: string
  name: string
  packages: PackageData[]
  enums: EnumData[]
  entities: EntityData[]
  description?: string
  elementsOrder?: string[]
}
