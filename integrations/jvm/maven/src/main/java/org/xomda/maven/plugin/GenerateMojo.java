package org.xomda.maven.plugin;

import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugins.annotations.LifecyclePhase;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;
import org.xomda.generator.Logger;
import org.xomda.generator.XomdaGenerator;

import java.io.File;
import java.io.IOException;

/**
 * Mojo for generating code from xomda templates. Delegates to {@link XomdaGenerator}.
 */
@Mojo(name = "generate", defaultPhase = LifecyclePhase.GENERATE_SOURCES)
public class GenerateMojo extends AbstractMojo {

    @Parameter(defaultValue = "${project.basedir}/.xomda/model.json", required = true)
    private File modelFile;

    @Parameter(defaultValue = "${project.basedir}/.xomda/templates", required = true)
    private File templatesDir;

    @Parameter(defaultValue = "${project.build.directory}/generated-sources/xomda", required = true)
    private File outputDir;

    public void execute() throws MojoExecutionException {
        Logger logger = (level, message, error) -> {
            switch (level) {
                case INFO -> getLog().info(message);
                case WARN -> getLog().warn(message);
                case ERROR -> {
                    if (error != null)
                        getLog().error(message, error);
                    else
                        getLog().error(message);
                }
            }
        };

        try {
            XomdaGenerator.builder()
                    .modelFile(modelFile)
                    .templatesDir(templatesDir)
                    .outputDir(outputDir)
                    .logger(logger)
                    .build()
                    .generate();
        } catch (IOException e) {
            throw new MojoExecutionException("Error during generation", e);
        }
    }
}
