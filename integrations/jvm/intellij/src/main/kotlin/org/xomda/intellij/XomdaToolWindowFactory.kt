package org.xomda.intellij

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.ActionPlaces
import com.intellij.openapi.actionSystem.DefaultActionGroup
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import java.awt.BorderLayout
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.JScrollPane
import javax.swing.JTree
import javax.swing.SwingConstants
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeModel

class XomdaToolWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = XomdaToolWindowPanel(project)
        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
    }

    override fun shouldBeAvailable(project: Project): Boolean {
        val basePath = project.basePath ?: return false
        return XomdaProjectInfo.discover(java.io.File(basePath)) != null
    }
}

internal class XomdaToolWindowPanel(private val project: Project) : JPanel(BorderLayout()) {

    private val tree = JTree(DefaultTreeModel(DefaultMutableTreeNode("Loading…")))
    private val emptyLabel = JLabel("No .xomda/model.json found in project root.", SwingConstants.CENTER)

    init {
        add(buildToolbar(), BorderLayout.NORTH)
        add(JScrollPane(tree), BorderLayout.CENTER)
        refresh()
    }

    private fun buildToolbar(): JPanel {
        val group = DefaultActionGroup().apply {
            ActionManager.getInstance().getAction("org.xomda.intellij.Generate")?.let(::add)
            ActionManager.getInstance().getAction("org.xomda.intellij.Refresh")?.let(::add)
        }
        val toolbar = ActionManager.getInstance()
            .createActionToolbar(ActionPlaces.TOOLWINDOW_TITLE, group, true)
        toolbar.targetComponent = this
        return JPanel(BorderLayout()).apply { add(toolbar.component, BorderLayout.CENTER) }
    }

    fun refresh() {
        val basePath = project.basePath
        val info = basePath?.let { XomdaProjectInfo.discover(java.io.File(it)) }
        removeAll()
        add(buildToolbar(), BorderLayout.NORTH)
        if (info == null) {
            add(emptyLabel, BorderLayout.CENTER)
        } else {
            val model = runCatching { XomdaModelReader.read(info.modelFile) }.getOrNull()
            tree.model = DefaultTreeModel(buildRoot(info, model))
            add(JScrollPane(tree), BorderLayout.CENTER)
        }
        revalidate()
        repaint()
    }

    private fun buildRoot(info: XomdaProjectInfo, model: XomdaModel?): DefaultMutableTreeNode {
        val root = DefaultMutableTreeNode(model?.name ?: info.root.name)
        if (model != null) {
            val modelNode = DefaultMutableTreeNode("Model (${model.version})")
            for (pkg in model.packages) modelNode.add(packageNode(pkg))
            root.add(modelNode)
        }
        val templatesNode = DefaultMutableTreeNode("Templates")
        if (info.templatesDir.isDirectory) {
            info.templatesDir.walkTopDown()
                .filter { it.isFile && it.name.endsWith(".template.json") }
                .forEach { templatesNode.add(DefaultMutableTreeNode(it.relativeTo(info.templatesDir).path)) }
        }
        root.add(templatesNode)
        return root
    }

    private fun packageNode(pkg: XomdaPackage): DefaultMutableTreeNode {
        val node = DefaultMutableTreeNode("📦 ${pkg.name}")
        pkg.packages.forEach { node.add(packageNode(it)) }
        pkg.entities.forEach { node.add(DefaultMutableTreeNode("🏷 ${it.name}")) }
        pkg.enums.forEach { node.add(DefaultMutableTreeNode("∑ ${it.name}")) }
        return node
    }
}
