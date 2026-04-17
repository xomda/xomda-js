package org.xomda.generator.template.processor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class CellState {
    private String output = "";
    private final Map<String, Object> contextDiff = new LinkedHashMap<>();
    private final List<String> consoleLogs = new ArrayList<>();
    private String error;
    private boolean done = false;

    public String getOutput() { return output; }
    public void setOutput(String output) { this.output = output; }

    public Map<String, Object> getContextDiff() { return contextDiff; }

    public List<String> getConsoleLogs() { return consoleLogs; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public boolean isDone() { return done; }
    public void setDone(boolean done) { this.done = done; }
}
