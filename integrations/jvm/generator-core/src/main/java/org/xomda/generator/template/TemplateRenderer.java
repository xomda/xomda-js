package org.xomda.generator.template;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Scope-aware renderer — mirrors TypeScript {@code renderTemplateByScope()}.
 *
 * The hierarchical loop model lives inside {@link TemplateEngine}; this class
 * only handles the legacy {@code template.scope} fallback for templates that
 * predate loop cells.
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

        if (hasTopLevelLoop(template.getCells())) {
            return engine.executeTemplate(template, modelMap);
        }

        return switch (template.getScope() != null ? template.getScope() : "") {
            case "Entity"  -> renderPerScope(template, modelMap, "entities", "entity");
            case "Enum"    -> renderPerScope(template, modelMap, "enums", "enum");
            case "Package" -> renderPerScope(template, modelMap, "packages", "package");
            default        -> engine.executeTemplate(template, modelMap);
        };
    }

    private static boolean hasTopLevelLoop(List<TemplateCell> cells) {
        if (cells == null) return false;
        for (TemplateCell c : cells) {
            if (c.isLoop()) return true;
        }
        return false;
    }

    private List<FileOutput> renderPerScope(
            Template template,
            Map<String, Object> modelMap,
            String collectionKey,
            String scopeKey
    ) throws IOException {
        List<FileOutput> results = new ArrayList<>();
        List<Map<String, Object>> items = collectAll(modelMap, collectionKey);
        for (Map<String, Object> item : items) {
            Map<String, Object> ctx = new LinkedHashMap<>(item);
            ctx.put(scopeKey, item);
            results.addAll(engine.executeTemplate(template, modelMap, ctx));
        }
        return results;
    }

    private static List<Map<String, Object>> collectAll(Map<String, Object> modelMap, String key) {
        List<Map<String, Object>> result = new ArrayList<>();
        collectRecursive(modelMap, key, result);
        return result;
    }

    @SuppressWarnings("unchecked")
    private static void collectRecursive(
            Map<String, Object> node,
            String key,
            List<Map<String, Object>> acc
    ) {
        Object items = node.get(key);
        if (items instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> m) acc.add((Map<String, Object>) m);
            }
        }
        Object packages = node.get("packages");
        if (packages instanceof List<?> list) {
            for (Object pkg : list) {
                if (pkg instanceof Map<?, ?> m) collectRecursive((Map<String, Object>) m, key, acc);
            }
        }
    }
}
