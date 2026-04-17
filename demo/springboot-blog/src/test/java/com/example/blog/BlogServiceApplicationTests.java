package com.example.blog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.blog.entity.Author;
import com.example.blog.entity.Comment;
import com.example.blog.entity.Post;
import com.example.blog.enums.PostStatus;
import com.example.blog.repository.AuthorRepository;
import com.example.blog.repository.CommentRepository;
import com.example.blog.repository.PostRepository;
import com.example.blog.service.AuthorService;
import com.example.blog.service.PostService;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifies the xomda-generated Spring Boot wiring against an H2 backend
 * (PostgreSQL compatibility mode). Failure here proves either:
 *
 * <ul>
 *   <li>a template drifted (entity / repository / service shape changed), or</li>
 *   <li>the generated Flyway V1__init.sql no longer matches the JPA entities
 *       (ddl-auto=validate would refuse to start the context).</li>
 * </ul>
 *
 * <p>The test config in {@code src/test/resources/application.yml} points
 * at H2 so {@code mvn test} runs without Docker. Production datasource
 * config lives in {@code src/main/resources/application.yml}.
 */
@SpringBootTest
@Transactional
class BlogServiceApplicationTests {

    @Autowired
    private AuthorRepository authorRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private AuthorService authorService;

    @Autowired
    private PostService postService;

    @Test
    void contextLoadsWithGeneratedBeans() {
        assertNotNull(authorRepository, "AuthorRepository must be wired by component scan");
        assertNotNull(postRepository);
        assertNotNull(commentRepository);
        assertNotNull(authorService);
        assertNotNull(postService);
    }

    @Test
    void generatedSchemaSupportsCrudThroughGeneratedServices() {
        Author ada = new Author();
        ada.setId(UUID.randomUUID());
        ada.setName("Ada Lovelace");
        ada.setEmail("ada+" + UUID.randomUUID() + "@example.com");
        ada.setBio("Mathematician");
        Author saved = authorService.save(ada);
        assertEquals(ada.getId(), saved.getId());

        Post post = new Post();
        post.setId(UUID.randomUUID());
        post.setTitle("Notes on the Analytical Engine");
        post.setContent("In which we consider...");
        post.setStatus(PostStatus.PUBLISHED);
        post.setAuthor(saved);
        post.setPublishedAt(LocalDateTime.now());
        Post savedPost = postService.save(post);

        Comment comment = new Comment();
        comment.setId(UUID.randomUUID());
        comment.setBody("Wonderful piece.");
        comment.setPost(savedPost);
        comment.setAuthor(saved);
        comment.setCreatedAt(LocalDateTime.now());
        Comment savedComment = commentRepository.save(comment);

        assertTrue(authorRepository.findById(saved.getId()).isPresent());
        assertEquals(
            PostStatus.PUBLISHED,
            postRepository.findById(savedPost.getId()).orElseThrow().getStatus()
        );
        assertEquals(
            savedPost.getId(),
            commentRepository.findById(savedComment.getId()).orElseThrow().getPost().getId()
        );
    }
}
