package com.example.blog;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Hand-written Spring Boot 4 entry point for the demo.
 *
 * <p>Component-scanning sweeps {@code com.example.blog}, picking up the
 * xomda-generated {@code @Repository} interfaces under
 * {@code com.example.blog.repository} and {@code @Service} classes under
 * {@code com.example.blog.service} that live in {@code src/main/generated/}.
 * Flyway applies the generated {@code V1__init.sql} migration from
 * {@code src/main/generated-resources/db/migration/} at startup.
 */
@SpringBootApplication
public class BlogServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(BlogServiceApplication.class, args);
    }
}
