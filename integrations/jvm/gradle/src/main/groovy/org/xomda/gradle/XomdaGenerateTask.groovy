package org.xomda.gradle

import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.*
import org.gradle.api.tasks.PathSensitive
import org.gradle.work.DisableCachingByDefault
import org.xomda.generator.Logger
import org.xomda.generator.XomdaGenerator

import static org.gradle.api.tasks.PathSensitivity.RELATIVE

@DisableCachingByDefault(because = 'Output is small and depends on full template tree; caching brings little benefit')
abstract class XomdaGenerateTask extends DefaultTask {

  @InputFile
  @PathSensitive(RELATIVE)
  abstract RegularFileProperty getModelFile()

  @InputDirectory
  @PathSensitive(RELATIVE)
  abstract DirectoryProperty getTemplatesDir()

  @OutputDirectory
  abstract DirectoryProperty getOutputDir()

  XomdaGenerateTask() {
    group = 'xomda'
    description = 'Generate sources from xomda templates.'
  }

  @TaskAction
  void generate() {
    Logger logger = { Logger.Level level, String message, Throwable error ->
      switch (level) {
        case Logger.Level.INFO: getLogger().info(message); break
        case Logger.Level.WARN: getLogger().warn(message); break
        case Logger.Level.ERROR: getLogger().error(message, error); break
      }
    }

    XomdaGenerator.builder()
      .modelFile(modelFile.get().asFile)
      .templatesDir(templatesDir.get().asFile)
      .outputDir(outputDir.get().asFile)
      .logger(logger)
      .build()
      .generate()
  }
}
