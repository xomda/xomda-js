package org.xomda.generator.template;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.jknack.handlebars.Handlebars;
import org.graalvm.polyglot.Context;
import org.xomda.generator.Helpers;
import org.graalvm.polyglot.HostAccess;
import org.graalvm.polyglot.Source;
import org.graalvm.polyglot.Value;
import org.xomda.generator.template.processor.CellContext;
import org.xomda.generator.template.processor.CellProcessor;
import org.xomda.generator.template.processor.CellState;
import org.xomda.generator.template.processor.ProcessorRegistry;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Template execution engine — thin orchestrator that recurses through the
 * (now hierarchical) cell tree. Loop cells iterate over their children.
 *
 * Mirrors the TypeScript {@code executeTemplate()} function.
 */
public class TemplateEngine {

    private static final String HELPERS_JS = """
            function pascalCase(s) {
                if (!s) return '';
                return s.replace(/(^\\w|[\\s_-]\\w)/g, m => m.slice(-1).toUpperCase()).replace(/[\\s_-]/g, '');
            }
            function camelCase(s) {
                var p = pascalCase(s);
                return p.length === 0 ? '' : p[0].toLowerCase() + p.slice(1);
            }
            function snakeCase(s) {
                if (!s) return '';
                return s.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\\s-]+/g, '_').toLowerCase();
            }
            function kebabCase(s) {
                return snakeCase(s).replace(/_/g, '-');
            }
            function constantCase(s) {
                return snakeCase(s).toUpperCase();
            }
            function upperCase(s) { return s ? s.toUpperCase() : ''; }
            function lowerCase(s) { return s ? s.toLowerCase() : ''; }
            """;

    private final ObjectMapper mapper;

    public TemplateEngine() {
        this.mapper = new ObjectMapper();
    }

    public List<FileOutput> executeTemplate(
            Template template,
            Object model,
            Map<String, Object> scopeContext
    ) throws IOException {
        List<FileOutput> files = new ArrayList<>();
        Map<String, Object> variables = new LinkedHashMap<>();

        @SuppressWarnings("unchecked")
        Map<String, Object> modelMap = mapper.convertValue(model, Map.class);

        Handlebars handlebars = buildHandlebars();

        try (Context graalCtx = buildGraalContext()) {
            graalCtx.eval(Source.newBuilder("js", HELPERS_JS, "<helpers>").build());

            var bindings = graalCtx.getBindings("js");
            bindings.putMember("model", modelMap);
            if (scopeContext != null) {
                scopeContext.forEach(bindings::putMember);
            }

            ProcessorRegistry registry = new ProcessorRegistry(graalCtx, handlebars);

            executeCells(
                    template.getCells(),
                    template.getUuid(),
                    modelMap, scopeContext, variables, files,
                    new ArrayList<>(),
                    bindings, registry, graalCtx
            );
        }

        return files;
    }

    public List<FileOutput> executeTemplate(Template template, Object model) throws IOException {
        return executeTemplate(template, model, null);
    }

    private void executeCells(
            List<TemplateCell> cells,
            String templateUuid,
            Map<String, Object> modelMap,
            Map<String, Object> scopeContext,
            Map<String, Object> variables,
            List<FileOutput> files,
            List<OutputBuffer> cellBuffers,
            Value bindings,
            ProcessorRegistry registry,
            Context graalCtx
    ) throws IOException {
        if (cells == null) return;
        for (TemplateCell cell : cells) {
            if (cell.isLoop()) {
                OutputBuffer aggregate = new OutputBuffer();
                cellBuffers.add(aggregate);

                String varName = cell.getVariableName() != null ? cell.getVariableName() : "item";
                List<Map<String, Object>> items = collectLoopItems(cell, modelMap);

                for (Map<String, Object> item : items) {
                    Map<String, Object> iterVars = new LinkedHashMap<>(variables);
                    iterVars.put(varName, item);
                    iterVars.putAll(item);
                    // bind iteration variables into the JS context for child logic cells
                    iterVars.forEach(bindings::putMember);

                    List<OutputBuffer> childBuffers = new ArrayList<>();
                    executeCells(
                            cell.getChildren(),
                            templateUuid,
                            modelMap, scopeContext, iterVars, files, childBuffers,
                            bindings, registry, graalCtx
                    );
                    // Any non-consumed child content bubbles up into the loop's aggregate.
                    for (OutputBuffer b : childBuffers) aggregate.write(b.getContent());
                }
                continue;
            }

            OutputBuffer $out = new OutputBuffer();
            cellBuffers.add($out);
            bindings.putMember("$out", $out);

            CellState state = new CellState();
            CellContext cellCtx = new CellContext(
                    modelMap, scopeContext, templateUuid,
                    variables, cellBuffers, files, $out, state
            );

            CellProcessor processor = registry.get(cell.getType());
            try {
                processor.execute(cell, cellCtx);
            } catch (Exception e) {
                state.setError(e.getMessage());
            }
            state.setDone(true);
            if (state.getOutput().isEmpty()) state.setOutput($out.getContent());

            // File output consumed prior buffers; drop its own $out so the
            // surrounding scope (e.g. a parent loop) doesn't re-emit the file.
            if (cell.getType() == CellType.OUTPUT) {
                cellBuffers.remove(cellBuffers.size() - 1);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> collectLoopItems(TemplateCell cell, Map<String, Object> modelMap) {
        String source = cell.getLoopSource();
        if (cell.getType() == CellType.LOOP_LOGIC) source = "javascript";

        if (source == null || source.isEmpty() || "entities".equals(source)) {
            return collectAll(modelMap, "entities");
        }
        if ("enums".equals(source)) return collectAll(modelMap, "enums");
        if ("packages".equals(source)) return collectAll(modelMap, "packages");
        // javascript / diff-* sources: not yet supported on the JVM side
        // (would require running cell.content as a GraalVM generator).
        return List.of();
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

    private static Context buildGraalContext() {
        return Context.newBuilder("js")
                .allowAllAccess(false)
                .allowHostAccess(HostAccess.ALL)
                .build();
    }

    private static Handlebars buildHandlebars() {
        Handlebars hb = new Handlebars();
        Helpers.register(hb);
        return hb;
    }
}
