package org.xomda.intellij

import java.io.File
import java.nio.file.Path

/**
 * The xomda project layout, mirrored from `@xomda/core` (TS side):
 * `<root>/.xomda/model.json` and `<root>/.xomda/templates/`.
 */
data class XomdaProjectInfo(
    val root: File,
    val xomdaDir: File,
    val modelFile: File,
    val templatesDir: File,
) {
    val isValid: Boolean get() = modelFile.isFile

    companion object {
        const val XOMDA_DIR_NAME = ".xomda"
        const val MODEL_FILE_NAME = "model.json"
        const val TEMPLATES_DIR_NAME = "templates"

        fun discover(root: File): XomdaProjectInfo? {
            val xomdaDir = File(root, XOMDA_DIR_NAME)
            val modelFile = File(xomdaDir, MODEL_FILE_NAME)
            if (!modelFile.isFile) return null
            return XomdaProjectInfo(
                root = root,
                xomdaDir = xomdaDir,
                modelFile = modelFile,
                templatesDir = File(xomdaDir, TEMPLATES_DIR_NAME),
            )
        }

        fun discover(root: Path): XomdaProjectInfo? = discover(root.toFile())
    }
}
