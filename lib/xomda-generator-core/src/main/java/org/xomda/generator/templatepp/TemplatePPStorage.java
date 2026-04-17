package org.xomda.generator.templatepp;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/** Reads {@code *.template.json} files from the templates directory. */
public class TemplatePPStorage {

    private static final String EXTENSION = ".template.json";
    private static final String TEMPLATES_DIR = ".xomda/templates";

    private final Path templatesDir;
    private final ObjectMapper mapper = new ObjectMapper();

    public TemplatePPStorage(Path projectRoot) {
        this.templatesDir = projectRoot.resolve(TEMPLATES_DIR);
    }

    public List<TemplatePP> listTemplates() throws IOException {
        List<TemplatePP> results = new ArrayList<>();
        if (!Files.isDirectory(templatesDir)) return results;

        try (Stream<Path> stream = Files.walk(templatesDir)) {
            stream.filter(p -> p.toString().endsWith(EXTENSION))
                  .forEach(p -> {
                      try {
                          results.add(mapper.readValue(p.toFile(), TemplatePP.class));
                      } catch (IOException e) {
                          // Skip malformed files
                      }
                  });
        }
        return results;
    }

    public TemplatePP findByUuid(String uuid) throws IOException {
        if (uuid == null) return null;
        for (TemplatePP t : listTemplates()) {
            if (uuid.equals(t.getUuid())) return t;
        }
        return null;
    }
}
