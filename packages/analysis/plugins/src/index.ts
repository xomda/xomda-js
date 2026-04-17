// Each import has the side effect of calling registerAnalysisPlugin
// inside @xomda/analysis-core's registry. Importing this aggregator is
// the only thing the host needs to do — getRegisteredAnalysisPlugins()
// then yields every plugin known to the workspace.
import '@xomda/plugin-analysis-ant'
import '@xomda/plugin-analysis-binary'
import '@xomda/plugin-analysis-eslint'
import '@xomda/plugin-analysis-gradle'
import '@xomda/plugin-analysis-intellij'
import '@xomda/plugin-analysis-markdown'
import '@xomda/plugin-analysis-maven'
import '@xomda/plugin-analysis-node'
import '@xomda/plugin-analysis-prettier'
import '@xomda/plugin-analysis-rust'
import '@xomda/plugin-analysis-stylelint'
import '@xomda/plugin-analysis-typescript'
import '@xomda/plugin-analysis-visualstudio'
import '@xomda/plugin-analysis-vite'
import '@xomda/plugin-analysis-vscode'
import '@xomda/plugin-analysis-webpack'
import '@xomda/plugin-analysis-xomda'
