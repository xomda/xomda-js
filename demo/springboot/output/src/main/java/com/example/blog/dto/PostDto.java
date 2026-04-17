package com.example.blog.dto;

import com.example.blog.enums.PostStatus;
import java.time.LocalDateTime;
import java.util.UUID;

public record PostDto(
    UUID id,
    String title,
    String content,
    PostStatus status,
    UUID authorId,
    LocalDateTime publishedAt
) {}
