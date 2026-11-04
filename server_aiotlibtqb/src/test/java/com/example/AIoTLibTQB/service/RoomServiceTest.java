package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.document.Point2D;
import com.example.AIoTLibTQB.document.Room;
import com.example.AIoTLibTQB.dto.request.RoomCreationRequest;
import com.example.AIoTLibTQB.dto.request.RoomUpdateRequest;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.dto.response.RoomResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import com.example.AIoTLibTQB.repository.RoomRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoomServiceTest {

    @Mock
    RoomRepository roomRepository;

    @Mock
    DeviceRepository deviceRepository;

    @InjectMocks
    RoomService roomService;

    private Room buildRoom(String id, String code, String name, Integer floor) {
        return Room.builder()
                .id(id)
                .code(code)
                .name(name)
                .floor(floor)
                .capacity(50)
                .description("Phòng đọc yên tĩnh")
                .targetComfortScore(85.0)
                .boundaryPolygon(List.of(
                        new Point2D(0.0, 0.0),
                        new Point2D(10.0, 0.0),
                        new Point2D(10.0, 8.0),
                        new Point2D(0.0, 8.0)
                ))
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    @DisplayName("create() - Thành công khi mã phòng chưa tồn tại")
    void create_success() {
        RoomCreationRequest request = RoomCreationRequest.builder()
                .code("ROOM_101")
                .name("Phòng đọc 101")
                .floor(1)
                .capacity(50)
                .targetComfortScore(85.0)
                .boundaryPolygon(List.of(new Point2D(0.0, 0.0), new Point2D(10.0, 10.0)))
                .build();

        when(roomRepository.existsByCode("ROOM_101")).thenReturn(false);
        when(roomRepository.save(any(Room.class))).thenAnswer(inv -> {
            Room r = inv.getArgument(0);
            r.setId("room-id-101");
            return r;
        });

        RoomResponse response = roomService.create(request);

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo("room-id-101");
        assertThat(response.getCode()).isEqualTo("ROOM_101");
        assertThat(response.getBoundaryPolygon()).hasSize(2);
        verify(roomRepository).save(any(Room.class));
    }

    @Test
    @DisplayName("create() - Ném lỗi ROOM_EXISTED khi mã phòng đã có")
    void create_existed() {
        RoomCreationRequest request = RoomCreationRequest.builder()
                .code("ROOM_101")
                .name("Phòng đọc 101")
                .floor(1)
                .build();

        when(roomRepository.existsByCode("ROOM_101")).thenReturn(true);

        assertThatThrownBy(() -> roomService.create(request))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_EXISTED);

        verify(roomRepository, never()).save(any());
    }

    @Test
    @DisplayName("create() - Ném lỗi ROOM_EXISTED khi mã phòng trùng sau khi trim và uppercase")
    void create_existed_caseInsensitiveAndTrimmed() {
        RoomCreationRequest request = RoomCreationRequest.builder()
                .code("  room_101  ")
                .name("Phòng đọc 101")
                .floor(1)
                .build();

        when(roomRepository.existsByCode("ROOM_101")).thenReturn(true);

        assertThatThrownBy(() -> roomService.create(request))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_EXISTED);

        verify(roomRepository).existsByCode("ROOM_101");
        verify(roomRepository, never()).save(any());
    }

    @Test
    @DisplayName("getById() - Thành công khi ID tồn tại")
    void getById_success() {
        Room room = buildRoom("r1", "ROOM_201", "Phòng 201", 2);
        when(roomRepository.findById("r1")).thenReturn(Optional.of(room));

        RoomResponse response = roomService.getById("r1");

        assertThat(response.getId()).isEqualTo("r1");
        assertThat(response.getCode()).isEqualTo("ROOM_201");
        assertThat(response.getFloor()).isEqualTo(2);
    }

    @Test
    @DisplayName("getById() - Ném lỗi ROOM_NOT_EXISTED khi ID không có")
    void getById_notFound() {
        when(roomRepository.findById("not-exist")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> roomService.getById("not-exist"))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_NOT_EXISTED);
    }

    @Test
    @DisplayName("getByCode() - Thành công tìm theo mã phòng")
    void getByCode_success() {
        Room room = buildRoom("r1", "ROOM_201", "Phòng 201", 2);
        when(roomRepository.findByCode("ROOM_201")).thenReturn(Optional.of(room));

        RoomResponse response = roomService.getByCode("room_201");

        assertThat(response.getCode()).isEqualTo("ROOM_201");
    }

    @Test
    @DisplayName("getByFloor() - Lấy danh sách phòng theo tầng")
    void getByFloor_success() {
        when(roomRepository.findByFloor(2)).thenReturn(List.of(
                buildRoom("r1", "ROOM_201", "Phòng 201", 2),
                buildRoom("r2", "ROOM_202", "Phòng 202", 2)
        ));

        List<RoomResponse> list = roomService.getByFloor(2);

        assertThat(list).hasSize(2);
    }

    @Test
    @DisplayName("update() - Cập nhật thông tin phòng thành công")
    void update_success() {
        Room room = buildRoom("r1", "ROOM_201", "Phòng Cũ", 2);
        when(roomRepository.findById("r1")).thenReturn(Optional.of(room));
        when(roomRepository.save(any(Room.class))).thenAnswer(inv -> inv.getArgument(0));

        RoomUpdateRequest request = RoomUpdateRequest.builder()
                .name("Phòng Mới")
                .capacity(80)
                .targetComfortScore(90.0)
                .build();

        RoomResponse updated = roomService.update("r1", request);

        assertThat(updated.getName()).isEqualTo("Phòng Mới");
        assertThat(updated.getCapacity()).isEqualTo(80);
        assertThat(updated.getTargetComfortScore()).isEqualTo(90.0);
    }

    @Test
    @DisplayName("delete() - Xóa phòng thành công khi ID tồn tại")
    void delete_success() {
        when(roomRepository.existsById("r1")).thenReturn(true);
        when(deviceRepository.findByRoomId("r1")).thenReturn(List.of());

        roomService.delete("r1");

        verify(roomRepository).deleteById("r1");
    }

    @Test
    @DisplayName("delete() - Ném lỗi ROOM_HAS_DEVICES khi phòng còn thiết bị")
    void delete_hasAssociatedDevices_throwsRoomHasDevices() {
        when(roomRepository.existsById("r1")).thenReturn(true);
        when(deviceRepository.findByRoomId("r1")).thenReturn(List.of(
                Device.builder().id("dev-1").hardwareId("HW-01").roomId("r1").build()
        ));

        assertThatThrownBy(() -> roomService.delete("r1"))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_HAS_DEVICES);

        verify(roomRepository, never()).deleteById(any());
    }

    @Test
    @DisplayName("delete() - Ném lỗi ROOM_NOT_EXISTED khi ID không tồn tại")
    void delete_notFound() {
        when(roomRepository.existsById("r99")).thenReturn(false);

        assertThatThrownBy(() -> roomService.delete("r99"))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.ROOM_NOT_EXISTED);

        verify(roomRepository, never()).deleteById(any());
    }

    @Test
    @DisplayName("getAll(pageable, floor) - Trả về phân trang PageResponse chuẩn")
    void getAll_paginated_success() {
        Room r1 = buildRoom("r1", "ROOM_101", "P101", 1);
        Room r2 = buildRoom("r2", "ROOM_102", "P102", 1);
        Pageable pageable = PageRequest.of(0, 10);
        Page<Room> page = new PageImpl<>(List.of(r1, r2), pageable, 2);

        when(roomRepository.findAll(pageable)).thenReturn(page);

        PageResponse<RoomResponse> result = roomService.getAll(pageable, null);

        assertThat(result.getContent()).hasSize(2);
        assertThat(result.getTotalElements()).isEqualTo(2);
        assertThat(result.getPage()).isEqualTo(0);
        assertThat(result.getSize()).isEqualTo(10);
    }
}
