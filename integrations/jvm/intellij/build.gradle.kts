plugins {
    kotlin("jvm") version "2.1.20"
    id("org.jetbrains.intellij.platform") version "2.2.1"
}

group = "org.xomda"
version = "0.0.1-SNAPSHOT"

// Pin build output to ./build/ so the IDE never picks an adjacent
// folder (e.g. `lib/`) as a default sink.
layout.buildDirectory = layout.projectDirectory.dir("build")

kotlin {
    // IntelliJ Platform 2024.2 requires Java 21.
    jvmToolchain(21)
}

repositories {
    mavenCentral()
    // Project-local Maven file repo populated by:
    //   mvn -f integrations/jvm/generator-core install \
    //       -DaltDeploymentRepository=local::default::file://$PWD/integrations/jvm/.m2-repo
    // (Wired into the root `pnpm test:jvm` script.)
    maven {
        name = "xomda-local"
        url = uri("../.m2-repo")
    }
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    implementation("org.xomda:xomda-generator-core:0.0.1-SNAPSHOT")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.18.2")

    intellijPlatform {
        intellijIdeaCommunity("2024.2.4")
        bundledPlugin("com.intellij.java")
        instrumentationTools()
    }

    // Pure JUnit 5 — no IntelliJ test fixtures. The Platform's
    // TestFrameworkType ships a JUnit5 session listener that depends
    // on the legacy `junit.framework.TestCase`; pulling it in here
    // would require an extra JUnit 4 dep just for our unit tests of
    // pure-logic classes (XomdaProjectInfo, XomdaModelReader). Add
    // it back only when the plugin grows tests that actually exercise
    // the IntelliJ Platform fixtures.
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:6.1.0")
}

intellijPlatform {
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "242"
            untilBuild = "243.*"
        }
    }
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}
