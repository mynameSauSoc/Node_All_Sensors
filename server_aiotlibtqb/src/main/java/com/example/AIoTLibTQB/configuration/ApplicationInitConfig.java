package com.example.AIoTLibTQB.configuration;

import com.example.AIoTLibTQB.document.Permission;
import com.example.AIoTLibTQB.document.Role;
import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.repository.PermissionRepository;
import com.example.AIoTLibTQB.repository.RoleRepository;
import com.example.AIoTLibTQB.repository.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.security.SecureRandom;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Configuration
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ApplicationInitConfig {

    PasswordEncoder      passwordEncoder;
    UserRepository       userRepository;
    RoleRepository       roleRepository;
    PermissionRepository permissionRepository;
    Environment          environment;

    @Bean
    ApplicationRunner applicationRunner() {
        return args -> {

            record PermDef(String name, String description) {}

            PermDef[] permDefs = {

                new PermDef("READ_SENSOR_DATA",
                        "Xem dữ liệu sensor (latest value, summary dashboard)"),
                new PermDef("READ_SENSOR_DETAIL",
                        "Xem raw data đầy đủ, query lịch sử với resolution cao"),
                new PermDef("WRITE_SENSOR_DATA",
                        "Ghi telemetry data — chỉ dành cho IoT device (ESP32-S3)"),

                new PermDef("VIEW_ALERTS",
                        "Xem danh sách cảnh báo hiện tại và lịch sử"),
                new PermDef("ACKNOWLEDGE_ALERT",
                        "Xác nhận đã biết/đang xử lý một cảnh báo"),
                new PermDef("MANAGE_ALERT_CONFIG",
                        "Cấu hình ngưỡng cảnh báo: threshold, cooldown, severity"),

                new PermDef("MANAGE_DEVICES",
                        "Đăng ký, cấu hình, thu hồi API key của thiết bị IoT"),
                new PermDef("VIEW_DEVICE_STATUS",
                        "Xem trạng thái online/offline, RSSI, firmware version"),

                new PermDef("MANAGE_ZONES",
                        "Tạo, sửa, xóa zone (phòng/khu vực) và gán node vào zone"),
                new PermDef("VIEW_ZONE_SUMMARY",
                        "Xem dashboard tóm tắt toàn zone"),

                new PermDef("GENERATE_REPORT",
                        "Xuất báo cáo định kỳ dạng PDF/CSV theo chuẩn TCVN 8681"),
                new PermDef("VIEW_ANALYTICS",
                        "Xem biểu đồ trend, phân tích thống kê, VTT Mould Index history"),

                new PermDef("MANAGE_USERS",
                        "Tạo/sửa/xóa tài khoản người dùng"),
                new PermDef("MANAGE_ROLES",
                        "Tạo/sửa/xóa role và permission — chỉ ADMIN"),
            };

            for (PermDef def : permDefs) {
                if (!permissionRepository.existsById(def.name())) {
                    permissionRepository.save(
                            Permission.builder()
                                    .name(def.name())
                                    .description(def.description())
                                    .build());
                    log.info("Seeded permission: {}", def.name());
                }
            }

            Map<String, Permission> allPerms = permissionRepository.findAll()
                    .stream()
                    .collect(Collectors.toMap(Permission::getName, Function.identity()));

            Function<String[], Set<Permission>> permsOf = names ->
                    Arrays.stream(names)
                            .map(allPerms::get)
                            .collect(Collectors.toSet());

            record RoleDef(String name, String description, String[] permissions) {}

            RoleDef[] roleDefs = {

                new RoleDef("ADMIN", "Quản trị hệ thống toàn quyền (IT/DevOps)",
                        new String[]{
                            "READ_SENSOR_DATA", "READ_SENSOR_DETAIL", "WRITE_SENSOR_DATA",
                            "VIEW_ALERTS", "ACKNOWLEDGE_ALERT", "MANAGE_ALERT_CONFIG",
                            "MANAGE_DEVICES", "VIEW_DEVICE_STATUS",
                            "MANAGE_ZONES", "VIEW_ZONE_SUMMARY",
                            "GENERATE_REPORT", "VIEW_ANALYTICS",
                            "MANAGE_USERS", "MANAGE_ROLES"
                        }),

                new RoleDef("LIBRARIAN",
                        "Thủ thư chính: xem tất cả zone, cấu hình ngưỡng, xuất báo cáo",
                        new String[]{
                            "READ_SENSOR_DATA", "READ_SENSOR_DETAIL",
                            "VIEW_ALERTS", "ACKNOWLEDGE_ALERT", "MANAGE_ALERT_CONFIG",
                            "MANAGE_DEVICES", "VIEW_DEVICE_STATUS",
                            "VIEW_ZONE_SUMMARY",
                            "GENERATE_REPORT", "VIEW_ANALYTICS"
                        }),

                new RoleDef("ZONE_MANAGER",
                        "Thủ thư phụ trách 1 zone: xem data và cảnh báo của zone mình",
                        new String[]{
                            "READ_SENSOR_DATA", "READ_SENSOR_DETAIL",
                            "VIEW_ALERTS", "ACKNOWLEDGE_ALERT",
                            "VIEW_DEVICE_STATUS",
                            "VIEW_ZONE_SUMMARY",
                            "GENERATE_REPORT", "VIEW_ANALYTICS"
                        }),

                new RoleDef("MAINTENANCE",
                        "Kỹ thuật viên: xem + acknowledge cảnh báo, không xem raw data",
                        new String[]{
                            "READ_SENSOR_DATA",
                            "VIEW_ALERTS", "ACKNOWLEDGE_ALERT",
                            "VIEW_DEVICE_STATUS",
                            "VIEW_ZONE_SUMMARY",
                            "VIEW_ANALYTICS"
                        }),

                new RoleDef("VIEWER",
                        "Read-only: xem dashboard tóm tắt công khai",
                        new String[]{
                            "READ_SENSOR_DATA",
                            "VIEW_ALERTS",
                            "VIEW_ZONE_SUMMARY"
                        }),

                new RoleDef("USER",
                        "Người dùng web thông thường (backward compatibility)",
                        new String[]{}),

                new RoleDef("DEVICE",
                        "ESP32-S3 IoT Node: chỉ được ghi sensor data, không đọc",
                        new String[]{
                            "WRITE_SENSOR_DATA"
                        }),
            };

            for (RoleDef def : roleDefs) {
                Set<Permission> perms = permsOf.apply(def.permissions());
                Role role = roleRepository.findById(def.name())
                        .map(existing -> {
                            existing.setDescription(def.description());
                            Set<Permission> mergedPerms = new HashSet<>(perms);
                            if (existing.getPermissions() != null) {
                                mergedPerms.addAll(existing.getPermissions());
                            }
                            existing.setPermissions(mergedPerms);
                            return existing;
                        })
                        .orElseGet(() -> Role.builder()
                                .name(def.name())
                                .description(def.description())
                                .permissions(perms)
                                .build());
                roleRepository.save(role);
                log.info("Synchronized role: {} ({} permissions)", def.name(), role.getPermissions().size());
            }

            Role adminRole = roleRepository.findById("ADMIN")
                    .orElseThrow(() -> new RuntimeException("ADMIN role not found after seeding"));

            userRepository.findByUsername("admin").ifPresentOrElse(
                    adminUser -> {

                        adminUser.setRoles(new HashSet<>(Set.of(adminRole)));
                        userRepository.save(adminUser);
                        log.info("Synchronized admin user with updated ADMIN role & permissions");
                    },
                    () -> {
                        String configuredPassword = environment != null
                                ? environment.getProperty("app.security.initial-admin-password", "").trim()
                                : "";
                        if (configuredPassword.isEmpty()) {
                            String envVar = System.getenv("INITIAL_ADMIN_PASSWORD");
                            if (envVar != null && !envVar.trim().isEmpty()) {
                                configuredPassword = envVar.trim();
                            }
                        }

                        if (!configuredPassword.isEmpty()) {
                            User adminUser = User.builder()
                                    .username("admin")
                                    .password(passwordEncoder.encode(configuredPassword))
                                    .isActive(true)
                                    .roles(new HashSet<>(Set.of(adminRole)))
                                    .build();
                            userRepository.save(adminUser);
                            log.info("Admin account 'admin' initialized successfully via environment configuration.");
                        } else {
                            boolean isProduction = environment != null && Arrays.stream(environment.getActiveProfiles())
                                    .anyMatch(p -> p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));

                            if (isProduction) {
                                log.error("=================================================================================");
                                log.error(" [CRITICAL SECURITY VIOLATION] INITIAL_ADMIN_PASSWORD is required in production!");
                                log.error(" Application startup aborted to prevent unauthorized access.");
                                log.error("=================================================================================");
                                throw new IllegalStateException("CRITICAL SECURITY ERROR: INITIAL_ADMIN_PASSWORD must be configured in production profile!");
                            }

                            String generatedPassword = generateSecurePassword(16);
                            User adminUser = User.builder()
                                    .username("admin")
                                    .password(passwordEncoder.encode(generatedPassword))
                                    .isActive(true)
                                    .roles(new HashSet<>(Set.of(adminRole)))
                                    .build();
                            userRepository.save(adminUser);
                            boolean isDevOrLocal = environment != null && (
                                    environment.getActiveProfiles().length == 0 ||
                                    Arrays.stream(environment.getActiveProfiles())
                                            .anyMatch(p -> p.equalsIgnoreCase("dev") || p.equalsIgnoreCase("local") || p.equalsIgnoreCase("test"))
                            );
                            log.warn("================================================================================");
                            log.warn(" [SECURITY WARNING] No INITIAL_ADMIN_PASSWORD provided for local/dev environment!");
                            log.warn(" A temporary admin account has been created:");
                            log.warn("   Username: admin");
                            if (isDevOrLocal) {
                                log.warn("   Password: {}", generatedPassword);
                            } else {
                                log.warn("   Password generated dynamically. Set INITIAL_ADMIN_PASSWORD for permanent credentials.");
                            }
                            log.warn(" Please change this password immediately after login or set INITIAL_ADMIN_PASSWORD.");
                            log.warn("================================================================================");
                        }
                    }
            );
        };
    }

    private static final String UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final String LOWER = "abcdefghijklmnopqrstuvwxyz";
    private static final String DIGITS = "0123456789";
    private static final String SPECIAL = "!@#$%^&*-_=+";
    private static final String ALL_CHARS = UPPER + LOWER + DIGITS + SPECIAL;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private String generateSecurePassword(int length) {
        if (length < 16) {
            length = 16;
        }
        List<Character> chars = new ArrayList<>(length);
        chars.add(UPPER.charAt(SECURE_RANDOM.nextInt(UPPER.length())));
        chars.add(LOWER.charAt(SECURE_RANDOM.nextInt(LOWER.length())));
        chars.add(DIGITS.charAt(SECURE_RANDOM.nextInt(DIGITS.length())));
        chars.add(SPECIAL.charAt(SECURE_RANDOM.nextInt(SPECIAL.length())));

        for (int i = 4; i < length; i++) {
            chars.add(ALL_CHARS.charAt(SECURE_RANDOM.nextInt(ALL_CHARS.length())));
        }
        Collections.shuffle(chars, SECURE_RANDOM);

        StringBuilder sb = new StringBuilder(length);
        for (char c : chars) {
            sb.append(c);
        }
        return sb.toString();
    }
}
