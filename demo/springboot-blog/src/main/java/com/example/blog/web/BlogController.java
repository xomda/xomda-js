package com.example.blog.web;

import com.example.blog.dto.AuthorDto;
import com.example.blog.dto.CommentDto;
import com.example.blog.dto.PostDto;
import com.example.blog.entity.Author;
import com.example.blog.entity.Comment;
import com.example.blog.entity.Post;
import com.example.blog.enums.PostStatus;
import com.example.blog.repository.AuthorRepository;
import com.example.blog.repository.CommentRepository;
import com.example.blog.repository.PostRepository;
import com.example.blog.service.AuthorService;
import com.example.blog.service.CommentService;
import com.example.blog.service.PostService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The only hand-written HTTP layer in this demo. Everything else
 * (entities, repositories, services, DTOs, enum, SQL schema) is generated
 * by xomda from {@code .xomda/model.json}.
 *
 * <p>The controller proves the wiring end-to-end: generated DTOs cross the
 * wire, generated services execute persistence, generated repositories
 * resolve cross-entity references. CRUD-only on purpose — the goal is to
 * showcase the generated surface, not to ship a blog product.
 */
@RestController
@RequestMapping("/api")
public class BlogController {

    private final AuthorService authorService;
    private final PostService postService;
    private final CommentService commentService;
    private final AuthorRepository authorRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;

    public BlogController(
        AuthorService authorService,
        PostService postService,
        CommentService commentService,
        AuthorRepository authorRepository,
        PostRepository postRepository,
        CommentRepository commentRepository
    ) {
        this.authorService = authorService;
        this.postService = postService;
        this.commentService = commentService;
        this.authorRepository = authorRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
    }

    // ─── Authors ─────────────────────────────────────────────────────────

    @GetMapping("/authors")
    public List<AuthorDto> listAuthors() {
        return authorService.findAll().stream().map(BlogController::toDto).toList();
    }

    @GetMapping("/authors/{id}")
    public ResponseEntity<AuthorDto> getAuthor(@PathVariable UUID id) {
        return authorService.findById(id).map(BlogController::toDto).map(ResponseEntity::ok).orElseGet(
            () -> ResponseEntity.notFound().build()
        );
    }

    @PostMapping("/authors")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthorDto createAuthor(@RequestBody AuthorDto dto) {
        Author entity = new Author();
        entity.setId(dto.id() != null ? dto.id() : UUID.randomUUID());
        entity.setName(dto.name());
        entity.setEmail(dto.email());
        entity.setBio(dto.bio());
        return toDto(authorService.save(entity));
    }

    @DeleteMapping("/authors/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAuthor(@PathVariable UUID id) {
        authorService.deleteById(id);
    }

    // ─── Posts ───────────────────────────────────────────────────────────

    @GetMapping("/posts")
    public List<PostDto> listPosts() {
        return postService.findAll().stream().map(BlogController::toDto).toList();
    }

    @GetMapping("/posts/{id}")
    public ResponseEntity<PostDto> getPost(@PathVariable UUID id) {
        return postService.findById(id).map(BlogController::toDto).map(ResponseEntity::ok).orElseGet(
            () -> ResponseEntity.notFound().build()
        );
    }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<PostDto> createPost(@RequestBody PostDto dto) {
        Author author = authorRepository.findById(dto.authorId()).orElse(null);
        if (author == null) {
            return ResponseEntity.badRequest().build();
        }
        Post entity = new Post();
        entity.setId(dto.id() != null ? dto.id() : UUID.randomUUID());
        entity.setTitle(dto.title());
        entity.setContent(dto.content());
        entity.setStatus(dto.status() != null ? dto.status() : PostStatus.DRAFT);
        entity.setAuthor(author);
        entity.setPublishedAt(dto.publishedAt());
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(postService.save(entity)));
    }

    // ─── Comments ────────────────────────────────────────────────────────

    @GetMapping("/posts/{postId}/comments")
    public ResponseEntity<List<CommentDto>> listCommentsForPost(@PathVariable UUID postId) {
        if (postRepository.findById(postId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        List<CommentDto> body = commentService
            .findAll()
            .stream()
            .filter(c -> c.getPost().getId().equals(postId))
            .map(BlogController::toDto)
            .toList();
        return ResponseEntity.ok(body);
    }

    @PostMapping("/posts/{postId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<CommentDto> createComment(
        @PathVariable UUID postId,
        @RequestBody CommentDto dto
    ) {
        Post post = postRepository.findById(postId).orElse(null);
        Author author = authorRepository.findById(dto.authorId()).orElse(null);
        if (post == null || author == null) {
            return ResponseEntity.badRequest().build();
        }
        Comment entity = new Comment();
        entity.setId(dto.id() != null ? dto.id() : UUID.randomUUID());
        entity.setBody(dto.body());
        entity.setPost(post);
        entity.setAuthor(author);
        entity.setCreatedAt(dto.createdAt() != null ? dto.createdAt() : LocalDateTime.now());
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(commentRepository.save(entity)));
    }

    // ─── Mappers ─────────────────────────────────────────────────────────

    private static AuthorDto toDto(Author a) {
        return new AuthorDto(a.getId(), a.getName(), a.getEmail(), a.getBio());
    }

    private static PostDto toDto(Post p) {
        return new PostDto(
            p.getId(),
            p.getTitle(),
            p.getContent(),
            p.getStatus(),
            p.getAuthor() != null ? p.getAuthor().getId() : null,
            p.getPublishedAt()
        );
    }

    private static CommentDto toDto(Comment c) {
        return new CommentDto(
            c.getId(),
            c.getBody(),
            c.getPost() != null ? c.getPost().getId() : null,
            c.getAuthor() != null ? c.getAuthor().getId() : null,
            c.getCreatedAt()
        );
    }
}
