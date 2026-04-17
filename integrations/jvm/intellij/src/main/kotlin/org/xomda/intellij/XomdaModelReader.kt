package org.xomda.intellij

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.io.File

/**
 * Lightweight read-only view of a xomda model — only the fields the
 * tool window cares about. The authoritative schema lives in the TS
 * side (`@xomda/core/schemas/model.ts`); this is a tolerant reader
 * that ignores unknown fields.
 */
data class XomdaModel(
    val name: String,
    val version: String,
    val packages: List<XomdaPackage>,
)

data class XomdaPackage(
    val name: String,
    val packages: List<XomdaPackage>,
    val entities: List<XomdaNamed>,
    val enums: List<XomdaNamed>,
)

data class XomdaNamed(val name: String)

object XomdaModelReader {
    private val mapper = ObjectMapper()

    fun read(file: File): XomdaModel {
        val root = mapper.readTree(file)
        return XomdaModel(
            name = root.path("name").asText("(unnamed)"),
            version = root.path("version").asText("0.0.0"),
            packages = readPackages(root.path("packages")),
        )
    }

    private fun readPackages(node: JsonNode): List<XomdaPackage> {
        if (!node.isArray) return emptyList()
        return node.map { pkg ->
            XomdaPackage(
                name = pkg.path("name").asText("(unnamed)"),
                packages = readPackages(pkg.path("packages")),
                entities = readNamedArray(pkg.path("entities")),
                enums = readNamedArray(pkg.path("enums")),
            )
        }
    }

    private fun readNamedArray(node: JsonNode): List<XomdaNamed> {
        if (!node.isArray) return emptyList()
        return node.map { XomdaNamed(it.path("name").asText("(unnamed)")) }
    }
}
