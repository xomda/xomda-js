package com.example.blog.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "author")
public class Author {

  @Id
  @Column(name = "id", nullable = false, unique = true)
  private UUID id;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "email", nullable = false, unique = true)
  private String email;

  @Column(name = "bio")
  private String bio;

  public Author() {}

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }

  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }

  public String getBio() { return bio; }
  public void setBio(String bio) { this.bio = bio; }
}
