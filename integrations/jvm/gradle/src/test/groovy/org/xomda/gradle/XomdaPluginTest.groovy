package org.xomda.gradle

import org.gradle.testfixtures.ProjectBuilder
import spock.lang.Specification

class XomdaPluginTest extends Specification {

  def "registers the xomda extension and the xomdaGenerate task"() {
    given:
    def project = ProjectBuilder.builder().build()

    when:
    project.plugins.apply('org.xomda.generate')

    then:
    project.extensions.findByName('xomda') instanceof XomdaExtension
    project.tasks.findByName('xomdaGenerate') instanceof XomdaGenerateTask
  }

  def "applies sane default paths"() {
    given:
    def project = ProjectBuilder.builder().build()
    project.plugins.apply('org.xomda.generate')

    expect:
    def ext = project.extensions.getByType(XomdaExtension)
    ext.modelFile.get().asFile.path.endsWith('.xomda/model.json')
    ext.templatesDir.get().asFile.path.endsWith('.xomda/templates')
    ext.outputDir.get().asFile.path.endsWith('generated-sources/xomda')
  }

  def "wires generated sources into main source set when java plugin is applied"() {
    given:
    def project = ProjectBuilder.builder().build()

    when:
    project.plugins.apply('org.xomda.generate')
    project.plugins.apply('java')

    then:
    def main = project.extensions.getByType(org.gradle.api.plugins.JavaPluginExtension)
      .sourceSets.getByName('main')
    main.java.srcDirs.any { it.path.contains('generated-sources/xomda') }
  }
}
