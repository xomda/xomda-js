package org.xomda.maven.plugin;

import org.junit.Test;

import java.io.File;
import java.nio.file.Files;
import java.lang.reflect.Field;

import static org.junit.Assert.*;

public class GenerateMojoTest {

  @Test
  public void testGenerate() throws Exception {
    File testProjectDir = new File("target/test-project");
    if (testProjectDir.exists()) {
      deleteDirectory(testProjectDir);
    }
    testProjectDir.mkdirs();

    // Setup a dummy project structure
    File xomdaDir = new File(testProjectDir, ".xomda");
    xomdaDir.mkdirs();

    File modelFile = new File(xomdaDir, "model.json");
    Files.writeString(modelFile.toPath(),
      "{\"name\": \"TestModel\", " +
        " \"entities\": [{\"name\": \"user-profile\"}], " +
        " \"packages\": [{\"name\": \"org.example.api\"}]" +
        "}");

    File templatesDir = new File(xomdaDir, "templates");
    templatesDir.mkdirs();

    // Entity template
    Files.writeString(new File(templatesDir, "entity.hbs").toPath(),
      "---\nscope: Entity\noutputPath: \"{{pascalCase name}}.java\"\n---\npublic class {{pascalCase name}} {}");

    // Package template
    Files.writeString(new File(templatesDir, "package.hbs").toPath(),
      "---\nscope: Package\noutputPath: \"{{name}}/package-info.java\"\n---\n/** Package info for {{name}} */");

    // Model template (default scope)
    Files.writeString(new File(templatesDir, "model.hbs").toPath(),
      "---\noutputPath: \"model-info.txt\"\n---\nModel name: {{name}}");

    // Disabled template
    Files.writeString(new File(templatesDir, "disabled.hbs").toPath(),
      "---\ndisabled: true\noutputPath: \"disabled-info.txt\"\n---\nShould not be generated");

    GenerateMojo mojo = new GenerateMojo();

    setField(mojo, "modelFile", modelFile);
    setField(mojo, "templatesDir", templatesDir);
    File outputDir = new File(testProjectDir, "target/generated-sources/xomda");
    setField(mojo, "outputDir", outputDir);

    mojo.execute();

    // Verify Entity output
    File entityFile = new File(outputDir, "UserProfile.java");
    assertTrue("Entity file should exist", entityFile.exists());
    assertEquals("public class UserProfile {}", Files.readString(entityFile.toPath()).trim());

    // Verify Package output
    File packageFile = new File(outputDir, "org.example.api/package-info.java");
    assertTrue("Package file should exist", packageFile.exists());
    assertEquals("/** Package info for org.example.api */", Files.readString(packageFile.toPath()).trim());

    // Verify Model output
    File modelInfoFile = new File(outputDir, "model-info.txt");
    assertTrue("Model info file should exist", modelInfoFile.exists());
    assertEquals("Model name: TestModel", Files.readString(modelInfoFile.toPath()).trim());

    // Verify Disabled template
    File disabledFile = new File(outputDir, "disabled-info.txt");
    assertFalse("Disabled template file should not exist", disabledFile.exists());
  }

  @Test
  public void testGenerateCellBasedTemplate() throws Exception {
    File testProjectDir = new File("target/test-project-cell");
    if (testProjectDir.exists()) deleteDirectory(testProjectDir);
    testProjectDir.mkdirs();

    File xomdaDir = new File(testProjectDir, ".xomda");
    xomdaDir.mkdirs();

    File modelFile = new File(xomdaDir, "model.json");
    Files.writeString(modelFile.toPath(),
      "{\"id\":\"m\",\"name\":\"TestModel\",\"version\":\"1.0.0\",\"packages\":[],\"elementsOrder\":[]}");

    File templatesDir = new File(xomdaDir, "templates");
    templatesDir.mkdirs();

    // A .template.json cell-based template
    String uuid1 = java.util.UUID.randomUUID().toString();
    String uuid2 = java.util.UUID.randomUUID().toString();
    String templateUuid = java.util.UUID.randomUUID().toString();
    Files.writeString(new File(templatesDir, "greeting.template.json").toPath(),
      "{\"uuid\":\"" + templateUuid + "\",\"name\":\"Greeting\",\"version\":\"1.0.0\",\"cells\":["
        + "{\"uuid\":\"" + uuid1 + "\",\"type\":\"logic\",\"content\":\"return 'World'\",\"variableName\":\"who\"},"
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
