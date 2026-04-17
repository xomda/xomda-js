package org.xomda.generator.template.processor;

import org.xomda.generator.template.CellType;
import org.xomda.generator.template.TemplateCell;

public class MarkdownProcessor implements CellProcessor {

    @Override
    public CellType getType() { return CellType.MARKDOWN; }

    @Override
    public void execute(TemplateCell cell, CellContext ctx) {
        // Markdown cells are display-only; no execution
    }
}
