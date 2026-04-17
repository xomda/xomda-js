package org.xomda.generator;

/** Render scope for a template, parsed from its YAML frontmatter `scope` key. */
public enum Scope {
  MODEL,
  ENTITY,
  PACKAGE;

  static Scope parse(String raw) {
    if (raw == null) return MODEL;
    String upper = raw.trim().toUpperCase();
    for (Scope s : values()) {
      if (s.name().equals(upper)) return s;
    }
    return MODEL;
  }
}
