package org.xomda.generator.template;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.jknack.handlebars.Handlebars;
import org.graalvm.polyglot.Context;
import org.xomda.generator.Helpers;
import org.graalvm.polyglot.HostAccess;
import org.graalvm.polyglot.Source;
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
 * Template execution engine — thin orchestrator that delegates to per-type processors.
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
        List<OutputBuffer> cellBuffers = new ArrayList<>();

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

            for (TemplateCell cell : template.getCells()) {
                OutputBuffer $out = new OutputBuffer();
                cellBuffers.add($out);
                bindings.putMember("$out", $out);

                CellState state = new CellState();
                CellContext cellCtx = new CellContext(
                        modelMap, scopeContext, template.getUuid(),
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
            }
        }

        return files;
    }

    public List<FileOutput> executeTemplate(Template template, Object model) throws IOException {
        return executeTemplate(template, model, null);
    }

    private static Context buildGraalContext() {
        // Sloppy mode is intentional: logic cells use bare assignment (`name = 'Entity'`)
        // to expose variables, mirroring the TS engine's `with(scope)` trick. Strict mode
        // would throw ReferenceError on the assignment.
        return Context.newBuilder("js")
                .allowAllAccess(false)
                .allowHostAccess(HostAccess.ALL)
                .build();
    }

    private static Handlebars buildHandlebars() {
        Handlebars hb = new Handlebars();
        // Register the full helper surface (jknack StringHelpers, custom case helpers,
        // comparisons, array ops, model-traversal helpers) so handlebars cells in
        // advanced templates see the same helpers as the TS engine.
        Helpers.register(hb);
        return hb;
    }
}
