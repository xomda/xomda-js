package com.example.blog.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.enums.PostStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

/**
 * End-to-end verification of the BlogController against the xomda-generated
 * persistence layer. Drives the controller via MockMvc, JSON-in / JSON-out:
 *
 * <ol>
 *   <li>POST /api/authors → 201 + DTO round-trip</li>
 *   <li>POST /api/posts referencing that author → 201 with the FK resolved</li>
 *   <li>GET /api/posts → 200 with the new post</li>
 *   <li>POST /api/posts/{id}/comments → 201; GET back the comment</li>
 * </ol>
 *
 * <p>Failure here proves either:
 * <ul>
 *   <li>a generated DTO/entity/repo/service drifted from the model, or</li>
 *   <li>the controller wiring (the only hand-written half) broke.</li>
 * </ul>
 */
@SpringBootTest
@TestPropertySource(properties = {"spring.main.web-application-type=servlet"})
@Transactional
class BlogControllerIT {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ObjectMapper objectMapper;

    private MockMvc mvc() {
        return MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void crudRoundTrip() throws Exception {
        MockMvc mockMvc = mvc();

        UUID authorId = UUID.randomUUID();
        Map<String, Object> authorBody = Map.of(
            "id", authorId,
            "name", "Ada Lovelace",
            "email", "ada+" + authorId + "@example.com",
            "bio", "Mathematician"
        );
        mockMvc
            .perform(
                post("/api/authors")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(authorBody))
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(authorId.toString()))
            .andExpect(jsonPath("$.name").value("Ada Lovelace"));

        // POST a Post referencing the author by id — proves the FK resolves
        // through the generated repository.
        UUID postId = UUID.randomUUID();
        Map<String, Object> postBody = Map.of(
            "id", postId,
            "title", "Notes on the Analytical Engine",
            "content", "In which we consider...",
            "status", PostStatus.PUBLISHED.name(),
            "authorId", authorId
        );
        mockMvc
            .perform(
                post("/api/posts")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(postBody))
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.authorId").value(authorId.toString()))
            .andExpect(jsonPath("$.status").value(PostStatus.PUBLISHED.name()));

        // List and locate the post we just created.
        MvcResult listResult = mockMvc
            .perform(get("/api/posts"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$[?(@.id == '" + postId + "')]").exists())
            .andReturn();
        // sanity: the response is a JSON array
        objectMapper.readTree(listResult.getResponse().getContentAsString());

        // POST a comment referencing the new post + author, then GET it back
        // via the nested route. Confirms the multi-step FK chain holds.
        UUID commentId = UUID.randomUUID();
        Map<String, Object> commentBody = Map.of(
            "id", commentId,
            "body", "Wonderful piece.",
            "authorId", authorId
        );
        mockMvc
            .perform(
                post("/api/posts/" + postId + "/comments")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(commentBody))
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(commentId.toString()))
            .andExpect(jsonPath("$.postId").value(postId.toString()));

        mockMvc
            .perform(get("/api/posts/" + postId + "/comments"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].body").value("Wonderful piece."));
    }
}
