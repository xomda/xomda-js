package org.xomda.generator.template;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum CellType {
    LOGIC("logic"),
    MARKDOWN("markdown"),
    HANDLEBARS("handlebars"),
    BUFFER("buffer"),
    OUTPUT("output"),
    LOOP("loop"),
    LOOP_LOGIC("loop-logic");

    private final String value;

    CellType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Tolerant deserialiser: accepts both the current names and the legacy
     * "provider" / "provider-logic" spellings so old templates still load.
     */
    @JsonCreator
    public static CellType fromValue(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.equals("provider")) return LOOP;
        if (s.equals("provider-logic")) return LOOP_LOGIC;
        for (CellType t : values()) {
            if (t.value.equals(s)) return t;
        }
        throw new IllegalArgumentException("Unknown cell type: " + raw);
    }
}
