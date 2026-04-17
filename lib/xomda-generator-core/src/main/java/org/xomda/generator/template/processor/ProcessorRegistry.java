package org.xomda.generator.template.processor;

import com.github.jknack.handlebars.Handlebars;
import org.graalvm.polyglot.Context;
import org.xomda.generator.template.CellType;

import java.util.EnumMap;
import java.util.Map;

public class ProcessorRegistry {

    private final Map<CellType, CellProcessor> processors = new EnumMap<>(CellType.class);

    public ProcessorRegistry(Context graalCtx, Handlebars handlebars) {
        HandlebarsProcessor hbProcessor = new HandlebarsProcessor(handlebars);
        register(new LogicProcessor(graalCtx));
        register(new BufferProcessor());
        register(hbProcessor);
        register(new OutputProcessor(hbProcessor));
        register(new MarkdownProcessor());
        register(new ProviderProcessor());
    }

    private void register(CellProcessor processor) {
        processors.put(processor.getType(), processor);
    }

    public CellProcessor get(CellType type) {
        CellProcessor p = processors.get(type);
        if (p == null) throw new IllegalArgumentException("No processor for cell type: " + type);
        return p;
    }
}
