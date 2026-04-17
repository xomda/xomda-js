package com.example.blog.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "comment")
public class Comment {

  @Id
  @Column(name = "id", nullable = false, unique = true)
  private UUID id;

  @Column(name = "body", nullable = false)
  private String body;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "post_id", nullable = false)
  private Post post;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "author_id", nullable = false)
  private Author author;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  public Comment() {}

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public String getBody() { return body; }
  public void setBody(String body) { this.body = body; }

  public Post getPost() { return post; }
  public void setPost(Post post) { this.post = post; }

  public Author getAuthor() { return author; }
  public void setAuthor(Author author) { this.author = author; }

  public LocalDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
