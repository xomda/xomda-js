// Side-effect imports of each plugin's client half. Importing this
// aggregator wires every plugin's icon and preview components into the
// @xomda/analysis-client registry. Adding a plugin = create the package
// (with a `./client` export) + add one import line here.
import '@xomda/plugin-analysis-ant/client'
import '@xomda/plugin-analysis-binary/client'
import '@xomda/plugin-analysis-eslint/client'
import '@xomda/plugin-analysis-gradle/client'
import '@xomda/plugin-analysis-intellij/client'
import '@xomda/plugin-analysis-markdown/client'
import '@xomda/plugin-analysis-maven/client'
import '@xomda/plugin-analysis-node/client'
import '@xomda/plugin-analysis-prettier/client'
import '@xomda/plugin-analysis-rust/client'
import '@xomda/plugin-analysis-stylelint/client'
import '@xomda/plugin-analysis-typescript/client'
import '@xomda/plugin-analysis-visualstudio/client'
import '@xomda/plugin-analysis-vite/client'
import '@xomda/plugin-analysis-vscode/client'
import '@xomda/plugin-analysis-webpack/client'
import '@xomda/plugin-analysis-xomda/client'
