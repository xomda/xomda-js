package com.example.blog.entity;

import com.example.blog.enums.PostStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "post")
public class Post {

  @Id
  @Column(name = "id", nullable = false, unique = true)
  private UUID id;

  @Column(name = "title", nullable = false)
  private String title;

  @Column(name = "content", nullable = false)
  private String content;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private PostStatus status;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "author_id", nullable = false)
  private Author author;

  @Column(name = "published_at")
  private LocalDateTime publishedAt;

  public Post() {}

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }

  public String getContent() { return content; }
  public void setContent(String content) { this.content = content; }

  public PostStatus getStatus() { return status; }
  public void setStatus(PostStatus status) { this.status = status; }

  public Author getAuthor() { return author; }
  public void setAuthor(Author author) { this.author = author; }

  public LocalDateTime getPublishedAt() { return publishedAt; }
  public void setPublishedAt(LocalDateTime publishedAt) { this.publishedAt = publishedAt; }
}
