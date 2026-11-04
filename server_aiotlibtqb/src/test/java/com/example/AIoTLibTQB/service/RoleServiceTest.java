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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoleServiceTest {

    @Mock RoleRepository       roleRepository;
    @Mock PermissionRepository permissionRepository;
    @Mock UserRepository       userRepository;
    @Mock RoleMapper           roleMapper;
    @Mock MongoTemplate        mongoTemplate;

    @InjectMocks RoleService roleService;

    @Nested
    @DisplayName("create()")
    class CreateTests {

        @Test
        @DisplayName("Tạo role thành công kèm permissions")
        void create_success() {
            RoleRequest request = RoleRequest.builder()
                    .name("SUPPORT")
                    .description("Support role")
                    .permissions(Set.of("VIEW_ALERTS"))
                    .build();

            Permission perm = Permission.builder().name("VIEW_ALERTS").build();
            Role role = Role.builder().name("SUPPORT").description("Support role").build();
            Role savedRole = Role.builder().name("SUPPORT").permissions(Set.of(perm)).build();
            RoleResponse response = RoleResponse.builder().name("SUPPORT").build();

            when(roleRepository.existsById("SUPPORT")).thenReturn(false);
            when(roleMapper.toRole(request)).thenReturn(role);
            when(permissionRepository.findAllById(request.getPermissions())).thenReturn(List.of(perm));
            when(roleRepository.save(role)).thenReturn(savedRole);
            when(roleMapper.toRoleResponse(savedRole)).thenReturn(response);

            RoleResponse result = roleService.create(request);

            assertThat(result.getName()).isEqualTo("SUPPORT");
            verify(roleRepository).save(role);
        }

        @Test
        @DisplayName("Tạo role đã tồn tại → ném ROLE_EXISTED")
        void create_alreadyExists_throwsException() {
            RoleRequest request = RoleRequest.builder().name("ADMIN").build();
            when(roleRepository.existsById("ADMIN")).thenReturn(true);

            assertThatThrownBy(() -> roleService.create(request))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.ROLE_EXISTED);
        }
    }

    @Nested
    @DisplayName("getListRole()")
    class GetListTests {

        @Test
        @DisplayName("Lấy danh sách role thành công")
        void getListRole_success() {
            List<Role> roles = List.of(Role.builder().name("ADMIN").build());
            List<RoleResponse> responses = List.of(RoleResponse.builder().name("ADMIN").build());

            when(roleRepository.findAll()).thenReturn(roles);
            when(roleMapper.toRoleResponses(roles)).thenReturn(responses);

            List<RoleResponse> result = roleService.getListRole();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("ADMIN");
        }
    }

    @Nested
    @DisplayName("update() & PERF-02")
    class UpdateTests {

        @Test
        @DisplayName("Role không tồn tại → ném ROLE_NOT_EXISTED")
        void update_notFound_throwsException() {
            when(roleRepository.findById("GHOST")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> roleService.update("GHOST", RoleRequest.builder().build()))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.ROLE_NOT_EXISTED);
        }

        @Test
        @DisplayName("PERF-02: Cập nhật Role thành công và gọi mongoTemplate.updateMulti thay vì vòng lặp N+1")
        void update_success_triggersUpdateMulti() {
            Role existingRole = Role.builder()
                    .name("USER")
                    .description("Old desc")
                    .permissions(new HashSet<>())
                    .build();

            RoleRequest request = RoleRequest.builder()
                    .description("New desc")
                    .permissions(Set.of("READ_SENSOR_DATA"))
                    .build();

            Permission perm = Permission.builder().name("READ_SENSOR_DATA").build();
            Role savedRole = Role.builder()
                    .name("USER")
                    .description("New desc")
                    .permissions(Set.of(perm))
                    .build();

            RoleResponse expectedResponse = RoleResponse.builder().name("USER").description("New desc").build();

            when(roleRepository.findById("USER")).thenReturn(Optional.of(existingRole));
            when(permissionRepository.findAllById(request.getPermissions())).thenReturn(List.of(perm));
            when(roleRepository.save(existingRole)).thenReturn(savedRole);
            when(roleMapper.toRoleResponse(savedRole)).thenReturn(expectedResponse);
            when(mongoTemplate.updateMulti(any(Query.class), any(Update.class), eq(User.class)))
                    .thenReturn(UpdateResult.acknowledged(10, 10L, null));

            RoleResponse result = roleService.update("USER", request);

            assertThat(result.getName()).isEqualTo("USER");

            // Xác minh PERF-02: mongoTemplate.updateMulti được gọi chính xác 1 lần
            ArgumentCaptor<Query> queryCaptor = ArgumentCaptor.forClass(Query.class);
            ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
            verify(mongoTemplate, times(1)).updateMulti(queryCaptor.capture(), updateCaptor.capture(), eq(User.class));

            Query capturedQuery = queryCaptor.getValue();
            assertThat(capturedQuery.getQueryObject().toString()).contains("roles.name");
            assertThat(capturedQuery.getQueryObject().toString()).contains("USER");

            Update capturedUpdate = updateCaptor.getValue();
            assertThat(capturedUpdate.getUpdateObject().toString()).contains("roles.$");

            // Đảm bảo không gọi userRepository.save theo cách lặp N+1 cũ
            verify(userRepository, never()).save(any(User.class));
        }
    }

    @Nested
    @DisplayName("delete()")
    class DeleteTests {

        @Test
        @DisplayName("Xóa role gọi updateMulti $pull thu hồi role khỏi users và deleteById")
        void delete_delegatesToRepository() {
            when(mongoTemplate.updateMulti(any(Query.class), any(Update.class), eq(User.class)))
                    .thenReturn(UpdateResult.acknowledged(5, 5L, null));
            doNothing().when(roleRepository).deleteById("TEMP");

            roleService.delete("TEMP");

            ArgumentCaptor<Query> queryCaptor = ArgumentCaptor.forClass(Query.class);
            ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
            verify(mongoTemplate, times(1)).updateMulti(queryCaptor.capture(), updateCaptor.capture(), eq(User.class));

            Query capturedQuery = queryCaptor.getValue();
            assertThat(capturedQuery.getQueryObject().toString()).contains("roles.name");
            assertThat(capturedQuery.getQueryObject().toString()).contains("TEMP");

            Update capturedUpdate = updateCaptor.getValue();
            assertThat(capturedUpdate.getUpdateObject().toString()).contains("$pull");
            assertThat(capturedUpdate.getUpdateObject().toString()).contains("roles");

            verify(roleRepository).deleteById("TEMP");
        }

        @Test
        @DisplayName("Xóa role hệ thống (ADMIN, USER, DEVICE...) -> ném CANNOT_DELETE_SYSTEM_ROLE")
        void delete_systemRole_throwsCannotDeleteSystemRole() {
            assertThatThrownBy(() -> roleService.delete("ADMIN"))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.CANNOT_DELETE_SYSTEM_ROLE);

            assertThatThrownBy(() -> roleService.delete("USER"))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.CANNOT_DELETE_SYSTEM_ROLE);

            verify(roleRepository, never()).deleteById(anyString());
            verify(mongoTemplate, never()).updateMulti(any(), any(), eq(User.class));
        }
    }
}
