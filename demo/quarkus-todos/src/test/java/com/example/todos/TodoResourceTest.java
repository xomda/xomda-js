package com.example.todos;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * End-to-end exercise of the xomda-generated Quarkus resources.
 *
 * <p>Spins the full Quarkus container against H2, fires HTTP calls at
 * {@code /api/todo-list} and {@code /api/todo} (the auto-generated CRUD
 * resources under {@code src/main/generated/com/example/todos/resource/}),
 * and asserts the Panache entities round-trip through real JSON.
 *
 * <p>Failure here means either:
 * <ul>
 *   <li>a template drift (entity / resource shape changed), or</li>
 *   <li>the generated Panache + JAX-RS code no longer plays with the
 *       hand-written app skeleton (pom, application.properties).</li>
 * </ul>
 */
@QuarkusTest
class TodoResourceTest {

    @Test
    void handWrittenHealthResourceServesPlainText() {
        given().when().get("/api/health").then().statusCode(200).body(is("ok"));
    }

    @Test
    void todoListCrudRoundTrips() {
        Map<String, Object> body =
                Map.of("name", "Shopping", "createdAt", LocalDateTime.now().toString());

        String listId =
                given().contentType("application/json")
                        .body(body)
                        .when()
                        .post("/api/todo-list")
                        .then()
                        .statusCode(201)
                        .body("id", notNullValue())
                        .body("name", equalTo("Shopping"))
                        .extract()
                        .path("id");

        given().when().get("/api/todo-list/" + listId).then().statusCode(200).body("name", equalTo("Shopping"));
        given().when().delete("/api/todo-list/" + listId).then().statusCode(204);
        given().when().get("/api/todo-list/" + listId).then().statusCode(404);
    }

    @Test
    void todoBelongsToATodoListAndCarriesAnEnumPriority() {
        // 1. Parent TodoList.
        String listId =
                given().contentType("application/json")
                        .body(Map.of(
                                "name", "Errands",
                                "createdAt", LocalDateTime.now().toString()))
                        .when()
                        .post("/api/todo-list")
                        .then()
                        .statusCode(201)
                        .extract()
                        .path("id");

        // 2. Child Todo linked via { list: { id } }. JAX-RS deserialisation
        //    walks the @ManyToOne and rehydrates the Panache reference.
        String todoId =
                given().contentType("application/json")
                        .body(Map.of(
                                "title", "Buy milk",
                                "done", false,
                                "priority", "HIGH",
                                "list", Map.of("id", listId),
                                "createdAt", LocalDateTime.now().toString()))
                        .when()
                        .post("/api/todo")
                        .then()
                        .statusCode(201)
                        .body("priority", equalTo("HIGH"))
                        .body("done", equalTo(false))
                        .extract()
                        .path("id");

        // 3. The list endpoint returns at least our newly-created todo.
        given().when().get("/api/todo").then().statusCode(200).body("$", hasSize(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

        // 4. Direct GET — confirms persistence + Jackson serialisation.
        given().when().get("/api/todo/" + todoId).then().statusCode(200).body("title", equalTo("Buy milk"));

        // 5. Clean up.
        given().when().delete("/api/todo/" + todoId).then().statusCode(204);
        given().when().delete("/api/todo-list/" + listId).then().statusCode(204);
    }

    @Test
    void unknownTodoReturns404() {
        given().when().get("/api/todo/" + UUID.randomUUID()).then().statusCode(404);
    }
}
