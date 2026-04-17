package org.xomda.generator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import org.yaml.snakeyaml.Yaml;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Renders a single .hbs template against a model, honoring YAML frontmatter. */
final class TemplateProcessor {

  private final Handlebars handlebars;
  private final ObjectMapper mapper;
  private final Yaml yaml;
  private final File outputDir;
  private final Logger logger;

  TemplateProcessor(Handlebars handlebars, ObjectMapper mapper, Yaml yaml, File outputDir, Logger logger) {
    this.handlebars = handlebars;
    this.mapper = mapper;
    this.yaml = yaml;
    this.outputDir = outputDir;
    this.logger = logger;
  }

  /** @return the list of files written for this template. */
  List<File> process(Path templatePath, JsonNode model) throws IOException {
    String content = Files.readString(templatePath);
    Map<String, Object> frontmatter = new HashMap<>();
    String templateBody = content;

    if (content.startsWith("---")) {
      int end = content.indexOf("---", 3);
      if (end != -1) {
        String yamlContent = content.substring(3, end);
        Map<String, Object> parsed = yaml.load(yamlContent);
        if (parsed != null) frontmatter = parsed;
        templateBody = content.substring(end + 3).trim();
      }
    }

    String outputPathExpr = (String) frontmatter.getOrDefault(
      "outputPath", templatePath.getFileName().toString().replace(".hbs", ""));
    Scope scope = Scope.parse((String) frontmatter.get("scope"));
    Object disabledObj = frontmatter.get("disabled");
    if (disabledObj != null && Helpers.isTruthy(disabledObj)) {
      logger.info("Skipping disabled template: " + templatePath);
      return List.of();
    }

    Template bodyTemplate = handlebars.compileInline(templateBody);
    Template pathTemplate = handlebars.compileInline(outputPathExpr);

    List<File> generated = new ArrayList<>();
    switch (scope) {
      case ENTITY -> {
        JsonNode entities = model.get("entities");
        if (entities != null && entities.isArray()) {
          for (JsonNode entity : entities) {
            generated.add(render(entity, model, bodyTemplate, pathTemplate));
          }
        }
      }
      case PACKAGE -> {
        JsonNode packages = model.get("packages");
        if (packages != null && packages.isArray()) {
          for (JsonNode pkg : packages) {
            generated.add(render(pkg, model, bodyTemplate, pathTemplate));
          }
        }
      }
      case MODEL -> generated.add(render(model, model, bodyTemplate, pathTemplate));
    }
    return generated;
  }

  private File render(JsonNode contextNode, JsonNode model, Template bodyTemplate, Template pathTemplate) throws IOException {
    Map<String, Object> context = new HashMap<>();
    context.put("model", mapper.convertValue(model, Map.class));
    if (contextNode != model) {
      context.put("entity", mapper.convertValue(contextNode, Map.class));
      context.putAll(mapper.convertValue(contextNode, Map.class));
    } else {
      context.putAll(mapper.convertValue(model, Map.class));
    }

    String relativePath = pathTemplate.apply(context);
    String renderedContent = bodyTemplate.apply(context);

    File outputFile = new File(outputDir, relativePath);
    File parent = outputFile.getParentFile();
    if (parent != null) parent.mkdirs();
    Files.writeString(outputFile.toPath(), renderedContent);
    logger.info("Generated: " + outputFile.getAbsolutePath());
    return outputFile;
  }
}
