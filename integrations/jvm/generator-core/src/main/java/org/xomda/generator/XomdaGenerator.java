package org.xomda.generator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.xomda.generator.template.FileOutput;
import org.xomda.generator.template.Template;
import org.xomda.generator.template.TemplateRenderer;
import org.xomda.generator.template.TemplateStorage;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Entry point for the xomda code-generation engine. Reads a JSON model, processes cell-based ({@code .template.json})
 * templates, and writes generated files to an output directory.
 */
public final class XomdaGenerator {

    private final File modelFile;
    private final File templatesDir;
    private final File outputDir;
    private final Logger logger;

    private XomdaGenerator(Builder b) {
        this.modelFile = Objects.requireNonNull(b.modelFile, "modelFile");
        this.templatesDir = Objects.requireNonNull(b.templatesDir, "templatesDir");
        this.outputDir = Objects.requireNonNull(b.outputDir, "outputDir");
        this.logger = b.logger != null ? b.logger : Logger.NOOP;
    }

    public static Builder builder() {
        return new Builder();
    }

    /**
     * @return the list of files written. Empty if model or templates dir is missing.
     */
    public List<File> generate() throws IOException {
        if (!modelFile.exists()) {
            logger.warn("Model file not found: " + modelFile.getAbsolutePath());
            return List.of();
        }
        if (!templatesDir.exists()) {
            logger.warn("Templates directory not found: " + templatesDir.getAbsolutePath());
            return List.of();
        }

        ObjectMapper mapper = new ObjectMapper();
        JsonNode model = mapper.readTree(modelFile);
        Object modelObj = mapper.treeToValue(model, Object.class);

        List<File> generated = new ArrayList<>();

        TemplateStorage storage = TemplateStorage.fromTemplatesDir(templatesDir.toPath());
        TemplateRenderer renderer = new TemplateRenderer();
        for (Template template : storage.listTemplates()) {
            if (template.isDisabled()) {
                logger.info("Skipping disabled template: " + template.getName());
                continue;
            }
            try {
                List<FileOutput> outputs = renderer.render(template, modelObj);
                for (FileOutput fo : outputs) {
                    File outFile = new File(outputDir, fo.getOutputPath());
                    outFile.getParentFile().mkdirs();
                    Files.writeString(outFile.toPath(), fo.getContent());
                    generated.add(outFile);
                    logger.info("Generated: " + fo.getOutputPath());
                }
            } catch (Exception e) {
                logger.error("Failed to process .template.json: " + template.getName(), e);
            }
        }

        return generated;
    }

    public static final class Builder {
        private File modelFile;
        private File templatesDir;
        private File outputDir;
        private Logger logger;

        public Builder modelFile(File f) {
            this.modelFile = f;
            return this;
        }

        public Builder templatesDir(File f) {
            this.templatesDir = f;
            return this;
        }

        public Builder outputDir(File f) {
            this.outputDir = f;
            return this;
        }

        public Builder logger(Logger l) {
            this.logger = l;
            return this;
        }

        public XomdaGenerator build() {
            return new XomdaGenerator(this);
        }
    }
}
