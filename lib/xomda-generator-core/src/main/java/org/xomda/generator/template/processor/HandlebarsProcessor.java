package org.xomda.generator.template.processor;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import org.xomda.generator.template.CellType;
import org.xomda.generator.template.TemplateCell;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

public class HandlebarsProcessor implements CellProcessor {

    private final Handlebars handlebars;

    public HandlebarsProcessor(Handlebars handlebars) {
        this.handlebars = handlebars;
    }

    @Override
    public CellType getType() { return CellType.HANDLEBARS; }

    @Override
    public void execute(TemplateCell cell, CellContext ctx) throws IOException {
        if (cell.getContent().trim().isEmpty()) return;

        Template tmpl = handlebars.compileInline(cell.getContent());
        Map<String, Object> hbCtx = buildContext(ctx);
        String rendered = tmpl.apply(hbCtx);

        ctx.get$out().write(rendered);

        if (cell.getVariableName() != null) {
            ctx.getVariables().put(cell.getVariableName(), rendered);
            ctx.getState().getContextDiff().put(cell.getVariableName(), rendered);
        }
        ctx.getState().setOutput(ctx.get$out().getContent());
    }

    private static Map<String, Object> buildContext(CellContext ctx) {
        Map<String, Object> hbCtx = new LinkedHashMap<>();
        hbCtx.put("model", ctx.getModelMap());
        if (ctx.getScopeContext() != null) hbCtx.putAll(ctx.getScopeContext());
        hbCtx.putAll(ctx.getVariables());
        return hbCtx;
    }

    /** Render a Handlebars template string against a context map (for field interpolation). */
    public String renderField(String field, Map<String, Object> ctx) throws IOException {
        if (field == null || field.isEmpty()) return "";
        return handlebars.compileInline(field).apply(ctx);
    }
}
