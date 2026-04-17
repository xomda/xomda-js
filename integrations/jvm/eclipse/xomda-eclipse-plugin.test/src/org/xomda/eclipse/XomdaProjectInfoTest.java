package org.xomda.eclipse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class XomdaProjectInfoTest {

    @Test
    void discoverReturnsNullWhenModelJsonIsAbsent(@TempDir Path tmp) {
        assertNull(XomdaProjectInfo.discover(tmp));
    }

    @Test
    void discoverReturnsInfoWhenModelJsonIsPresent(@TempDir Path tmp) throws IOException {
        Path xomdaDir = tmp.resolve(".xomda");
        Files.createDirectories(xomdaDir);
        Files.writeString(xomdaDir.resolve("model.json"), "{}");

        XomdaProjectInfo info = XomdaProjectInfo.discover(tmp);
        assertNotNull(info);
        assertEquals(tmp.toFile(), info.getRoot());
        assertEquals(xomdaDir.toFile(), info.getXomdaDir());
        assertEquals(xomdaDir.resolve("model.json").toFile(), info.getModelFile());
        assertEquals(xomdaDir.resolve("templates").toFile(), info.getTemplatesDir());
        assertTrue(info.isValid());
    }
}
