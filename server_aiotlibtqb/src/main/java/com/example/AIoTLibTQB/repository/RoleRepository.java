package com.example.AIoTLibTQB.repository;

import com.example.AIoTLibTQB.document.Role;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface RoleRepository extends MongoRepository<Role, String> {
    boolean existsByPermissionsName(String permissionName);
}
