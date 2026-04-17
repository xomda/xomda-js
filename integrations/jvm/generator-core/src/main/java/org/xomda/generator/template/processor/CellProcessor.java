package org.xomda.generator.template.processor;

import org.xomda.generator.template.CellType;
import org.xomda.generator.template.TemplateCell;

import java.io.IOException;

public interface CellProcessor {
    CellType getType();
    void execute(TemplateCell cell, CellContext ctx) throws IOException;
}
