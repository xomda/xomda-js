package org.xomda.generator;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.helper.StringHelpers;

/**
 * Handlebars helpers mirroring the TS-side implementation.
 * Public for testability; consumers should call {@link #register(Handlebars)}.
 */
public final class Helpers {

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
