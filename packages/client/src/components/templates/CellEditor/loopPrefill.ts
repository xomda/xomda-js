/**
 * Default content for a freshly-created JS-generator loop cell. The result
 * is the body of an outer function whose return value is either an iterable
 * or a function `(collection, index) => Iterable`. Always prepend a comment
 * listing the in-scope variables so the author sees the current context
 * before writing code.
 */
export function buildLoopDefaultContent(scopeVariables: readonly string[]): string {
  const scope = scopeVariables.filter((n): n is string => Boolean(n))
  const inScope = ['model', 'diff', '$ctx', ...scope].join(', ')

  if (scope.length === 0) {
    return [
      `// In scope: ${inScope}`,
      `return function* (model) {`,
      `  function* walk(pkg) {`,
      `    for (const entity of (pkg.entities ?? [])) yield entity`,
      `    for (const child of (pkg.packages ?? [])) yield* walk(child)`,
      `  }`,
      `  for (const pkg of (model.packages ?? [])) yield* walk(pkg)`,
      `}`,
      ``,
    ].join('\n')
  }

  const parent = scope[scope.length - 1]
  return [
    `// In scope: ${inScope}`,
    `// The returned function's first argument is the current item from the`,
    `// parent loop "${parent}"; the second is its iteration index.`,
    `return function* (${parent}, index) {`,
    `  // yield ...`,
    `}`,
    ``,
  ].join('\n')
}
