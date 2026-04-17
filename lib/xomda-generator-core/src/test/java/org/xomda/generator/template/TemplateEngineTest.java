package org.xomda.generator.template;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

class TemplateEngineTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Locates shared fixtures relative to the project root. */
    private static Path fixturesDir() {
        // lib/xomda-generator-core → ../../packages/template/src/__fixtures__
        try {
            Path classesDir = Paths.get(
                    TemplateEngineTest.class.getProtectionDomain().getCodeSource().getLocation().toURI()
            );
            // classesDir = .../lib/xomda-generator-core/target/test-classes
            // moduleRoot = .../lib/xomda-generator-core
            // libDir     = .../lib
            // worktreeRoot = ...
            Path worktreeRoot = classesDir.getParent().getParent().getParent().getParent();
            return worktreeRoot.resolve("packages/template/src/__fixtures__");
        } catch (URISyntaxException e) {
            throw new RuntimeException(e);
        }
    }

    static Stream<Object[]> fixtures() throws IOException {
        Path dir = fixturesDir();
        if (!Files.isDirectory(dir)) return Stream.empty();
        return Files.list(dir)
                .filter(p -> p.toString().endsWith(".json"))
                .map(p -> {
                    try {
                        JsonNode node = MAPPER.readTree(p.toFile());
                        return new Object[]{ node.get("description").asText(), node };
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                });
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("fixtures")
    @DisplayName("shared fixture")
    void runFixture(String description, JsonNode fixture) throws IOException {
        Template template = buildTemplate(fixture);
        Object model = MAPPER.treeToValue(fixture.get("model"), Object.class);

        TemplateEngine engine = new TemplateEngine();
        List<FileOutput> files = engine.executeTemplate(template, model);

        JsonNode expectedFiles = fixture.get("expectedFiles");
        if (expectedFiles != null && expectedFiles.isArray()) {
            assertEquals(expectedFiles.size(), files.size(),
                    "file count mismatch for: " + description);
            for (int i = 0; i < expectedFiles.size(); i++) {
                JsonNode exp = expectedFiles.get(i);
                assertEquals(exp.get("outputPath").asText(), files.get(i).getOutputPath(),
                        "outputPath mismatch at index " + i);
                assertEquals(exp.get("content").asText(), files.get(i).getContent(),
                        "content mismatch at index " + i);
            }
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static Template buildTemplate(JsonNode fixture) throws IOException {
        Template template = new Template();
        template.setUuid("test-uuid");
        template.setName("Test");
        template.setVersion("1.0.0");

        List<TemplateCell> cells = new ArrayList<>();
        JsonNode cellNodes = fixture.get("cells");
        if (cellNodes != null && cellNodes.isArray()) {
            for (JsonNode cellNode : cellNodes) {
                cells.add(MAPPER.treeToValue(cellNode, TemplateCell.class));
            }
        }
        template.setCells(cells);
        return template;
    }
}
