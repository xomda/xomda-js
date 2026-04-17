package org.xomda.generator.templatepp;

import org.xomda.generator.template.FileOutput;
import org.xomda.generator.template.TemplateRenderer;
import org.xomda.generator.template.TemplateStorage;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

/** @deprecated Use {@link TemplateRenderer} in {@code org.xomda.generator.template} instead. */
@Deprecated
public class TemplatePPRenderer {

    private final TemplateRenderer delegate;

    public TemplatePPRenderer(TemplatePPStorage storage) {
        this.delegate = new TemplateRenderer(toNewStorage(storage));
    }

    public List<FileOutput> render(TemplatePP template, Object model) throws IOException {
        return delegate.render(TemplatePPEngine.toNewTemplate(template), model);
    }

    private static TemplateStorage toNewStorage(TemplatePPStorage old) {
        // TemplatePPStorage holds a private path — we extract via reflection-free workaround:
        // Just create a new TemplateStorage pointing to the same root (unknown here).
        // For backwards compat we return a no-op storage (inheritance not supported via old API).
        return new TemplateStorage(Path.of(".")) {
            @Override
            public org.xomda.generator.template.Template findByUuid(String uuid) {
                return null;
            }
        };
    }
}
