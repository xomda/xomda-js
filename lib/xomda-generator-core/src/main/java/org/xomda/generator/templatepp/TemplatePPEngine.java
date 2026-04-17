package org.xomda.generator.templatepp;

import org.xomda.generator.template.FileOutput;
import org.xomda.generator.template.TemplateEngine;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** @deprecated Use {@link TemplateEngine} in {@code org.xomda.generator.template} instead. */
@Deprecated
public class TemplatePPEngine {

    private final TemplateEngine delegate = new TemplateEngine();

    public List<FileOutput> executeTemplate(
            TemplatePP template,
            Object model,
            Map<String, Object> scopeContext
    ) throws IOException {
        return delegate.executeTemplate(toTemplate(template), model, scopeContext);
    }

    public List<FileOutput> executeTemplate(TemplatePP template, Object model) throws IOException {
        return delegate.executeTemplate(toTemplate(template), model);
    }

    static org.xomda.generator.template.Template toNewTemplate(TemplatePP pp) {
        return toTemplate(pp);
    }

    private static org.xomda.generator.template.Template toTemplate(TemplatePP pp) {
        org.xomda.generator.template.Template t = new org.xomda.generator.template.Template();
        t.setUuid(pp.getUuid());
        t.setName(pp.getName());
        t.setDescription(pp.getDescription());
        t.setVersion(pp.getVersion());
        t.setScope(pp.getScope());
        t.setExtends(pp.getExtendsUuid());
        List<org.xomda.generator.template.TemplateCell> cells = new ArrayList<>();
        for (TemplateCell old : pp.getCells()) {
            org.xomda.generator.template.TemplateCell c = new org.xomda.generator.template.TemplateCell();
            c.setUuid(old.getUuid());
            c.setType(org.xomda.generator.template.CellType.valueOf(old.getType().name()));
            c.setContent(old.getContent());
            c.setVariableName(old.getVariableName());
            c.setOutputFilename(old.getOutputFilename());
            c.setOutputDirectory(old.getOutputDirectory());
            c.setOutputContent(old.getOutputContent());
            cells.add(c);
        }
        t.setCells(cells);
        return t;
    }
}
