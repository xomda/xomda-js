package com.example.blog.service;

import com.example.blog.entity.Comment;
import com.example.blog.repository.CommentRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CommentService {
  private final CommentRepository repository;

  public CommentService(CommentRepository repository) {
    this.repository = repository;
  }

  public List<Comment> findAll() { return repository.findAll(); }
  public Optional<Comment> findById(UUID id) { return repository.findById(id); }
  public Comment save(Comment entity) { return repository.save(entity); }
  public void deleteById(UUID id) { repository.deleteById(id); }
}
