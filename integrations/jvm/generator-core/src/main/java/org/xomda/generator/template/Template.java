package org.xomda.generator.template;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Template {
    private String uuid;
    private String name;
    private String description;
    private String version = "1.0.0";
    private String scope;
    private List<TemplateCell> cells = new ArrayList<>();

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }

    public List<TemplateCell> getCells() { return cells; }
    public void setCells(List<TemplateCell> cells) { this.cells = cells != null ? cells : new ArrayList<>(); }
}
