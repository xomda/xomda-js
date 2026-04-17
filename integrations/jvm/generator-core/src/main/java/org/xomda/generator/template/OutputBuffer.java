package org.xomda.generator.template;

public class OutputBuffer {
    private final StringBuilder sb = new StringBuilder();

    public void write(String chunk) {
        if (chunk != null)
            sb.append(chunk);
    }

    public String getContent() {
        return sb.toString();
    }

    @Override
    public String toString() {
        return getContent();
    }
}
