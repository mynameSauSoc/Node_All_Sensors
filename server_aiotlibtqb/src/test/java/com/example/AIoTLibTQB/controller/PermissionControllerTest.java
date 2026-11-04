package com.example.AIoTLibTQB.controller;

import com.example.AIoTLibTQB.dto.request.PermissionRequest;
import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.dto.response.PermissionResponse;
import com.example.AIoTLibTQB.service.PermissionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PermissionControllerTest {

    @Mock
    private PermissionService permissionService;

    @InjectMocks
    private PermissionController permissionController;

    @Test
    @DisplayName("SEC-01: PermissionController phải được bảo vệ bởi @PreAuthorize(\"hasAuthority('ADMIN')\") ở cấp độ Class")
    void verifyPreAuthorizeAnnotation() {
        PreAuthorize annotation = PermissionController.class.getAnnotation(PreAuthorize.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.value()).isEqualTo("hasAuthority('ADMIN')");
    }

    @Test
    @DisplayName("PermissionController.create -> gọi permissionService.create và trả về kết quả")
    void create_delegatesToService() {
        PermissionRequest request = PermissionRequest.builder()
                .name("EXPORT_REPORTS")
                .description("Quyền xuất báo cáo")
                .build();
        PermissionResponse mockResponse = PermissionResponse.builder()
                .name("EXPORT_REPORTS")
                .description("Quyền xuất báo cáo")
                .build();
        when(permissionService.create(request)).thenReturn(mockResponse);

        ApiResponse<PermissionResponse> response = permissionController.create(request);

        assertThat(response.getResult()).isEqualTo(mockResponse);
        verify(permissionService).create(request);
    }

    @Test
    @DisplayName("PermissionController.getAll -> gọi permissionService.getListPermission")
    void getAll_delegatesToService() {
        List<PermissionResponse> mockList = List.of(
                PermissionResponse.builder().name("READ_SENSOR_DATA").build(),
                PermissionResponse.builder().name("WRITE_SENSOR_DATA").build()
        );
        when(permissionService.getListPermission()).thenReturn(mockList);

        ApiResponse<List<PermissionResponse>> response = permissionController.getAll();

        assertThat(response.getResult()).isEqualTo(mockList);
        verify(permissionService).getListPermission();
    }

    @Test
    @DisplayName("PermissionController.delete -> gọi permissionService.delete")
    void delete_delegatesToService() {
        doNothing().when(permissionService).delete("TEMP_PERMISSION");

        ApiResponse<Void> response = permissionController.delete("TEMP_PERMISSION");

        assertThat(response).isNotNull();
        verify(permissionService).delete("TEMP_PERMISSION");
    }
}
