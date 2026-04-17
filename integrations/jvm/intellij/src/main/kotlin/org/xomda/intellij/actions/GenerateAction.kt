package org.xomda.intellij.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VfsUtil
import org.xomda.generator.Logger
import org.xomda.generator.XomdaGenerator
import org.xomda.intellij.XomdaProjectInfo
import java.io.File

class GenerateAction : AnAction() {
    override fun update(e: AnActionEvent) {
        val project = e.project
        e.presentation.isEnabled = project != null && discover(project) != null
    }

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val info = discover(project) ?: return
        runGenerate(project, info)
    }

    private fun discover(project: Project): XomdaProjectInfo? {
        val basePath = project.basePath ?: return null
        return XomdaProjectInfo.discover(File(basePath))
    }

    private fun runGenerate(project: Project, info: XomdaProjectInfo) {
        val task = object : Task.Backgroundable(project, "Xomda: generating", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.isIndeterminate = true
                val generator = XomdaGenerator.builder()
                    .modelFile(info.modelFile)
                    .templatesDir(info.templatesDir)
                    .outputDir(info.root)
                    .logger(idePluginLogger(project))
                    .build()
                val generated = generator.generate()
                refreshGeneratedFiles(generated)
                notify(project, "Xomda: generated ${generated.size} file(s).", NotificationType.INFORMATION)
            }

            override fun onThrowable(error: Throwable) {
                notify(project, "Xomda generate failed: ${error.message}", NotificationType.ERROR)
            }
        }
        task.queue()
    }

    private fun refreshGeneratedFiles(files: List<File>) {
        val vfs = LocalFileSystem.getInstance()
        for (file in files) {
            val parent = file.parentFile ?: continue
            val vDir = vfs.refreshAndFindFileByIoFile(parent) ?: continue
            VfsUtil.markDirtyAndRefresh(true, true, false, vDir)
        }
    }

    private fun idePluginLogger(project: Project): Logger {
        return Logger { level, message, error ->
            if (level == Logger.Level.ERROR) {
                val suffix = error?.message?.let { ": $it" }.orEmpty()
                notify(project, "Xomda: $message$suffix", NotificationType.WARNING)
            }
        }
    }

    private fun notify(project: Project, content: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("Xomda")
            .createNotification(content, type)
            .notify(project)
    }
}
