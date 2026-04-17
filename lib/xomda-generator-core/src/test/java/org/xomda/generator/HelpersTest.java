package org.xomda.generator;

import org.junit.jupiter.api.Test;

import java.util.List;

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
}
