package org.xomda.intellij

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

class XomdaProjectInfoTest {

    @Test
    fun `discover returns null when model_json is absent`(@TempDir tmp: Path) {
        assertNull(XomdaProjectInfo.discover(tmp))
    }

    @Test
    fun `discover returns info when model_json is present`(@TempDir tmp: Path) {
        val xomdaDir = tmp.resolve(".xomda")
        Files.createDirectories(xomdaDir)
        Files.writeString(xomdaDir.resolve("model.json"), "{}")

        val info = XomdaProjectInfo.discover(tmp)
        assertTrue(info != null)
        assertEquals(tmp.toFile(), info!!.root)
        assertEquals(xomdaDir.toFile(), info.xomdaDir)
        assertEquals(xomdaDir.resolve("model.json").toFile(), info.modelFile)
        assertEquals(xomdaDir.resolve("templates").toFile(), info.templatesDir)
        assertTrue(info.isValid)
    }
}
