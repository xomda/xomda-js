package org.xomda.generator.template;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Scope-aware renderer — mirrors TypeScript {@code renderTemplateByScope()}.
 *
 * Handles provider cells, legacy scope enum, and template inheritance.
 */
public class TemplateRenderer {

    private final TemplateEngine engine;
    private final TemplateStorage storage;
    private final ObjectMapper mapper = new ObjectMapper();

    public TemplateRenderer(TemplateStorage storage) {
        this.engine = new TemplateEngine();
        this.storage = storage;
    }

    public List<FileOutput> render(Template template, Object model) throws IOException {
        Template resolved = resolveInheritance(template, new HashSet<>());
        @SuppressWarnings("unchecked")
        Map<String, Object> modelMap = mapper.convertValue(model, Map.class);

        // Check for a provider cell (first one wins)
        TemplateCell providerCell = resolved.getCells().stream()
                .filter(c -> c.getType() == CellType.PROVIDER)
                .findFirst()
                .orElse(null);

        if (providerCell != null) {
            return renderWithProvider(resolved, modelMap, providerCell);
        }

        // Legacy scope fallback
        return switch (resolved.getScope() != null ? resolved.getScope() : "") {
            case "Entity"  -> renderPerScope(resolved, modelMap, "entities", "entity");
            case "Enum"    -> renderPerScope(resolved, modelMap, "enums", "enum");
            case "Package" -> renderPerScope(resolved, modelMap, "packages", "package");
            default        -> engine.executeTemplate(resolved, modelMap);
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
            Map<String, Object> ctx = new LinkedHashMap<>();
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

    private Template resolveInheritance(Template template, Set<String> visited) throws IOException {
        if (template.getExtendsUuid() == null || visited.contains(template.getUuid())) {
            return template;
        }
        visited.add(template.getUuid());
        Template parent = storage.findByUuid(template.getExtendsUuid());
        if (parent == null) return template;

        Template resolvedParent = resolveInheritance(parent, visited);
        List<TemplateCell> merged = new ArrayList<>(resolvedParent.getCells());
        merged.addAll(template.getCells());

        Template result = new Template();
        result.setUuid(template.getUuid());
        result.setName(template.getName());
        result.setScope(template.getScope());
        result.setVersion(template.getVersion());
        result.setCells(merged);
        return result;
    }
}
