package org.xomda.generator;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HelpersTest {

  @Test
  void toPascalCase_capitalizesAndStripsNonAlnum() {
    assertEquals("HelloWorld", Helpers.toPascalCase("hello world"));
    assertEquals("FooBarBaz", Helpers.toPascalCase("foo_bar-baz"));
    assertEquals("", Helpers.toPascalCase(""));
    assertEquals("", Helpers.toPascalCase(null));
  }

  @Test
  void toConstantCase_inserts_underscores_at_camelBoundaries_and_uppercases() {
    assertEquals("HELLO_WORLD", Helpers.toConstantCase("helloWorld"));
    assertEquals("FOO_BAR", Helpers.toConstantCase("foo bar"));
    assertEquals("", Helpers.toConstantCase(null));
  }

  @Test
  void isTruthy_handles_null_boolean_string_iterable() {
    assertFalse(Helpers.isTruthy(null));
    assertTrue(Helpers.isTruthy(Boolean.TRUE));
    assertFalse(Helpers.isTruthy(Boolean.FALSE));
    assertFalse(Helpers.isTruthy(""));
    assertTrue(Helpers.isTruthy("x"));
    assertFalse(Helpers.isTruthy(List.of()));
    assertTrue(Helpers.isTruthy(List.of("x")));
    assertTrue(Helpers.isTruthy(42));
  }

  @Test
  void join_concatenates_with_default_or_custom_separator() throws IOException {
    Handlebars hb = new Handlebars();
    Helpers.register(hb);
    assertEquals("a, b, c", hb.compileInline("{{join items}}").apply(Map.of("items", List.of("a", "b", "c"))));
    assertEquals("a-b-c", hb.compileInline("{{join items \"-\"}}").apply(Map.of("items", List.of("a", "b", "c"))));
    assertEquals("", hb.compileInline("{{join items}}").apply(Map.of("items", List.of())));
  }

  @Test
  void first_and_last_return_endpoints_or_null() throws IOException {
    Handlebars hb = new Handlebars();
    Helpers.register(hb);
    assertEquals("a", hb.compileInline("{{first items}}").apply(Map.of("items", List.of("a", "b", "c"))));
    assertEquals("c", hb.compileInline("{{last items}}").apply(Map.of("items", List.of("a", "b", "c"))));
    assertEquals("", hb.compileInline("{{first items}}").apply(Map.of("items", List.of())));
  }

  @Test
  void isPrimitive_recognizes_canonical_type_names() throws IOException {
    Handlebars hb = new Handlebars();
    Helpers.register(hb);
    assertEquals("true", hb.compileInline("{{isPrimitive t}}").apply(Map.of("t", "string")));
    assertEquals("true", hb.compileInline("{{isPrimitive t}}").apply(Map.of("t", "uuid")));
    assertEquals("true", hb.compileInline("{{isPrimitive t}}").apply(Map.of("t", "Date")));
    assertEquals("false", hb.compileInline("{{isPrimitive t}}").apply(Map.of("t", "Address")));
  }

  @Test
  void required_filters_attrs_marked_required() throws IOException {
    Handlebars hb = new Handlebars();
    Helpers.register(hb);
    Map<String, Object> root = Map.of("attrs", List.of(
        attr("name", "id", "required", true),
        attr("name", "title", "required", false),
        attr("name", "createdAt", "required", true)
    ));
    String out = hb.compileInline("{{#each (required attrs)}}{{name}};{{/each}}").apply(root);
    assertEquals("id;createdAt;", out);
  }

  @Test
  void primaryKeys_filters_attrs_marked_primaryKey() throws IOException {
    Handlebars hb = new Handlebars();
    Helpers.register(hb);
    Map<String, Object> root = Map.of("attrs", List.of(
        attr("name", "id", "primaryKey", true),
        attr("name", "title", "primaryKey", false)
    ));
    String out = hb.compileInline("{{#each (primaryKeys attrs)}}{{name}};{{/each}}").apply(root);
    assertEquals("id;", out);
  }

  @Test
  void nonPrimitiveTypes_dedupes_and_excludes_self_and_references() throws IOException {
    Handlebars hb = new Handlebars();
    Helpers.register(hb);
    Map<String, Object> root = new LinkedHashMap<>();
    root.put("name", "Order");
    root.put("attrs", List.of(
        attr("name", "id", "type", "uuid"),
        attr("name", "customer", "type", "Customer"),
        attr("name", "altCustomer", "type", "Customer"),
        attr("name", "self", "type", "Order"),
        attr("name", "tags", "type", "Tag", "reference", true),
        attr("name", "addr", "type", "Address")
    ));
    String out = hb.compileInline("{{#each (nonPrimitiveTypes attrs)}}{{this}};{{/each}}").apply(root);
    assertEquals("Customer;Address;", out);
  }

  @Test
  void isSelfRef_only_for_embedded_self_loops() throws IOException {
    Handlebars hb = new Handlebars();
    Helpers.register(hb);
    Map<String, Object> embeds = Map.of(
        "name", "Node",
        "attrs", List.of(attr("name", "child", "type", "Node"))
    );
    assertEquals("true", hb.compileInline("{{isSelfRef name attrs}}").apply(embeds));

    Map<String, Object> referenceOnly = Map.of(
        "name", "Node",
        "attrs", List.of(attr("name", "child", "type", "Node", "reference", true))
    );
    assertEquals("false", hb.compileInline("{{isSelfRef name attrs}}").apply(referenceOnly));
  }

  @Test
  void eq_ne_and_or_not_handle_basic_truthiness() throws IOException {
    Handlebars hb = new Handlebars();
    Helpers.register(hb);
    assertEquals("true", hb.compileInline("{{eq a b}}").apply(Map.of("a", "x", "b", "x")));
    assertEquals("false", hb.compileInline("{{eq a b}}").apply(Map.of("a", "x", "b", "y")));
    assertEquals("true", hb.compileInline("{{ne a b}}").apply(Map.of("a", "x", "b", "y")));
    assertEquals("true", hb.compileInline("{{and a b}}").apply(Map.of("a", true, "b", "x")));
    assertEquals("false", hb.compileInline("{{and a b}}").apply(Map.of("a", true, "b", "")));
    assertEquals("true", hb.compileInline("{{or a b}}").apply(Map.of("a", false, "b", "x")));
    assertEquals("true", hb.compileInline("{{not a}}").apply(Map.of("a", false)));
  }

  private static Map<String, Object> attr(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
    return m;
  }
}
