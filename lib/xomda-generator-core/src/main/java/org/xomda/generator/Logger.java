package org.xomda.generator;

/**
 * Minimal logger SAM so the engine can be driven from Maven, Gradle, bld, or
 * a plain JVM caller without any of those plugin APIs leaking into core.
 */
@FunctionalInterface
public interface Logger {

  enum Level { INFO, WARN, ERROR }

  void log(Level level, String message, Throwable error);

  default void info(String message) { log(Level.INFO, message, null); }
  default void warn(String message) { log(Level.WARN, message, null); }
  default void error(String message, Throwable error) { log(Level.ERROR, message, error); }

  Logger NOOP = (l, m, t) -> { };
}
