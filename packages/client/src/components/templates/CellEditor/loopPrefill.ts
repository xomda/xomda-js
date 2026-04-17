/**
 * Default content for a freshly-created JS-generator loop cell. The result
 * is the body of an outer function whose return value is either an iterable
 * or a function `(collection, index) => Iterable`. In scope: `model`,
 * `diff`, `$ctx`, and each ancestor loop's variable name.
 *
 * When the loop sits inside one or more parent loops, prepend a comment
 * listing the in-scope variables and explaining the binding of the inner
 * function's first argument. At the top level no comment is emitted.
 */
export function buildLoopDefaultContent(scopeVariables: readonly string[]): string {
  const scope = scopeVariables.filter((n): n is string => Boolean(n))
  if (scope.length === 0) {
    // Top-level: walk all entities in the model.
    return [
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
  const inScope = ['model', 'diff', '$ctx', ...scope].join(', ')
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
