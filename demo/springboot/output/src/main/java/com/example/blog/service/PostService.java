package com.example.blog.service;

import com.example.blog.entity.Post;
import com.example.blog.repository.PostRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PostService {
  private final PostRepository repository;

  public PostService(PostRepository repository) {
    this.repository = repository;
  }

  public List<Post> findAll() { return repository.findAll(); }
  public Optional<Post> findById(UUID id) { return repository.findById(id); }
  public Post save(Post entity) { return repository.save(entity); }
  public void deleteById(UUID id) { repository.deleteById(id); }
}
