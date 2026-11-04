package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Permission;
import com.example.AIoTLibTQB.dto.request.PermissionRequest;
import com.example.AIoTLibTQB.dto.response.PermissionResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.mapper.PermissionMapper;
import com.example.AIoTLibTQB.repository.PermissionRepository;
import com.example.AIoTLibTQB.repository.RoleRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PermissionServiceTest {

    @Mock PermissionRepository permissionRepository;
    @Mock RoleRepository       roleRepository;
    @Mock PermissionMapper     permissionMapper;

    @InjectMocks PermissionService permissionService;

    @Nested
    @DisplayName("create()")
    class CreateTests {

        @Test
        @DisplayName("Tạo permission mới thành công")
        void create_success() {
            PermissionRequest request = PermissionRequest.builder()
                    .name("CUSTOM_PERM")
                    .description("Mô tả")
                    .build();
            Permission perm = Permission.builder().name("CUSTOM_PERM").description("Mô tả").build();
            PermissionResponse response = PermissionResponse.builder().name("CUSTOM_PERM").description("Mô tả").build();

            when(permissionRepository.existsById("CUSTOM_PERM")).thenReturn(false);
            when(permissionMapper.toPermission(request)).thenReturn(perm);
            when(permissionRepository.save(perm)).thenReturn(perm);
            when(permissionMapper.toPermissionResponse(perm)).thenReturn(response);

            PermissionResponse result = permissionService.create(request);

            assertThat(result.getName()).isEqualTo("CUSTOM_PERM");
            verify(permissionRepository).save(perm);
        }

        @Test
        @DisplayName("Permission đã tồn tại -> ném PERMISSION_EXISTED")
        void create_alreadyExists_throwsException() {
            PermissionRequest request = PermissionRequest.builder().name("EXISTING_PERM").build();
            when(permissionRepository.existsById("EXISTING_PERM")).thenReturn(true);

            assertThatThrownBy(() -> permissionService.create(request))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.PERMISSION_EXISTED);
        }
    }

    @Nested
    @DisplayName("getListPermission()")
    class GetListTests {

        @Test
        @DisplayName("Lấy danh sách permissions thành công")
        void getListPermission_success() {
            List<Permission> list = List.of(Permission.builder().name("P1").build());
            List<PermissionResponse> respList = List.of(PermissionResponse.builder().name("P1").build());

            when(permissionRepository.findAll()).thenReturn(list);
            when(permissionMapper.toPermissionResponses(list)).thenReturn(respList);

            List<PermissionResponse> result = permissionService.getListPermission();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("P1");
        }
    }

    @Nested
    @DisplayName("delete() - DATA-01")
    class DeleteTests {

        @Test
        @DisplayName("DATA-01: Quyền không tồn tại -> ném PERMISSION_NOT_EXISTED")
        void delete_notExisted_throwsException() {
            when(permissionRepository.existsById("UNKNOWN_PERM")).thenReturn(false);

            assertThatThrownBy(() -> permissionService.delete("UNKNOWN_PERM"))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.PERMISSION_NOT_EXISTED);

            verify(permissionRepository, never()).deleteById(anyString());
        }

        @Test
        @DisplayName("DATA-01: Quyền đang được Role sử dụng -> ném PERMISSION_IN_USE, không cho xóa")
        void delete_inUseByRole_throwsPermissionInUse() {
            when(permissionRepository.existsById("READ_SENSOR_DATA")).thenReturn(true);
            when(roleRepository.existsByPermissionsName("READ_SENSOR_DATA")).thenReturn(true);

            assertThatThrownBy(() -> permissionService.delete("READ_SENSOR_DATA"))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.PERMISSION_IN_USE);

            verify(permissionRepository, never()).deleteById("READ_SENSOR_DATA");
        }

        @Test
        @DisplayName("DATA-01: Quyền tồn tại và không bị Role nào tham chiếu -> xóa thành công")
        void delete_notInUse_success() {
            when(permissionRepository.existsById("ORPHAN_PERM")).thenReturn(true);
            when(roleRepository.existsByPermissionsName("ORPHAN_PERM")).thenReturn(false);

            permissionService.delete("ORPHAN_PERM");

            verify(permissionRepository).deleteById("ORPHAN_PERM");
        }
    }
}
