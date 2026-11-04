package com.example.AIoTLibTQB.mapper;

import com.example.AIoTLibTQB.document.Role;
import com.example.AIoTLibTQB.dto.request.RoleRequest;
import com.example.AIoTLibTQB.dto.response.RoleResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring", uses = {PermissionMapper.class})
public interface RoleMapper {

    @Mapping(target = "permissions", ignore = true)
    Role toRole(RoleRequest request);

    RoleResponse toRoleResponse(Role role);

    List<RoleResponse> toRoleResponses(List<Role> roles);
}
