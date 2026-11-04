package com.example.AIoTLibTQB.mapper;

import com.example.AIoTLibTQB.document.Permission;
import com.example.AIoTLibTQB.dto.request.PermissionRequest;
import com.example.AIoTLibTQB.dto.response.PermissionResponse;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface PermissionMapper {

    Permission toPermission(PermissionRequest request);

    PermissionResponse toPermissionResponse(Permission permission);

    List<PermissionResponse> toPermissionResponses(List<Permission> permissions);
}
