package org.xomda.gradle

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.api.tasks.SourceSet

class XomdaPlugin implements Plugin<Project> {

  static final String EXTENSION_NAME = 'xomda'
  static final String TASK_NAME = 'xomdaGenerate'

  @Override
  void apply(Project project) {
    XomdaExtension ext = project.extensions.create(EXTENSION_NAME, XomdaExtension)

    ext.modelFile.convention(project.layout.projectDirectory.file('.xomda/model.json'))
    ext.templatesDir.convention(project.layout.projectDirectory.dir('.xomda/templates'))
    ext.outputDir.convention(project.layout.buildDirectory.dir('generated-sources/xomda'))

    def task = project.tasks.register(TASK_NAME, XomdaGenerateTask) {
      it.modelFile.set(ext.modelFile)
      it.templatesDir.set(ext.templatesDir)
      it.outputDir.set(ext.outputDir)
    }

    // When the java plugin is applied, generated sources should be on the
    // main source set and produced before compilation — equivalent to Maven's
    // GENERATE_SOURCES phase.
    project.plugins.withId('java') {
      JavaPluginExtension java = project.extensions.getByType(JavaPluginExtension)
      SourceSet main = java.sourceSets.findByName('main')
      if (main != null) {
        main.java.srcDir(task)
      }
    }
  }
}
