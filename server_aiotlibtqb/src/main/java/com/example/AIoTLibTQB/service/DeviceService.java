package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.dto.request.DeviceAuthRequest;
import com.example.AIoTLibTQB.dto.request.DeviceRegistrationRequest;
import com.example.AIoTLibTQB.dto.response.AuthenticationResponse;
import com.example.AIoTLibTQB.dto.response.DeviceRegistrationResponse;
import com.example.AIoTLibTQB.dto.response.DeviceResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.dto.request.DeviceUpdateRequest;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DeviceService {

    DeviceRepository deviceRepository;
    PasswordEncoder  passwordEncoder;
    AuthenticationService authenticationService;
    UserRepository userRepository;
    DiscoveredDeviceService discoveredDeviceService;
    @NonFinal
    DeviceMetadataCache deviceMetadataCache;

    public DeviceService(
            DeviceRepository deviceRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationService authenticationService,
            UserRepository userRepository,
            DiscoveredDeviceService discoveredDeviceService,
            @Autowired(required = false) DeviceMetadataCache deviceMetadataCache) {
        this.deviceRepository = deviceRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationService = authenticationService;
        this.userRepository = userRepository;
        this.discoveredDeviceService = discoveredDeviceService;
        this.deviceMetadataCache = deviceMetadataCache;
    }

    private static final long ONLINE_THRESHOLD_MINUTES = 5L;

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    public DeviceRegistrationResponse register(DeviceRegistrationRequest request) {

        return deviceRepository.findByHardwareId(request.getHardwareId())
                .map(existing -> {
                    log.info("Device '{}' already registered (hardwareId={}), returning existing.",
                            existing.getName(), existing.getHardwareId());
                    return toRegistrationResponse(existing, null, true);
                })
                .orElseGet(() -> createNewDevice(request));
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    public DeviceRegistrationResponse regenerateApiKey(String deviceId) {
        Device device = findById(deviceId);
        String rawKey = generateAndHashApiKey(device);
        Device saved = deviceRepository.save(device);
        log.warn("API Key regenerated for device '{}' (id={})", saved.getName(), saved.getId());
        return toRegistrationResponse(saved, rawKey, false);
    }

    public AuthenticationResponse authenticateDevice(DeviceAuthRequest request) {
        Device device = deviceRepository.findByHardwareId(request.getHardwareId())
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_EXISTED));

        if (!device.isActive()) {
            throw new AppException(ErrorCode.DEVICE_INACTIVE);
        }

        if (!passwordEncoder.matches(request.getApiKey(), device.getApiKeyHash())) {
            throw new AppException(ErrorCode.INVALID_API_KEY);
        }

        device.setLastSeenAt(Instant.now());
        deviceRepository.save(device);

        String token = authenticationService.generateDeviceToken(device);
        log.debug("Device '{}' authenticated successfully.", device.getName());
        return AuthenticationResponse.builder().token(token).build();
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    public List<DeviceResponse> getAll() {
        return deviceRepository.findAll().stream()
                .map(this::toDeviceResponse)
                .collect(Collectors.toList());
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER', 'MAINTENANCE', 'VIEWER', 'USER')")
    public PageResponse<DeviceResponse> getAll(Pageable pageable, String zoneId, String roomId) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            boolean isFullAccess = auth.getAuthorities().stream()
                    .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
                            || "LIBRARIAN".equals(a.getAuthority()) || "ROLE_LIBRARIAN".equals(a.getAuthority())
                            || "MAINTENANCE".equals(a.getAuthority()) || "ROLE_MAINTENANCE".equals(a.getAuthority()));
            boolean isZoneManager = !isFullAccess && auth.getAuthorities().stream()
                    .anyMatch(a -> "ZONE_MANAGER".equals(a.getAuthority()) || "ROLE_ZONE_MANAGER".equals(a.getAuthority()));
            if (isZoneManager) {
                User user = userRepository.findByUsername(auth.getName()).orElse(null);
                java.util.Set<String> allowedZones = (user != null && user.getAssignedZones() != null)
                        ? user.getAssignedZones()
                        : java.util.Set.of();
                if (zoneId != null && !zoneId.isBlank() && !allowedZones.contains(zoneId)) {
                    throw new AppException(ErrorCode.ZONE_ACCESS_DENIED);
                }
                List<Device> devices = deviceRepository.findAll().stream()
                        .filter(d -> d.getZoneId() != null && allowedZones.contains(d.getZoneId()))
                        .filter(d -> zoneId == null || zoneId.isBlank() || zoneId.equals(d.getZoneId()))
                        .filter(d -> roomId == null || roomId.isBlank() || roomId.equals(d.getRoomId()))
                        .collect(Collectors.toList());
                return toPageResponse(devices, pageable);
            }
        }
        if (zoneId != null && !zoneId.isBlank()) {
            List<Device> devices = deviceRepository.findByZoneId(zoneId);
            if (roomId != null && !roomId.isBlank()) {
                devices = devices.stream()
                        .filter(d -> roomId.equals(d.getRoomId()))
                        .collect(Collectors.toList());
            }
            return toPageResponse(devices, pageable);
        }

        if (roomId != null && !roomId.isBlank()) {
            List<Device> devices = deviceRepository.findByRoomId(roomId);
            return toPageResponse(devices, pageable);
        }

        Page<Device> page = deviceRepository.findAll(pageable);
        List<DeviceResponse> content = page.getContent().stream()
                .map(this::toDeviceResponse)
                .collect(Collectors.toList());

        return PageResponse.<DeviceResponse>builder()
                .content(content)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    private PageResponse<DeviceResponse> toPageResponse(List<Device> list, Pageable pageable) {
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), list.size());
        List<Device> sub = (start <= list.size()) ? list.subList(start, end) : List.of();
        List<DeviceResponse> content = sub.stream().map(this::toDeviceResponse).collect(Collectors.toList());
        int totalPages = pageable.getPageSize() == 0 ? 1 : (int) Math.ceil((double) list.size() / pageable.getPageSize());
        boolean isLast = (long) (pageable.getPageNumber() + 1) * pageable.getPageSize() >= list.size();

        return PageResponse.<DeviceResponse>builder()
                .content(content)
                .page(pageable.getPageNumber())
                .size(pageable.getPageSize())
                .totalElements(list.size())
                .totalPages(totalPages)
                .last(isLast)
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER', 'MAINTENANCE')")
    public DeviceResponse getById(String id) {
        Device device = findById(id);
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            boolean isFullAccess = auth.getAuthorities().stream()
                    .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
                            || "LIBRARIAN".equals(a.getAuthority()) || "ROLE_LIBRARIAN".equals(a.getAuthority())
                            || "MAINTENANCE".equals(a.getAuthority()) || "ROLE_MAINTENANCE".equals(a.getAuthority()));
            boolean isZoneManager = !isFullAccess && auth.getAuthorities().stream()
                    .anyMatch(a -> "ZONE_MANAGER".equals(a.getAuthority()) || "ROLE_ZONE_MANAGER".equals(a.getAuthority()));
            if (isZoneManager) {
                User user = userRepository.findByUsername(auth.getName()).orElse(null);
                java.util.Set<String> allowedZones = (user != null && user.getAssignedZones() != null)
                        ? user.getAssignedZones()
                        : java.util.Set.of();
                if (device.getZoneId() != null && !allowedZones.contains(device.getZoneId())) {
                    throw new AppException(ErrorCode.ZONE_ACCESS_DENIED);
                }
            }
        }
        return toDeviceResponse(device);
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER')")
    public List<DeviceResponse> getByZone(String zoneId) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            boolean isFullAccess = auth.getAuthorities().stream()
                    .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
                            || "LIBRARIAN".equals(a.getAuthority()) || "ROLE_LIBRARIAN".equals(a.getAuthority()));

            if (!isFullAccess) {
                String username = auth.getName();
                User user = userRepository.findByUsername(username)
                        .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
                if (user.getAssignedZones() == null || !user.getAssignedZones().contains(zoneId)) {
                    throw new AppException(ErrorCode.ZONE_ACCESS_DENIED);
                }
            }
        }

        return deviceRepository.findByZoneId(zoneId).stream()
                .map(this::toDeviceResponse)
                .collect(Collectors.toList());
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    public DeviceResponse update(String id, DeviceUpdateRequest request) {
        Device device = findById(id);

        if (request.getName() != null && !request.getName().isBlank()) {
            device.setName(request.getName());
        }
        if (request.getZoneId() != null && !request.getZoneId().isBlank()) {
            device.setZoneId(request.getZoneId());
        }
        if (request.getRoomId() != null) {
            device.setRoomId(request.getRoomId().isBlank() ? null : request.getRoomId().trim());
        }
        if (request.getPosX() != null) {
            device.setPosX(request.getPosX());
        }
        if (request.getPosY() != null) {
            device.setPosY(request.getPosY());
        }
        if (request.getDeviceType() != null && !request.getDeviceType().isBlank()) {
            device.setDeviceType(request.getDeviceType());
        }
        if (request.getLocation() != null) {
            device.setLocation(request.getLocation());
        }
        if (request.getFirmwareVersion() != null && !request.getFirmwareVersion().isBlank()) {
            device.setFirmwareVersion(request.getFirmwareVersion());
        }

        Device saved = deviceRepository.save(device);
        if (deviceMetadataCache != null && saved.getHardwareId() != null) {
            deviceMetadataCache.invalidate(saved.getHardwareId());
        }
        return toDeviceResponse(saved);
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    public DeviceResponse toggleStatus(String id, boolean active) {
        Device device = findById(id);
        device.setActive(active);
        Device saved = deviceRepository.save(device);
        if (deviceMetadataCache != null && saved.getHardwareId() != null) {
            deviceMetadataCache.invalidate(saved.getHardwareId());
        }
        return toDeviceResponse(saved);
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    public void delete(String id) {
        Device device = findById(id);
        deviceRepository.deleteById(id);
        if (deviceMetadataCache != null && device.getHardwareId() != null) {
            deviceMetadataCache.invalidate(device.getHardwareId());
        }
    }

    public void updateLastSeen(String deviceId) {
        deviceRepository.findById(deviceId).ifPresent(device -> {
            device.setLastSeenAt(Instant.now());
            deviceRepository.save(device);
        });
    }

    private Device findById(String id) {
        return deviceRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DEVICE_NOT_EXISTED));
    }

    private DeviceRegistrationResponse createNewDevice(DeviceRegistrationRequest request) {
        Device device = Device.builder()
                .name(request.getName())
                .hardwareId(request.getHardwareId())
                .zoneId(request.getZoneId())
                .roomId(request.getRoomId())
                .posX(request.getPosX())
                .posY(request.getPosY())
                .deviceType(request.getDeviceType())
                .location(request.getLocation())
                .firmwareVersion(request.getFirmwareVersion())
                .isActive(true)
                .build();

        String rawKey = generateAndHashApiKey(device);
        Device saved = deviceRepository.save(device);
        discoveredDeviceService.removeDiscovered(saved.getHardwareId());

        log.info("New device registered: '{}' (hardwareId={}, zone={}, room={})",
                saved.getName(), saved.getHardwareId(), saved.getZoneId(), saved.getRoomId());
        return toRegistrationResponse(saved, rawKey, false);
    }

    private String generateAndHashApiKey(Device device) {
        String rawKey = UUID.randomUUID().toString().replace("-", "");
        device.setApiKeyHash(passwordEncoder.encode(rawKey));
        return rawKey;
    }

    private DeviceRegistrationResponse toRegistrationResponse(
            Device device, String rawApiKey, boolean alreadyExisted) {
        return DeviceRegistrationResponse.builder()
                .id(device.getId())
                .name(device.getName())
                .hardwareId(device.getHardwareId())
                .zoneId(device.getZoneId())
                .roomId(device.getRoomId())
                .posX(device.getPosX())
                .posY(device.getPosY())
                .deviceType(device.getDeviceType())
                .location(device.getLocation())
                .firmwareVersion(device.getFirmwareVersion())
                .isActive(device.isActive())
                .createdAt(device.getCreatedAt())
                .rawApiKey(rawApiKey)
                .alreadyExisted(alreadyExisted)
                .build();
    }

    private DeviceResponse toDeviceResponse(Device device) {
        boolean online = !"OFFLINE".equalsIgnoreCase(device.getConnectionState()) &&
                device.getLastSeenAt() != null &&
                device.getLastSeenAt().isAfter(
                        Instant.now().minus(ONLINE_THRESHOLD_MINUTES, ChronoUnit.MINUTES));
        return DeviceResponse.builder()
                .id(device.getId())
                .name(device.getName())
                .hardwareId(device.getHardwareId())
                .zoneId(device.getZoneId())
                .roomId(device.getRoomId())
                .posX(device.getPosX())
                .posY(device.getPosY())
                .deviceType(device.getDeviceType())
                .location(device.getLocation())
                .firmwareVersion(device.getFirmwareVersion())
                .isActive(device.isActive())
                .lastSeenAt(device.getLastSeenAt())
                .connectionState(device.getConnectionState())
                .lastOfflineAt(device.getLastOfflineAt())
                .createdAt(device.getCreatedAt())
                .updatedAt(device.getUpdatedAt())
                .online(online)
                .build();
    }
}
