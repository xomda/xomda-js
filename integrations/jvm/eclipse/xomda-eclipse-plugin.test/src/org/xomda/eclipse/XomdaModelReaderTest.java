package org.xomda.eclipse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;

class XomdaModelReaderTest {

    @Test
    void readsNameVersionAndPackages(@TempDir Path tmp) throws IOException {
        Path model = tmp.resolve("model.json");
        Files.writeString(model,
            "{\n" +
            "  \"name\": \"Demo\",\n" +
            "  \"version\": \"1.2.3\",\n" +
            "  \"packages\": [\n" +
            "    {\n" +
            "      \"name\": \"shop\",\n" +
            "      \"packages\": [\n" +
            "        { \"name\": \"billing\", \"entities\": [{\"name\": \"Invoice\"}] }\n" +
            "      ],\n" +
            "      \"entities\": [{\"name\": \"Product\"}],\n" +
            "      \"enums\": [{\"name\": \"Currency\"}]\n" +
            "    }\n" +
            "  ]\n" +
            "}\n"
        );

        XomdaModelReader.XomdaModel parsed = XomdaModelReader.read(model.toFile());
        assertEquals("Demo", parsed.name);
        assertEquals("1.2.3", parsed.version);
        assertEquals(1, parsed.packages.size());
        XomdaModelReader.XomdaPackage shop = parsed.packages.get(0);
        assertEquals("shop", shop.name);
        assertEquals(List.of("Product"), shop.entities.stream().map(e -> e.name).collect(Collectors.toList()));
        assertEquals(List.of("Currency"), shop.enums.stream().map(e -> e.name).collect(Collectors.toList()));
        assertEquals(1, shop.packages.size());
        assertEquals(List.of("Invoice"), shop.packages.get(0).entities.stream().map(e -> e.name).collect(Collectors.toList()));
    }

    @Test
    void toleratesMissingFields(@TempDir Path tmp) throws IOException {
        Path model = tmp.resolve("model.json");
        Files.writeString(model, "{}");
        XomdaModelReader.XomdaModel parsed = XomdaModelReader.read(model.toFile());
        assertEquals("(unnamed)", parsed.name);
        assertEquals(List.of(), parsed.packages);
    }
}
