package com.example.AIoTLibTQB.configuration;

import com.example.AIoTLibTQB.document.Role;
import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.repository.PermissionRepository;
import com.example.AIoTLibTQB.repository.RoleRepository;
import com.example.AIoTLibTQB.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApplicationInitConfigTest {

    @Mock
    PasswordEncoder passwordEncoder;

    @Mock
    UserRepository userRepository;

    @Mock
    RoleRepository roleRepository;

    @Mock
    PermissionRepository permissionRepository;

    @Mock
    Environment environment;

    @Captor
    ArgumentCaptor<User> userCaptor;

    @Captor
    ArgumentCaptor<String> passwordCaptor;

    ApplicationInitConfig applicationInitConfig;

    Role adminRole;

    @BeforeEach
    void setUp() {
        applicationInitConfig = new ApplicationInitConfig(
                passwordEncoder,
                userRepository,
                roleRepository,
                permissionRepository,
                environment
        );

        adminRole = Role.builder()
                .name("ADMIN")
                .description("System Administrator")
                .permissions(new HashSet<>())
                .build();

        lenient().when(roleRepository.findById("ADMIN")).thenReturn(Optional.of(adminRole));
        lenient().when(passwordEncoder.encode(anyString())).thenAnswer(invocation -> "encoded_" + invocation.getArgument(0));
    }

    @Nested
    @DisplayName("Admin Seeding Scenarios")
    class AdminSeedingTests {

        @Test
        @DisplayName("Case 1: Khởi tạo admin với mật khẩu được cấu hình từ environment variable")
        void initAdminUser_withEnvironmentPassword_success() throws Exception {
            when(environment.getProperty("app.security.initial-admin-password", "")).thenReturn("CustomSecretPassword123!");
            when(userRepository.findByUsername("admin")).thenReturn(Optional.empty());

            applicationInitConfig.applicationRunner().run(new DefaultApplicationArguments());

            verify(userRepository).save(userCaptor.capture());
            User savedUser = userCaptor.getValue();

            assertThat(savedUser.getUsername()).isEqualTo("admin");
            assertThat(savedUser.getPassword()).isEqualTo("encoded_CustomSecretPassword123!");
            assertThat(savedUser.isActive()).isTrue();
            assertThat(savedUser.getRoles()).extracting(Role::getName).containsExactly("ADMIN");

            verify(passwordEncoder).encode("CustomSecretPassword123!");
        }

        @Test
        @DisplayName("Case 2: Khởi tạo admin không có env var trên profile dev -> sinh ngẫu nhiên 16 ký tự an toàn")
        void initAdminUser_withoutEnvPassword_devProfile_generatesRandomSecurePassword() throws Exception {
            when(environment.getProperty("app.security.initial-admin-password", "")).thenReturn("");
            when(environment.getActiveProfiles()).thenReturn(new String[]{"dev"});
            when(userRepository.findByUsername("admin")).thenReturn(Optional.empty());

            applicationInitConfig.applicationRunner().run(new DefaultApplicationArguments());

            verify(passwordEncoder).encode(passwordCaptor.capture());
            String rawGeneratedPassword = passwordCaptor.getValue();

            assertThat(rawGeneratedPassword)
                    .isNotBlank()
                    .hasSize(16)
                    .isNotEqualTo("admin");

            // Kiểm tra mật khẩu ngẫu nhiên chứa đầy đủ chữ hoa, chữ thường, số và ký tự đặc biệt
            assertThat(rawGeneratedPassword).matches(".*[A-Z].*");
            assertThat(rawGeneratedPassword).matches(".*[a-z].*");
            assertThat(rawGeneratedPassword).matches(".*[0-9].*");
            assertThat(rawGeneratedPassword).matches(".*[!@#$%^&*\\-_=+].*");

            verify(userRepository).save(userCaptor.capture());
            User savedUser = userCaptor.getValue();
            assertThat(savedUser.getUsername()).isEqualTo("admin");
            assertThat(savedUser.getPassword()).isEqualTo("encoded_" + rawGeneratedPassword);
        }

        @Test
        @DisplayName("Case 3: Chặn khởi động (Fail-fast) trên production nếu thiếu INITIAL_ADMIN_PASSWORD")
        void initAdminUser_withoutEnvPassword_prodProfile_throwsIllegalStateException() {
            when(environment.getProperty("app.security.initial-admin-password", "")).thenReturn("");
            when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});
            when(userRepository.findByUsername("admin")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> applicationInitConfig.applicationRunner().run(new DefaultApplicationArguments()))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("CRITICAL SECURITY ERROR")
                    .hasMessageContaining("INITIAL_ADMIN_PASSWORD must be configured in production profile");

            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        @DisplayName("Case 4: User admin đã tồn tại -> chỉ đồng bộ role, không ghi đè mật khẩu")
        void initAdminUser_existingAdmin_syncsRolesWithoutModifyingPassword() throws Exception {
            User existingAdmin = User.builder()
                    .username("admin")
                    .password("existing_encoded_hash")
                    .isActive(true)
                    .roles(new HashSet<>())
                    .build();

            when(userRepository.findByUsername("admin")).thenReturn(Optional.of(existingAdmin));

            applicationInitConfig.applicationRunner().run(new DefaultApplicationArguments());

            verify(userRepository).save(existingAdmin);
            assertThat(existingAdmin.getPassword()).isEqualTo("existing_encoded_hash");
            assertThat(existingAdmin.getRoles()).contains(adminRole);

            // passwordEncoder.encode không được gọi cho admin
            verify(passwordEncoder, never()).encode(anyString());
        }
    }
}
