package org.xomda.maven.plugin;

import org.junit.Test;

import java.io.File;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.util.UUID;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class GenerateMojoTest {

    @Test
    public void testGenerateCellBasedTemplate() throws Exception {
        File testProjectDir = new File("target/test-project-cell");
        if (testProjectDir.exists())
            deleteDirectory(testProjectDir);
        testProjectDir.mkdirs();

        File xomdaDir = new File(testProjectDir, ".xomda");
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
        File outputDir = new File(testProjectDir, "target/generated-sources/xomda");
        setField(mojo, "outputDir", outputDir);

        mojo.execute();

        File greetingFile = new File(outputDir, "greeting.txt");
        assertTrue("Cell-based template output should exist", greetingFile.exists());
        assertEquals("World", Files.readString(greetingFile.toPath()).trim());
    }

    private void setField(Object obj, String fieldName, Object value) throws Exception {
        Field field = obj.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(obj, value);
    }

    private void deleteDirectory(File directory) {
        File[] allContents = directory.listFiles();
        if (allContents != null) {
            for (File file : allContents) {
                deleteDirectory(file);
            }
        }
        directory.delete();
    }
}
