package org.xomda.generator.template;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class TemplateCell {
    private String uuid;
    private CellType type;
    private String content = "";
    private String variableName;
    private OutputType outputType;
    private String outputFilename;
    private String outputDirectory;
    private String outputContent;
    private String loopSource;
    private String loopFilter;
    private List<TemplateCell> children;

    public String getUuid() {
        return uuid;
    }
    public void setUuid(String uuid) {
        this.uuid = uuid;
    }

    public CellType getType() {
        return type;
    }
    public void setType(CellType type) {
        this.type = type;
    }

    public String getContent() {
        return content != null ? content : "";
    }
    public void setContent(String content) {
        this.content = content;
    }

    public String getVariableName() {
        return variableName;
    }
    public void setVariableName(String variableName) {
        this.variableName = variableName;
    }

    /**
     * Cell dispatch on the output processor: {@code FILE} (default) writes the rendered content to
     * {@link #getOutputFilename()}; {@code CONTEXT} stashes it into the variable named by {@link #getOutputContent()}
     * for later cells to consume — and does NOT clear the surrounding cell buffers (so a wrapping aggregate keeps its
     * accumulated content).
     */
    public OutputType getOutputType() {
        return outputType;
    }
    public void setOutputType(OutputType outputType) {
        this.outputType = outputType;
    }

    public String getOutputFilename() {
        return outputFilename;
    }
    public void setOutputFilename(String outputFilename) {
        this.outputFilename = outputFilename;
    }

    public String getOutputDirectory() {
        return outputDirectory;
    }
    public void setOutputDirectory(String outputDirectory) {
        this.outputDirectory = outputDirectory;
    }

    public String getOutputContent() {
        return outputContent;
    }
    public void setOutputContent(String outputContent) {
        this.outputContent = outputContent;
    }

    /** "entities" | "enums" | "packages" | "javascript" or a diff-* source — only for loop cells. */
    @JsonAlias("providerSource")
    public String getLoopSource() {
        return loopSource;
    }
    public void setLoopSource(String loopSource) {
        this.loopSource = loopSource;
    }

    /**
     * Optional JavaScript predicate applied to each item produced by the loop source. Engine-side filtering is not yet
     * implemented JVM-side; the field is round-tripped so a template authored in xomda survives the JVM generator
     * without silent data loss.
     */
    public String getLoopFilter() {
        return loopFilter;
    }
    public void setLoopFilter(String loopFilter) {
        this.loopFilter = loopFilter;
    }

    /** Nested cells executed per loop iteration. Null/empty for non-loop cells. */
    public List<TemplateCell> getChildren() {
        return children;
    }
    public void setChildren(List<TemplateCell> children) {
        this.children = children;
    }

    public boolean isLoop() {
        return type == CellType.LOOP || type == CellType.LOOP_LOGIC;
    }
}
