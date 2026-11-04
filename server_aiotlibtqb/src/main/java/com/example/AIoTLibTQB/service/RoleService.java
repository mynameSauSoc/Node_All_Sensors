package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Permission;
import com.example.AIoTLibTQB.document.Role;
import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.dto.request.RoleRequest;
import com.example.AIoTLibTQB.dto.response.RoleResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.mapper.RoleMapper;
import com.example.AIoTLibTQB.repository.PermissionRepository;
import com.example.AIoTLibTQB.repository.RoleRepository;
import com.example.AIoTLibTQB.repository.UserRepository;
import com.mongodb.client.result.UpdateResult;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleService {

    RoleRepository roleRepository;
    PermissionRepository permissionRepository;
    UserRepository userRepository;
    RoleMapper roleMapper;
    MongoTemplate mongoTemplate;

    public RoleResponse create(RoleRequest request) {
        if (roleRepository.existsById(request.getName())) {
            throw new AppException(ErrorCode.ROLE_EXISTED);
        }

        Role role = roleMapper.toRole(request);

        if (request.getPermissions() != null && !request.getPermissions().isEmpty()) {
            List<Permission> permissions = permissionRepository.findAllById(request.getPermissions());
            role.setPermissions(new HashSet<>(permissions));
        }

        return roleMapper.toRoleResponse(roleRepository.save(role));
    }

    public List<RoleResponse> getListRole() {
        return roleMapper.toRoleResponses(roleRepository.findAll());
    }

    public RoleResponse update(String roleName, RoleRequest request) {
        Role role = roleRepository.findById(roleName)
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_EXISTED));

        if (request.getDescription() != null) {
            role.setDescription(request.getDescription());
        }

        if (request.getPermissions() != null) {
            List<Permission> permissions = permissionRepository.findAllById(request.getPermissions());
            role.setPermissions(new HashSet<>(permissions));
        }

        Role updatedRole = roleRepository.save(role);

        syncRoleInUsers(updatedRole);

        return roleMapper.toRoleResponse(updatedRole);
    }

    public void delete(String name) {
        if (name != null) {
            for (com.example.AIoTLibTQB.enums.Role systemRole : com.example.AIoTLibTQB.enums.Role.values()) {
                if (systemRole.name().equalsIgnoreCase(name.trim())) {
                    throw new AppException(ErrorCode.CANNOT_DELETE_SYSTEM_ROLE);
                }
            }
        }
        Query query = Query.query(Criteria.where("roles.name").is(name));
        Update update = new Update().pull("roles", Query.query(Criteria.where("name").is(name)));
        UpdateResult result = mongoTemplate.updateMulti(query, update, User.class);
        if (result != null) {
            log.info("Revoked role '{}' from {} user(s) via updateMulti", name, result.getModifiedCount());
        }
        roleRepository.deleteById(name);
    }

    public void deleteRole(String name) {
        delete(name);
    }

    private void syncRoleInUsers(Role updatedRole) {
        Query query = Query.query(Criteria.where("roles.name").is(updatedRole.getName()));
        Update update = new Update().set("roles.$", updatedRole);

        UpdateResult result = mongoTemplate.updateMulti(query, update, User.class);
        log.info("Synced updated role '{}' into {} user(s) via updateMulti",
                updatedRole.getName(), result.getModifiedCount());
    }
}
