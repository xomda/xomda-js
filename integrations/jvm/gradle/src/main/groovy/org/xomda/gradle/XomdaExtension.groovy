package org.xomda.gradle

import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.model.ObjectFactory

import javax.inject.Inject

/**
 * DSL extension for the xomda plugin.
 *
 * <pre>
 * xomda {
 *   modelFile    = file('.xomda/model.json')
 *   templatesDir = file('.xomda/templates')
 *   outputDir    = layout.buildDirectory.dir('generated-sources/xomda').get().asFile
 * }
 * </pre>
 */
class XomdaExtension {

  final RegularFileProperty modelFile
  final DirectoryProperty templatesDir
  final DirectoryProperty outputDir

  @Inject
  XomdaExtension(ObjectFactory objects) {
    this.modelFile = objects.fileProperty()
    this.templatesDir = objects.directoryProperty()
    this.outputDir = objects.directoryProperty()
  }
}
