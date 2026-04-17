package org.xomda.generator.template;

import com.fasterxml.jackson.annotation.JsonValue;

public enum CellType {
    LOGIC("logic"),
    MARKDOWN("markdown"),
    HANDLEBARS("handlebars"),
    BUFFER("buffer"),
    OUTPUT("output"),
    PROVIDER("provider");

    private final String value;

    CellType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
