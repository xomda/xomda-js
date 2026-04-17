package org.xomda.eclipse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Tolerant Jackson reader for the xomda model JSON. The authoritative schema
 * lives in the TS side ({@code @xomda/core/schemas/model.ts}); this reader
 * only surfaces the fields the Eclipse view needs and ignores unknowns.
 */
public final class XomdaModelReader {

    private XomdaModelReader() {}

    public static final class XomdaModel {
        public final String name;
        public final String version;
        public final List<XomdaPackage> packages;

        public XomdaModel(String name, String version, List<XomdaPackage> packages) {
            this.name = name;
            this.version = version;
            this.packages = packages;
        }
    }

    public static final class XomdaPackage {
        public final String name;
        public final List<XomdaPackage> packages;
        public final List<XomdaNamed> entities;
        public final List<XomdaNamed> enums;

        public XomdaPackage(String name, List<XomdaPackage> packages, List<XomdaNamed> entities, List<XomdaNamed> enums) {
            this.name = name;
            this.packages = packages;
            this.entities = entities;
            this.enums = enums;
        }
    }

    public static final class XomdaNamed {
        public final String name;
        public XomdaNamed(String name) { this.name = name; }
    }

    public static XomdaModel read(File file) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(file);
        return new XomdaModel(
            root.path("name").asText("(unnamed)"),
            root.path("version").asText("0.0.0"),
            readPackages(root.path("packages"))
        );
    }

    private static List<XomdaPackage> readPackages(JsonNode node) {
        if (!node.isArray()) return Collections.emptyList();
        List<XomdaPackage> out = new ArrayList<>();
        for (JsonNode pkg : node) {
            out.add(new XomdaPackage(
                pkg.path("name").asText("(unnamed)"),
                readPackages(pkg.path("packages")),
                readNamedArray(pkg.path("entities")),
                readNamedArray(pkg.path("enums"))
            ));
        }
        return out;
    }

    private static List<XomdaNamed> readNamedArray(JsonNode node) {
        if (!node.isArray()) return Collections.emptyList();
        List<XomdaNamed> out = new ArrayList<>();
        for (JsonNode item : node) {
            out.add(new XomdaNamed(item.path("name").asText("(unnamed)")));
        }
        return out;
    }
}
