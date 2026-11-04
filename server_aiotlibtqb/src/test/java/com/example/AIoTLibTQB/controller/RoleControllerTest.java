package com.example.AIoTLibTQB.controller;

import com.example.AIoTLibTQB.dto.request.RoleRequest;
import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.dto.response.RoleResponse;
import com.example.AIoTLibTQB.service.RoleService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoleControllerTest {

    @Mock
    private RoleService roleService;

    @InjectMocks
    private RoleController roleController;

    @Test
    @DisplayName("SEC-01: RoleController phải được bảo vệ bởi @PreAuthorize(\"hasAuthority('ADMIN')\") ở cấp độ Class")
    void verifyPreAuthorizeAnnotation() {
        PreAuthorize annotation = RoleController.class.getAnnotation(PreAuthorize.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.value()).isEqualTo("hasAuthority('ADMIN')");
    }

    @Test
    @DisplayName("RoleController.create -> gọi roleService.create và trả về kết quả thành công")
    void create_delegatesToService() {
        RoleRequest request = RoleRequest.builder()
                .name("MANAGER")
                .description("Manager Role")
                .permissions(Set.of("READ_SENSOR_DATA"))
                .build();
        RoleResponse mockResponse = RoleResponse.builder()
                .name("MANAGER")
                .description("Manager Role")
                .build();
        when(roleService.create(request)).thenReturn(mockResponse);

        ApiResponse<RoleResponse> response = roleController.create(request);

        assertThat(response.getResult()).isEqualTo(mockResponse);
        verify(roleService).create(request);
    }

    @Test
    @DisplayName("RoleController.getAll -> gọi roleService.getListRole")
    void getAll_delegatesToService() {
        List<RoleResponse> mockRoles = List.of(
                RoleResponse.builder().name("ADMIN").build(),
                RoleResponse.builder().name("USER").build()
        );
        when(roleService.getListRole()).thenReturn(mockRoles);

        ApiResponse<List<RoleResponse>> response = roleController.getAll();

        assertThat(response.getResult()).isEqualTo(mockRoles);
        verify(roleService).getListRole();
    }

    @Test
    @DisplayName("RoleController.update -> gọi roleService.update")
    void update_delegatesToService() {
        RoleRequest request = RoleRequest.builder().description("Updated description").build();
        RoleResponse mockResponse = RoleResponse.builder().name("ADMIN").description("Updated description").build();
        when(roleService.update("ADMIN", request)).thenReturn(mockResponse);

        ApiResponse<RoleResponse> response = roleController.update("ADMIN", request);

        assertThat(response.getResult()).isEqualTo(mockResponse);
        verify(roleService).update("ADMIN", request);
    }

    @Test
    @DisplayName("RoleController.delete -> gọi roleService.delete")
    void delete_delegatesToService() {
        doNothing().when(roleService).delete("TEMP_ROLE");

        ApiResponse<Void> response = roleController.delete("TEMP_ROLE");

        assertThat(response).isNotNull();
        verify(roleService).delete("TEMP_ROLE");
    }
}
