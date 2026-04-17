package org.xomda.generator.template.processor;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.PolyglotException;
import org.graalvm.polyglot.Source;
import org.graalvm.polyglot.Value;
import org.xomda.generator.template.CellType;
import org.xomda.generator.template.TemplateCell;

import java.io.IOException;
import java.util.Map;

public class LogicProcessor implements CellProcessor {

    private final Context graalCtx;

    public LogicProcessor(Context graalCtx) {
        this.graalCtx = graalCtx;
    }

    @Override
    public CellType getType() { return CellType.LOGIC; }

    @Override
    public void execute(TemplateCell cell, CellContext ctx) {
        String src = cell.getContent().trim();
        if (src.isEmpty()) return;

        // Always wrap in an IIFE so `return` and multi-statement bodies work correctly
        boolean isStatement = src.contains("return") || src.contains(";")
                || src.startsWith("throw") || src.startsWith("if ");
        String iife = isStatement
                ? "(function() { " + src + " })()"
                : "(function() { return " + src + "; })()";

        Value bindings = graalCtx.getBindings("js");
        syncVariables(bindings, ctx.getVariables());

        try {
            Value result = graalCtx.eval(Source.newBuilder("js", iife, "<logic>").build());
            if (cell.getVariableName() != null) {
                Object javaVal = toJavaValue(result);
                ctx.getVariables().put(cell.getVariableName(), javaVal);
                bindings.putMember(cell.getVariableName(), javaVal);
                ctx.getState().getContextDiff().put(cell.getVariableName(), javaVal);
            }
        } catch (PolyglotException | IOException e) {
            ctx.getState().setError(e.getMessage());
        }
    }

    static void syncVariables(Value bindings, Map<String, Object> variables) {
        variables.forEach(bindings::putMember);
    }

    static Object toJavaValue(Value v) {
        if (v.isNull()) return null;
        if (v.isBoolean()) return v.asBoolean();
        if (v.isNumber()) {
            if (v.fitsInInt()) return v.asInt();
            if (v.fitsInLong()) return v.asLong();
            return v.asDouble();
        }
        if (v.isString()) return v.asString();
        return v;
    }
}
