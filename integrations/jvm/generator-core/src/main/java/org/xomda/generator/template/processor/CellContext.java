package org.xomda.generator.template.processor;

import org.xomda.generator.template.FileOutput;
import org.xomda.generator.template.OutputBuffer;

import java.util.List;
import java.util.Map;

public class CellContext {
    private final Map<String, Object> modelMap;
    private final Map<String, Object> scopeContext;
    private final String templateUuid;
    private final Map<String, Object> variables;
    private final List<OutputBuffer> cellBuffers;
    private final List<FileOutput> files;
    private final OutputBuffer $out;
    private final CellState state;

    public CellContext(
            Map<String, Object> modelMap,
            Map<String, Object> scopeContext,
            String templateUuid,
            Map<String, Object> variables,
            List<OutputBuffer> cellBuffers,
            List<FileOutput> files,
            OutputBuffer $out,
            CellState state) {
        this.modelMap = modelMap;
        this.scopeContext = scopeContext;
        this.templateUuid = templateUuid;
        this.variables = variables;
        this.cellBuffers = cellBuffers;
        this.files = files;
        this.$out = $out;
        this.state = state;
    }

    public Map<String, Object> getModelMap() {
        return modelMap;
    }
    public Map<String, Object> getScopeContext() {
        return scopeContext;
    }
    public String getTemplateUuid() {
        return templateUuid;
    }
    public Map<String, Object> getVariables() {
        return variables;
    }
    public List<OutputBuffer> getCellBuffers() {
        return cellBuffers;
    }
    public List<FileOutput> getFiles() {
        return files;
    }
    public OutputBuffer get$out() {
        return $out;
    }
    public CellState getState() {
        return state;
    }
}
