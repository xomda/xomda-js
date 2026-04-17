package org.xomda.generator.template;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

public class TemplateStorage {

    private static final String EXTENSION = ".template.json";
    private static final String TEMPLATES_DIR = ".xomda/templates";

    private final Path templatesDir;
    private final ObjectMapper mapper = new ObjectMapper();

    /** Constructs storage using {@code projectRoot/.xomda/templates} as the templates directory. */
    public TemplateStorage(Path projectRoot) {
        this.templatesDir = projectRoot.resolve(TEMPLATES_DIR);
    }

    private TemplateStorage(Path dir, @SuppressWarnings("unused") boolean direct) {
        this.templatesDir = dir;
    }

    /** Constructs storage pointing directly to the given templates directory. */
    public static TemplateStorage fromTemplatesDir(Path dir) {
        return new TemplateStorage(dir, true);
    }

    public List<Template> listTemplates() throws IOException {
        List<Template> results = new ArrayList<>();
        if (!Files.isDirectory(templatesDir)) return results;

        try (Stream<Path> stream = Files.walk(templatesDir)) {
            stream.filter(p -> p.toString().endsWith(EXTENSION))
                  .forEach(p -> {
                      try {
                          Template t = mapper.readValue(p.toFile(), Template.class);
                          TemplateNormalizer.normalize(t);
                          results.add(t);
                      } catch (IOException e) {
                          // Skip malformed files
                      }
                  });
        }
        return results;
    }

    public Template findByUuid(String uuid) throws IOException {
        if (uuid == null) return null;
        for (Template t : listTemplates()) {
            if (uuid.equals(t.getUuid())) return t;
        }
        return null;
    }
}
