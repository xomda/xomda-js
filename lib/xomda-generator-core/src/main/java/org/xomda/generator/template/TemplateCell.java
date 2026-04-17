package org.xomda.generator.template;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class TemplateCell {
    private String uuid;
    private CellType type;
    private String content = "";
    private String variableName;
    private String outputFilename;
    private String outputDirectory;
    private String outputContent;
    private String providerSource;

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public CellType getType() { return type; }
    public void setType(CellType type) { this.type = type; }

    public String getContent() { return content != null ? content : ""; }
    public void setContent(String content) { this.content = content; }

    public String getVariableName() { return variableName; }
    public void setVariableName(String variableName) { this.variableName = variableName; }

    public String getOutputFilename() { return outputFilename; }
    public void setOutputFilename(String outputFilename) { this.outputFilename = outputFilename; }

    public String getOutputDirectory() { return outputDirectory; }
    public void setOutputDirectory(String outputDirectory) { this.outputDirectory = outputDirectory; }

    public String getOutputContent() { return outputContent; }
    public void setOutputContent(String outputContent) { this.outputContent = outputContent; }

    /** "entities" | "enums" | "packages" | "javascript" — only for provider cells */
    public String getProviderSource() { return providerSource; }
    public void setProviderSource(String providerSource) { this.providerSource = providerSource; }
}
