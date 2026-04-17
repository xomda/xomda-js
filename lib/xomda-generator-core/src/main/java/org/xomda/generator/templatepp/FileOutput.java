package org.xomda.generator.templatepp;

/** A single generated file produced by an output cell. */
public class FileOutput {
    private final String templateId;
    private final String outputPath;
    private final String content;

    public FileOutput(String templateId, String outputPath, String content) {
        this.templateId = templateId;
        this.outputPath = outputPath;
        this.content = content;
    }

    public String getTemplateId() { return templateId; }
    public String getOutputPath() { return outputPath; }
    public String getContent() { return content; }
}
