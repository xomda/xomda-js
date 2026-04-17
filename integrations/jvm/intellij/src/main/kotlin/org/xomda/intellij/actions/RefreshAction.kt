package org.xomda.intellij.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.wm.ToolWindowManager
import org.xomda.intellij.XomdaToolWindowPanel

class RefreshAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("Xomda") ?: return
        for (content in toolWindow.contentManager.contents) {
            (content.component as? XomdaToolWindowPanel)?.refresh()
        }
    }
}
