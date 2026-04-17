package org.xomda.generator.templatepp;

import com.fasterxml.jackson.annotation.JsonValue;

public enum CellType {
    LOGIC("logic"),
    MARKDOWN("markdown"),
    HANDLEBARS("handlebars"),
    BUFFER("buffer"),
    OUTPUT("output");

    private final String value;

    CellType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
