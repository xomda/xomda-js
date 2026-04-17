package org.xomda.intellij

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

class XomdaModelReaderTest {

    @Test
    fun `reads name, version and packages`(@TempDir tmp: Path) {
        val model = tmp.resolve("model.json")
        Files.writeString(
            model,
            """
            {
              "name": "Demo",
              "version": "1.2.3",
              "packages": [
                {
                  "name": "shop",
                  "packages": [
                    { "name": "billing", "entities": [{"name": "Invoice"}] }
                  ],
                  "entities": [{"name": "Product"}],
                  "enums": [{"name": "Currency"}]
                }
              ]
            }
            """.trimIndent()
        )

        val parsed = XomdaModelReader.read(model.toFile())
        assertEquals("Demo", parsed.name)
        assertEquals("1.2.3", parsed.version)
        assertEquals(1, parsed.packages.size)
        val shop = parsed.packages.first()
        assertEquals("shop", shop.name)
        assertEquals(listOf("Product"), shop.entities.map { it.name })
        assertEquals(listOf("Currency"), shop.enums.map { it.name })
        assertEquals(1, shop.packages.size)
        assertEquals(listOf("Invoice"), shop.packages.first().entities.map { it.name })
    }

    @Test
    fun `tolerates missing fields`(@TempDir tmp: Path) {
        val model = tmp.resolve("model.json")
        Files.writeString(model, "{}")
        val parsed = XomdaModelReader.read(model.toFile())
        assertEquals("(unnamed)", parsed.name)
        assertEquals(emptyList<Any>(), parsed.packages)
    }
}
