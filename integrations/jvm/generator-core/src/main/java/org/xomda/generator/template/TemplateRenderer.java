package org.xomda.generator.template;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Top-level renderer — mirrors TypeScript {@code renderTemplate()}. Iteration is handled inside {@link TemplateEngine}
 * via loop / loop-logic cells.
 */
public class TemplateRenderer {

    private final TemplateEngine engine;
    private final ObjectMapper mapper = new ObjectMapper();

    public TemplateRenderer() {
        this.engine = new TemplateEngine();
    }

    public List<FileOutput> render(Template template, Object model) throws IOException {
        @SuppressWarnings("unchecked")
        Map<String, Object> modelMap = mapper.convertValue(model, Map.class);
        return engine.executeTemplate(template, modelMap);
    }
}
