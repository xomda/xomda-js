package org.xomda.generator.template.processor;

import org.xomda.generator.template.CellType;
import org.xomda.generator.template.OutputBuffer;
import org.xomda.generator.template.TemplateCell;

public class BufferProcessor implements CellProcessor {

    @Override
    public CellType getType() { return CellType.BUFFER; }

    @Override
    public void execute(TemplateCell cell, CellContext ctx) {
        if (cell.getVariableName() == null) return;
        OutputBuffer buf = new OutputBuffer();
        ctx.getVariables().put(cell.getVariableName(), buf);
        ctx.getState().getContextDiff().put(cell.getVariableName(), buf);
    }
}
