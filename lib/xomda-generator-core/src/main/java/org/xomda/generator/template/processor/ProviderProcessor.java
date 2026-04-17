package org.xomda.generator.template.processor;

import org.xomda.generator.template.CellType;
import org.xomda.generator.template.TemplateCell;

/**
 * Provider cells are handled by TemplateRenderer (they drive iteration over scope items).
 * The processor itself is a no-op; the renderer detects provider cells and loops
 * the remaining cells once per item.
 */
public class ProviderProcessor implements CellProcessor {

    @Override
    public CellType getType() { return CellType.PROVIDER; }

    @Override
    public void execute(TemplateCell cell, CellContext ctx) {
        // Handled by TemplateRenderer — no-op here
    }
}
