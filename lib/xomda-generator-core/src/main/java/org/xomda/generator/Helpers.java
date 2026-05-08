package org.xomda.generator;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.helper.StringHelpers;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Handlebars helpers, mirroring the TS-side implementation in
 * {@code packages/template/src/helpers.ts}.
 *
 * Helpers are deliberately generic (string casing, comparisons, simple
 * model traversal). Target-language type mapping (TypeScript, Zod, Java, …)
 * lives in template logic cells, not here.
 *
 * Public for testability; consumers should call {@link #register(Handlebars)}.
 */
public final class Helpers {

  /** Type names treated as primitives — mirrors the TS side. */
  private static final List<String> PRIMITIVES = List.of(
      "string", "number", "boolean", "Date", "UUID", "decimal", "date", "uuid"
  );

  private Helpers() {}

  public static void register(Handlebars handlebars) {
    StringHelpers.register(handlebars);

    handlebars.registerHelper("pascalCase", (context, options) -> {
      String str = context instanceof String ? (String) context : "";
      return toPascalCase(str);
    });

    handlebars.registerHelper("constantCase", (context, options) -> {
      String str = context instanceof String ? (String) context : "";
      return toConstantCase(str);
    });

    handlebars.registerHelper("eq", (a, options) -> {
      Object b = options.param(0);
      return a == null ? b == null : a.equals(b);
    });

    handlebars.registerHelper("ne", (a, options) -> {
      Object b = options.param(0);
      return a == null ? b != null : !a.equals(b);
    });

    handlebars.registerHelper("and", (a, options) -> {
      Object b = options.param(0);
      return isTruthy(a) && isTruthy(b);
    });

    handlebars.registerHelper("or", (a, options) -> {
      Object b = options.param(0);
      return isTruthy(a) || isTruthy(b);
    });

    handlebars.registerHelper("not", (a, options) -> !isTruthy(a));

    // Array helpers
    handlebars.registerHelper("join", (arr, options) -> {
      Object sepArg = options.params.length > 0 ? options.param(0) : null;
      String separator = sepArg == null ? ", " : sepArg.toString();
      if (!(arr instanceof Iterable<?>)) return "";
      StringBuilder sb = new StringBuilder();
      boolean first = true;
      for (Object item : (Iterable<?>) arr) {
        if (!first) sb.append(separator);
        sb.append(item == null ? "" : item.toString());
        first = false;
      }
      return sb.toString();
    });

    handlebars.registerHelper("first", (arr, options) -> {
      if (!(arr instanceof Iterable<?>)) return null;
      Iterator<?> it = ((Iterable<?>) arr).iterator();
      return it.hasNext() ? it.next() : null;
    });

    handlebars.registerHelper("last", (arr, options) -> {
      if (!(arr instanceof Iterable<?>)) return null;
      Object lastVal = null;
      for (Object item : (Iterable<?>) arr) lastVal = item;
      return lastVal;
    });

    // Attribute filters
    handlebars.registerHelper("required", (attrs, options) -> filterAttrs(attrs, "required"));
    handlebars.registerHelper("primaryKeys", (attrs, options) -> filterAttrs(attrs, "primaryKey"));

    // Model traversal — language-neutral
    handlebars.registerHelper("isPrimitive", (type, options) ->
        type instanceof String && PRIMITIVES.contains((String) type));

    handlebars.registerHelper("nonPrimitiveTypes", (attrs, options) -> {
      String entityName = null;
      Object root = options.data("root");
      if (root instanceof Map<?, ?> rootMap) {
        Object n = rootMap.get("name");
        if (n instanceof String s) entityName = s;
      }
      Set<String> seen = new LinkedHashSet<>();
      if (attrs instanceof Iterable<?>) {
        for (Object a : (Iterable<?>) attrs) {
          if (!(a instanceof Map<?, ?> attr)) continue;
          // Reference-typed attrs are stored as ids — they don't pull in a schema/type import.
          if (isTruthy(attr.get("reference"))) continue;
          Object t = attr.get("type");
          if (!(t instanceof String typeName)) continue;
          if (PRIMITIVES.contains(typeName)) continue;
          if (typeName.equals(entityName)) continue;
          seen.add(typeName);
        }
      }
      return new ArrayList<>(seen);
    });

    handlebars.registerHelper("isSelfRef", (entityName, options) -> {
      Object attrs = options.param(0);
      if (!(entityName instanceof String name) || !(attrs instanceof Iterable<?>)) return false;
      for (Object a : (Iterable<?>) attrs) {
        if (a instanceof Map<?, ?> attr
            && name.equals(attr.get("type"))
            && !isTruthy(attr.get("reference"))) {
          return true;
        }
      }
      return false;
    });
  }

  private static List<Object> filterAttrs(Object attrs, String flag) {
    List<Object> result = new ArrayList<>();
    if (attrs instanceof Iterable<?>) {
      for (Object a : (Iterable<?>) attrs) {
        if (a instanceof Map<?, ?> attr && isTruthy(attr.get(flag))) result.add(a);
      }
    }
    return result;
  }

  public static boolean isTruthy(Object obj) {
    if (obj == null) return false;
    if (obj instanceof Boolean) return (Boolean) obj;
    if (obj instanceof String) return !((String) obj).isEmpty();
    if (obj instanceof Iterable) return ((Iterable<?>) obj).iterator().hasNext();
    return true;
  }

  public static String toPascalCase(String str) {
    if (str == null || str.isEmpty()) return "";
    StringBuilder sb = new StringBuilder();
    boolean nextUpper = true;
    for (char c : str.toCharArray()) {
      if (Character.isLetterOrDigit(c)) {
        sb.append(nextUpper ? Character.toUpperCase(c) : Character.toLowerCase(c));
        nextUpper = false;
      } else {
        nextUpper = true;
      }
    }
    return sb.toString();
  }

  public static String toConstantCase(String str) {
    if (str == null || str.isEmpty()) return "";
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < str.length(); i++) {
      char c = str.charAt(i);
      if (i > 0 && Character.isUpperCase(c) && Character.isLowerCase(str.charAt(i - 1))) {
        sb.append('_');
      }
      if (Character.isLetterOrDigit(c)) {
        sb.append(Character.toUpperCase(c));
      } else {
        sb.append('_');
      }
    }
    return sb.toString().replaceAll("_+", "_");
  }
}
