package com.example.AIoTLibTQB.repository;

import com.example.AIoTLibTQB.document.InvalidatedToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Date;

public interface InvalidatedTokenRepository extends MongoRepository<InvalidatedToken, String> {

    void deleteByExpiryTimeBefore(Date now);
}
