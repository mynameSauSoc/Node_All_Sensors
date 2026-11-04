package com.example.AIoTLibTQB.mapper;

import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.dto.request.UserCreationRequest;
import com.example.AIoTLibTQB.dto.request.UserUpdateRequest;
import com.example.AIoTLibTQB.dto.response.UserResponse;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring", uses = {RoleMapper.class})
public interface UserMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "roles", ignore = true)
    @Mapping(target = "assignedZones", ignore = true)
    @Mapping(target = "credentialsUpdatedAt", ignore = true)
    User toUser(UserCreationRequest request);

    UserResponse toUserResponse(User user);

    List<UserResponse> toUserResponses(List<User> users);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "roles", ignore = true)
    @Mapping(target = "assignedZones", ignore = true)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "username", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "credentialsUpdatedAt", ignore = true)
    void updateUser(@MappingTarget User user, UserUpdateRequest request);
}
