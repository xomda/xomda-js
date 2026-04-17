package org.xomda.generator.template;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Dispatch mode for an {@code output} cell. Mirrors the TypeScript {@code OutputType} enum in {@code @xomda/core}.
 * Default (when absent) is {@link #FILE}.
 *
 * <ul>
 * <li>{@link #FILE} — rendered content is written to a file named by {@code outputFilename} (optionally prefixed by
 * {@code outputDirectory}). Consumes the surrounding cell buffers so a wrapping loop aggregate does not re-emit the
 * same content.
 * <li>{@link #CONTEXT} — content is stashed into the variable named by {@code outputContent} for downstream cells. Does
 * NOT clear the surrounding cell buffers.
 * </ul>
 */
public enum OutputType {
    FILE("file"), CONTEXT("context");

    private final String value;

    OutputType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static OutputType fromValue(String raw) {
        if (raw == null)
            return null;
        String s = raw.trim();
        for (OutputType t : values()) {
            if (t.value.equals(s))
                return t;
        }
        throw new IllegalArgumentException("Unknown output type: " + raw);
    }
}
