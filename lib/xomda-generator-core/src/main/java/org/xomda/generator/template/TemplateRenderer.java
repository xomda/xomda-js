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
 * Handles provider cells and the legacy scope enum.
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

        // Check for a provider cell (first one wins)
        TemplateCell providerCell = template.getCells().stream()
                .filter(c -> c.getType() == CellType.PROVIDER)
                .findFirst()
                .orElse(null);

        if (providerCell != null) {
            return renderWithProvider(template, modelMap, providerCell);
        }

        // Legacy scope fallback
        return switch (template.getScope() != null ? template.getScope() : "") {
            case "Entity"  -> renderPerScope(template, modelMap, "entities", "entity");
            case "Enum"    -> renderPerScope(template, modelMap, "enums", "enum");
            case "Package" -> renderPerScope(template, modelMap, "packages", "package");
            default        -> engine.executeTemplate(template, modelMap);
        };
    }

    @SuppressWarnings("unchecked")
    private List<FileOutput> renderWithProvider(
            Template template,
            Map<String, Object> modelMap,
            TemplateCell providerCell
    ) throws IOException {
        String source = providerCell.getProviderSource();
        String varName = providerCell.getVariableName() != null ? providerCell.getVariableName() : "item";

        List<Map<String, Object>> items;
        if (source == null || source.isEmpty() || "entities".equals(source)) {
            items = collectAll(modelMap, "entities");
        } else if ("enums".equals(source)) {
            items = collectAll(modelMap, "enums");
        } else if ("packages".equals(source)) {
            items = collectAll(modelMap, "packages");
        } else {
            // javascript source — skip for now (requires GraalVM generator eval)
            items = List.of();
        }

        List<FileOutput> results = new ArrayList<>();
        for (Map<String, Object> item : items) {
            Map<String, Object> ctx = new LinkedHashMap<>(item);
            ctx.put(varName, item);
            results.addAll(engine.executeTemplate(template, modelMap, ctx));
        }
        return results;
    }

    @SuppressWarnings("unchecked")
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

    @SuppressWarnings("unchecked")
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
