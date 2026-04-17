package org.xomda.generator;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class XomdaGeneratorTest {

  @Test
  void generates_per_entity_file_with_pascalCase_helper(@TempDir Path tmp) throws Exception {
    Path templatesDir = tmp.resolve("templates");
    Files.createDirectories(templatesDir);
    Path outputDir = tmp.resolve("out");
    Path modelFile = tmp.resolve("model.json");

    Files.writeString(modelFile, """
      {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "M",
        "version": "1.0.0",
        "entities": [
          { "id": "a", "name": "user_account", "attributes": [] },
          { "id": "b", "name": "order_item", "attributes": [] }
        ],
        "enums": [],
        "packages": []
      }
      """);

    Files.writeString(templatesDir.resolve("entity.hbs"), """
      ---
      scope: Entity
      outputPath: "{{pascalCase name}}.txt"
      ---
      class {{pascalCase name}} {}
      """);

    List<File> generated = XomdaGenerator.builder()
      .modelFile(modelFile.toFile())
      .templatesDir(templatesDir.toFile())
      .outputDir(outputDir.toFile())
      .build()
      .generate();

    assertEquals(2, generated.size());
    File userAccount = outputDir.resolve("UserAccount.txt").toFile();
    File orderItem = outputDir.resolve("OrderItem.txt").toFile();
    assertTrue(userAccount.exists());
    assertTrue(orderItem.exists());
    assertEquals("class UserAccount {}", Files.readString(userAccount.toPath()).trim());
  }

  @Test
  void renders_model_scope_by_default(@TempDir Path tmp) throws Exception {
    Path templatesDir = tmp.resolve("templates");
    Files.createDirectories(templatesDir);
    Path outputDir = tmp.resolve("out");
    Path modelFile = tmp.resolve("model.json");

    Files.writeString(modelFile, """
      { "id": "x", "name": "Demo", "version": "1.0.0",
        "entities": [], "enums": [], "packages": [] }
      """);
    Files.writeString(templatesDir.resolve("readme.hbs"), "name={{name}}\n");

    List<File> generated = XomdaGenerator.builder()
      .modelFile(modelFile.toFile())
      .templatesDir(templatesDir.toFile())
      .outputDir(outputDir.toFile())
      .build()
      .generate();

    assertEquals(1, generated.size());
    assertEquals("name=Demo", Files.readString(generated.get(0).toPath()).trim());
  }

  @Test
  void skips_disabled_template(@TempDir Path tmp) throws Exception {
    Path templatesDir = tmp.resolve("templates");
    Files.createDirectories(templatesDir);
    Path outputDir = tmp.resolve("out");
    Path modelFile = tmp.resolve("model.json");

    Files.writeString(modelFile, """
      { "id": "x", "name": "M", "version": "1.0.0",
        "entities": [], "enums": [], "packages": [] }
      """);
    Files.writeString(templatesDir.resolve("off.hbs"), """
      ---
      disabled: true
      ---
      should never appear
      """);

    List<File> generated = XomdaGenerator.builder()
      .modelFile(modelFile.toFile())
      .templatesDir(templatesDir.toFile())
      .outputDir(outputDir.toFile())
      .build()
      .generate();

    assertTrue(generated.isEmpty());
  }

  @Test
  void returns_empty_when_model_or_templates_missing(@TempDir Path tmp) throws Exception {
    File missing = tmp.resolve("nope.json").toFile();
    File missingDir = tmp.resolve("nope").toFile();
    File outputDir = tmp.resolve("out").toFile();

    List<File> result = XomdaGenerator.builder()
      .modelFile(missing)
      .templatesDir(missingDir)
      .outputDir(outputDir)
      .build()
      .generate();

    assertTrue(result.isEmpty());
  }
}
