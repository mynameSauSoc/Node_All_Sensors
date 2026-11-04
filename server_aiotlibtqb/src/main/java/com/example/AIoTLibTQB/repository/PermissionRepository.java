package com.example.AIoTLibTQB.repository;

import com.example.AIoTLibTQB.document.Permission;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PermissionRepository extends MongoRepository<Permission, String> {
}
