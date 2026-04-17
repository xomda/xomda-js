package org.xomda.generator.template.processor;

import org.xomda.generator.template.CellType;
import org.xomda.generator.template.TemplateCell;

/**
 * Loop cells are handled by TemplateEngine (it drives recursive iteration over the cell's children once per yielded
 * item). The processor itself is a no-op marker so PROCESSORS.get(LOOP) still resolves.
 */
public class LoopProcessor implements CellProcessor {

    private final CellType type;

    public LoopProcessor(CellType type) {
        this.type = type;
    }

    @Override
    public CellType getType() {
        return type;
    }

    @Override
    public void execute(TemplateCell cell, CellContext ctx) {
        // Handled by TemplateEngine — no-op here
    }
}
