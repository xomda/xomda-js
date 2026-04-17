package org.xomda.eclipse;

import java.io.File;
import java.nio.file.Path;

/**
 * The xomda project layout, mirrored from {@code @xomda/core} (TS side):
 * {@code <root>/.xomda/model.json} and {@code <root>/.xomda/templates/}.
 *
 * <p>This is intentionally a near-duplicate of the IntelliJ plugin's
 * {@code XomdaProjectInfo} (Kotlin). The two plugins each own their UI/glue
 * code in their target IDE's idiom, and we accept a small amount of pure-data
 * duplication rather than introducing a third shared module just for two
 * tiny records. Revisit if a third JVM-side consumer appears.
 */
public final class XomdaProjectInfo {

    public static final String XOMDA_DIR_NAME = ".xomda";
    public static final String MODEL_FILE_NAME = "model.json";
    public static final String TEMPLATES_DIR_NAME = "templates";

    private final File root;
    private final File xomdaDir;
    private final File modelFile;
    private final File templatesDir;

    private XomdaProjectInfo(File root, File xomdaDir, File modelFile, File templatesDir) {
        this.root = root;
        this.xomdaDir = xomdaDir;
        this.modelFile = modelFile;
        this.templatesDir = templatesDir;
    }

    public File getRoot() { return root; }
    public File getXomdaDir() { return xomdaDir; }
    public File getModelFile() { return modelFile; }
    public File getTemplatesDir() { return templatesDir; }

    public boolean isValid() {
        return modelFile.isFile();
    }

    public static XomdaProjectInfo discover(File root) {
        File xomdaDir = new File(root, XOMDA_DIR_NAME);
        File modelFile = new File(xomdaDir, MODEL_FILE_NAME);
        if (!modelFile.isFile()) return null;
        File templatesDir = new File(xomdaDir, TEMPLATES_DIR_NAME);
        return new XomdaProjectInfo(root, xomdaDir, modelFile, templatesDir);
    }

    public static XomdaProjectInfo discover(Path root) {
        return discover(root.toFile());
    }
}
