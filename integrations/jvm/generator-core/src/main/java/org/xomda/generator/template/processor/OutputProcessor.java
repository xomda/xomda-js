package org.xomda.generator.template.processor;

import org.xomda.generator.template.CellType;
import org.xomda.generator.template.FileOutput;
import org.xomda.generator.template.OutputBuffer;
import org.xomda.generator.template.TemplateCell;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class OutputProcessor implements CellProcessor {

    private final HandlebarsProcessor hbProcessor;

    public OutputProcessor(HandlebarsProcessor hbProcessor) {
        this.hbProcessor = hbProcessor;
    }

    @Override
    public CellType getType() {
        return CellType.OUTPUT;
    }

    @Override
    public void execute(TemplateCell cell, CellContext ctx) throws IOException {
        String outputFilename = cell.getOutputFilename();
        if (outputFilename == null || outputFilename.isEmpty())
            return;

        Map<String, Object> flatCtx = buildFlatContext(ctx);

        // Evaluate filename using Handlebars (consistent with TypeScript resolveField)
        String filename = hbProcessor.renderField(outputFilename, flatCtx);

        String outputPath = cell.getOutputDirectory() != null && !cell.getOutputDirectory().isEmpty()
                ? cell.getOutputDirectory().replaceAll("/$", "") + "/" + filename
                : filename;

        String content;
        List<OutputBuffer> buffers = ctx.getCellBuffers();
        if (cell.getOutputContent() != null && !cell.getOutputContent().isEmpty()) {
            Object raw = ctx.getVariables().get(cell.getOutputContent());
            content = raw instanceof OutputBuffer ob ? ob.getContent() : String.valueOf(raw != null ? raw : "");
        } else {
            // Concatenate all preceding cell $out buffers (excludes current cell's buffer)
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < buffers.size() - 1; i++) {
                sb.append(buffers.get(i).getContent());
            }
            content = sb.toString();
            // Consume the prior buffers so the surrounding scope (notably a
            // parent loop's aggregate) doesn't re-emit the same content.
            buffers.subList(0, buffers.size() - 1).clear();
        }

        ctx.getFiles().add(new FileOutput(ctx.getTemplateUuid(), outputPath, content));
    }

    private static Map<String, Object> buildFlatContext(CellContext ctx) {
        Map<String, Object> flat = new LinkedHashMap<>();
        flat.put("model", ctx.getModelMap());
        if (ctx.getScopeContext() != null)
            flat.putAll(ctx.getScopeContext());
        flat.putAll(ctx.getVariables());
        return flat;
    }
}
