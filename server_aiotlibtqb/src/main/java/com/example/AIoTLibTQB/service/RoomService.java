package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Room;
import com.example.AIoTLibTQB.dto.request.RoomCreationRequest;
import com.example.AIoTLibTQB.dto.request.RoomUpdateRequest;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.dto.response.RoomResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.enums.RoomType;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import com.example.AIoTLibTQB.repository.RoomRepository;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoomService {

    RoomRepository roomRepository;
    DeviceRepository deviceRepository;
    ComfortScoreService comfortScoreService;
    LatestTelemetryCache latestTelemetryCache;

    @Autowired
    public RoomService(RoomRepository roomRepository,
                       DeviceRepository deviceRepository,
                       @Autowired(required = false) ComfortScoreService comfortScoreService,
                       @Autowired(required = false) LatestTelemetryCache latestTelemetryCache) {
        this.roomRepository = roomRepository;
        this.deviceRepository = deviceRepository;
        this.comfortScoreService = comfortScoreService;
        this.latestTelemetryCache = latestTelemetryCache;
    }

    public RoomService(RoomRepository roomRepository, DeviceRepository deviceRepository) {
        this(roomRepository, deviceRepository, null, null);
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    public RoomResponse create(RoomCreationRequest request) {
        String normalizedCode = request.getCode().trim().toUpperCase();
        if (roomRepository.existsByCode(normalizedCode)) {
            throw new AppException(ErrorCode.ROOM_EXISTED);
        }

        Room room = Room.builder()
                .code(normalizedCode)
                .name(request.getName().trim())
                .floor(request.getFloor())
                .capacity(request.getCapacity())
                .description(request.getDescription())
                .targetComfortScore(request.getTargetComfortScore())
                .boundaryPolygon(request.getBoundaryPolygon())
                .type(request.getType() != null ? request.getType() : RoomType.STUDY_ROOM)
                .build();

        Room saved = roomRepository.save(room);
        log.info("New room created: '{}' (code={}, floor={})", saved.getName(), saved.getCode(), saved.getFloor());
        return toRoomResponse(saved);
    }

    public List<RoomResponse> getAll() {
        return roomRepository.findAll().stream()
                .map(this::toRoomResponse)
                .collect(Collectors.toList());
    }

    public PageResponse<RoomResponse> getAll(Pageable pageable, Integer floor) {
        if (floor != null) {
            List<Room> roomsOnFloor = roomRepository.findByFloor(floor);
            int start = (int) pageable.getOffset();
            int end = Math.min(start + pageable.getPageSize(), roomsOnFloor.size());
            List<Room> sub = (start <= roomsOnFloor.size())
                    ? roomsOnFloor.subList(start, end)
                    : List.of();
            Page<Room> page = new PageImpl<>(sub, pageable, roomsOnFloor.size());
            return PageResponse.<RoomResponse>builder()
                    .content(page.getContent().stream().map(this::toRoomResponse).collect(Collectors.toList()))
                    .page(page.getNumber())
                    .size(page.getSize())
                    .totalElements(page.getTotalElements())
                    .totalPages(page.getTotalPages())
                    .last(page.isLast())
                    .build();
        }

        Page<Room> page = roomRepository.findAll(pageable);
        return PageResponse.<RoomResponse>builder()
                .content(page.getContent().stream().map(this::toRoomResponse).collect(Collectors.toList()))
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    public RoomResponse getById(String id) {
        return toRoomResponse(findRoomById(id));
    }

    public RoomResponse getByCode(String code) {
        return roomRepository.findByCode(code.trim().toUpperCase())
                .map(this::toRoomResponse)
                .orElseThrow(() -> new AppException(ErrorCode.ROOM_NOT_EXISTED));
    }

    public List<RoomResponse> getByFloor(Integer floor) {
        return roomRepository.findByFloor(floor).stream()
                .map(this::toRoomResponse)
                .collect(Collectors.toList());
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    public RoomResponse update(String id, RoomUpdateRequest request) {
        Room room = findRoomById(id);

        if (request.getName() != null && !request.getName().isBlank()) {
            room.setName(request.getName().trim());
        }
        if (request.getFloor() != null) {
            room.setFloor(request.getFloor());
        }
        if (request.getCapacity() != null) {
            room.setCapacity(request.getCapacity());
        }
        if (request.getDescription() != null) {
            room.setDescription(request.getDescription());
        }
        if (request.getTargetComfortScore() != null) {
            room.setTargetComfortScore(request.getTargetComfortScore());
        }
        if (request.getBoundaryPolygon() != null) {
            room.setBoundaryPolygon(request.getBoundaryPolygon());
        }
        if (request.getType() != null) {
            room.setType(request.getType());
        }

        Room updated = roomRepository.save(room);
        if (comfortScoreService != null) {
            comfortScoreService.invalidateRoomTypeCache(id);
        }
        if (latestTelemetryCache != null) {
            latestTelemetryCache.removeRoomTelemetry(id);
        }
        log.info("Room updated: '{}' (code={})", updated.getName(), updated.getCode());
        return toRoomResponse(updated);
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    public void delete(String id) {
        if (!roomRepository.existsById(id)) {
            throw new AppException(ErrorCode.ROOM_NOT_EXISTED);
        }
        if (!deviceRepository.findByRoomId(id).isEmpty()) {
            throw new AppException(ErrorCode.ROOM_HAS_DEVICES);
        }
        roomRepository.deleteById(id);
        if (comfortScoreService != null) {
            comfortScoreService.invalidateRoomTypeCache(id);
        }
        if (latestTelemetryCache != null) {
            latestTelemetryCache.removeRoomTelemetry(id);
        }
        log.warn("Room deleted: (id={})", id);
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    public void deleteRoom(String id) {
        delete(id);
    }

    private Room findRoomById(String id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ROOM_NOT_EXISTED));
    }

    private RoomResponse toRoomResponse(Room room) {
        return RoomResponse.builder()
                .id(room.getId())
                .code(room.getCode())
                .name(room.getName())
                .floor(room.getFloor())
                .capacity(room.getCapacity())
                .description(room.getDescription())
                .targetComfortScore(room.getTargetComfortScore())
                .boundaryPolygon(room.getBoundaryPolygon())
                .type(room.getType() != null ? room.getType() : RoomType.STUDY_ROOM)
                .createdAt(room.getCreatedAt())
                .updatedAt(room.getUpdatedAt())
                .build();
    }
}
