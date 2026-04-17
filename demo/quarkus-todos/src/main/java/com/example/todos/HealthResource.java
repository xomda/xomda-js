package com.example.todos;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/**
 * Hand-written sample resource. Lives next to the xomda-generated resources
 * under {@code src/main/generated/com/example/todos/resource/} and proves
 * the demo is a real Quarkus project that builds, scans, and runs JAX-RS
 * code from both halves.
 */
@Path("/api/health")
public class HealthResource {

    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public String ping() {
        return "ok";
    }
}
