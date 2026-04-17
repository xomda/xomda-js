package com.example.blog.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record CommentDto(
    UUID id,
    String body,
    UUID postId,
    UUID authorId,
    LocalDateTime createdAt
) {}
