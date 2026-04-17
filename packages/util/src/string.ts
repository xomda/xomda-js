export const capitalize = (str: string) =>
  str //
    .charAt(0)
    .toUpperCase() + //
  str.slice(1)

export const toCamel = (str: string) =>
  str.replace(/([-_\s][a-z])/g, (group) =>
    capitalize(
      group //
        .replace(/\s+/, '')
        .replace('-', '')
        .replace('_', '')
    )
  )
