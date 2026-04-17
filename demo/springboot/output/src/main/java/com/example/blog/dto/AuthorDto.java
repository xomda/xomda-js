package com.example.blog.dto;

import java.util.UUID;

public record AuthorDto(
    UUID id,
    String name,
    String email,
    String bio
) {}
