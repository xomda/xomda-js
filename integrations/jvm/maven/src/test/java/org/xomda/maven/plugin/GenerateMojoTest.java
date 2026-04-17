package org.xomda.maven.plugin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class GenerateMojoTest {

    @Test
    void generatesCellBasedTemplate(@TempDir Path testProjectDir) throws Exception {
        File xomdaDir = testProjectDir.resolve(".xomda").toFile();
        xomdaDir.mkdirs();

        File modelFile = new File(xomdaDir, "model.json");
        Files.writeString(modelFile.toPath(),
                "{\"id\":\"m\",\"name\":\"TestModel\",\"version\":\"1.0.0\",\"packages\":[],\"elementsOrder\":[]}");

        File templatesDir = new File(xomdaDir, "templates");
        templatesDir.mkdirs();

        String uuid1 = UUID.randomUUID().toString();
        String uuid2 = UUID.randomUUID().toString();
        String templateUuid = UUID.randomUUID().toString();
        Files.writeString(new File(templatesDir, "greeting.template.json").toPath(),
                "{\"uuid\":\"" + templateUuid + "\",\"name\":\"Greeting\",\"version\":\"1.0.0\",\"cells\":["
                        + "{\"uuid\":\"" + uuid1
                        + "\",\"type\":\"logic\",\"content\":\"return 'World'\",\"variableName\":\"who\"},"
                        + "{\"uuid\":\"" + uuid2 + "\",\"type\":\"output\",\"content\":\"\","
                        + "\"outputFilename\":\"greeting.txt\",\"outputContent\":\"who\"}"
                        + "]}");

        GenerateMojo mojo = new GenerateMojo();
        setField(mojo, "modelFile", modelFile);
        setField(mojo, "templatesDir", templatesDir);
        File outputDir = testProjectDir.resolve("target/generated-sources/xomda").toFile();
        setField(mojo, "outputDir", outputDir);

        mojo.execute();

        File greetingFile = new File(outputDir, "greeting.txt");
        assertTrue(greetingFile.exists(), "Cell-based template output should exist");
        assertEquals("World", Files.readString(greetingFile.toPath()).trim());
    }

    private void setField(Object obj, String fieldName, Object value) throws Exception {
        Field field = obj.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(obj, value);
    }
}
