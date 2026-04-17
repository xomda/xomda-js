package com.example.blog.service;

import com.example.blog.entity.Author;
import com.example.blog.repository.AuthorRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AuthorService {
  private final AuthorRepository repository;

  public AuthorService(AuthorRepository repository) {
    this.repository = repository;
  }

  public List<Author> findAll() { return repository.findAll(); }
  public Optional<Author> findById(UUID id) { return repository.findById(id); }
  public Author save(Author entity) { return repository.save(entity); }
  public void deleteById(UUID id) { repository.deleteById(id); }
}
