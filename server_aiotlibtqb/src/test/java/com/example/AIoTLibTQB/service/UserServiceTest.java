package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Role;
import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.dto.request.PasswordChangeRequest;
import com.example.AIoTLibTQB.dto.request.UserCreationRequest;
import com.example.AIoTLibTQB.dto.request.UserStatusRequest;
import com.example.AIoTLibTQB.dto.request.UserUpdateRequest;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.dto.response.RoleResponse;
import com.example.AIoTLibTQB.dto.response.UserResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.mapper.UserMapper;
import com.example.AIoTLibTQB.repository.RoleRepository;
import com.example.AIoTLibTQB.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository  userRepository;
    @Spy  UserMapper      userMapper = Mappers.getMapper(UserMapper.class);
    @Mock PasswordEncoder passwordEncoder;
    @Mock RoleRepository  roleRepository;

    @InjectMocks UserService userService;

    private User buildUser(String id, String username, boolean isActive) {
        return User.builder()
                .id(id)
                .username(username)
                .password("encoded")
                .isActive(isActive)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .roles(new HashSet<>())
                .build();
    }

    private UserResponse buildUserResponse(String id, String username, boolean isActive) {
        return UserResponse.builder()
                .id(id)
                .username(username)
                .isActive(isActive)
                .roles(Set.of())
                .build();
    }

    private Role buildRole(String name) {
        return Role.builder().name(name).description("desc").permissions(new HashSet<>()).build();
    }

    @Nested
    @DisplayName("create()")
    class CreateTests {

        @Test
        @DisplayName("Tạo user thành công → trả về UserResponse")
        void create_success() {
            UserCreationRequest request = new UserCreationRequest("newuser", "password123", null, null);
            User newUser = buildUser("id-001", "newuser", true);
            UserResponse expected = buildUserResponse("id-001", "newuser", true);
            Role userRole = buildRole("USER");

            when(userRepository.existsByUsername("newuser")).thenReturn(false);
            when(userMapper.toUser(request)).thenReturn(newUser);
            when(passwordEncoder.encode(anyString())).thenReturn("encoded");
            when(roleRepository.findById("USER")).thenReturn(Optional.of(userRole));
            when(userRepository.save(any(User.class))).thenReturn(newUser);
            when(userMapper.toUserResponse(newUser)).thenReturn(expected);

            UserResponse result = userService.create(request);

            assertThat(result.getUsername()).isEqualTo("newuser");
            assertThat(result.isActive()).isTrue();
            verify(userRepository).save(any(User.class));
        }

        @Test
        @DisplayName("Username đã tồn tại → USER_EXISTED")
        void create_duplicateUsername_throwsException() {
            when(userRepository.existsByUsername("existed")).thenReturn(true);
            UserCreationRequest request = new UserCreationRequest("existed", "pass12345", null, null);

            assertThatThrownBy(() -> userService.create(request))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.USER_EXISTED);

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("Role USER không tồn tại trong DB → ROLE_NOT_EXISTED")
        void create_defaultRoleMissing_throwsException() {
            UserCreationRequest request = new UserCreationRequest("newuser", "pass12345", null, null);
            User newUser = buildUser("id-001", "newuser", true);

            when(userRepository.existsByUsername("newuser")).thenReturn(false);
            when(userMapper.toUser(request)).thenReturn(newUser);
            when(passwordEncoder.encode(anyString())).thenReturn("encoded");
            when(roleRepository.findById("USER")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.create(request))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.ROLE_NOT_EXISTED);
        }
    }

    @Nested
    @DisplayName("getMyInfo()")
    class GetMyInfoTests {

        @Test
        @DisplayName("User tồn tại trong SecurityContext → trả về thông tin")
        void getMyInfo_success() {
            User user = buildUser("id-001", "alice", true);
            UserResponse expected = buildUserResponse("id-001", "alice", true);

            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            when(ctx.getAuthentication()).thenReturn(auth);
            when(auth.getName()).thenReturn("alice");

            try (MockedStatic<SecurityContextHolder> holder =
                         mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);
                when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
                when(userMapper.toUserResponse(user)).thenReturn(expected);

                UserResponse result = userService.getMyInfo();

                assertThat(result.getUsername()).isEqualTo("alice");
            }
        }

        @Test
        @DisplayName("User bị xóa khỏi DB trong khi đang login → USER_DID_NOT_EXIST")
        void getMyInfo_userDeletedFromDB_throwsException() {
            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            when(ctx.getAuthentication()).thenReturn(auth);
            when(auth.getName()).thenReturn("ghost");

            try (MockedStatic<SecurityContextHolder> holder =
                         mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);
                when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

                assertThatThrownBy(() -> userService.getMyInfo())
                        .isInstanceOf(AppException.class)
                        .extracting(e -> ((AppException) e).getErrorCode())
                        .isEqualTo(ErrorCode.USER_DID_NOT_EXIST);
            }
        }
    }

    @Nested
    @DisplayName("getAll() — phân trang")
    class GetAllTests {

        @Test
        @DisplayName("Trả về PageResponse đúng metadata và content")
        void getAll_returnsPaginatedResult() {
            User user1 = buildUser("id-001", "alice", true);
            User user2 = buildUser("id-002", "bob",   true);
            List<User> userList = List.of(user1, user2);

            Pageable pageable = PageRequest.of(0, 10);
            Page<User> page = new PageImpl<>(userList, pageable, 2);

            UserResponse r1 = buildUserResponse("id-001", "alice", true);
            UserResponse r2 = buildUserResponse("id-002", "bob",   true);

            when(userRepository.findAll(pageable)).thenReturn(page);
            when(userMapper.toUserResponses(userList)).thenReturn(List.of(r1, r2));

            PageResponse<UserResponse> result = userService.getAll(pageable);

            assertThat(result.getContent()).hasSize(2);
            assertThat(result.getTotalElements()).isEqualTo(2);
            assertThat(result.getTotalPages()).isEqualTo(1);
            assertThat(result.getPage()).isEqualTo(0);
            assertThat(result.getSize()).isEqualTo(10);
            assertThat(result.isLast()).isTrue();
        }

        @Test
        @DisplayName("Không có user nào → content rỗng")
        void getAll_empty_returnsEmptyContent() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<User> emptyPage = new PageImpl<>(List.of(), pageable, 0);

            when(userRepository.findAll(pageable)).thenReturn(emptyPage);
            when(userMapper.toUserResponses(List.of())).thenReturn(List.of());

            PageResponse<UserResponse> result = userService.getAll(pageable);

            assertThat(result.getContent()).isEmpty();
            assertThat(result.getTotalElements()).isZero();
        }
    }

    @Nested
    @DisplayName("getByID()")
    class GetByIdTests {

        @Test
        @DisplayName("ID tồn tại → trả về user")
        void getById_found() {
            User user = buildUser("id-001", "alice", true);
            UserResponse expected = buildUserResponse("id-001", "alice", true);

            when(userRepository.findById("id-001")).thenReturn(Optional.of(user));
            when(userMapper.toUserResponse(user)).thenReturn(expected);

            UserResponse result = userService.getByID("id-001");

            assertThat(result.getId()).isEqualTo("id-001");
        }

        @Test
        @DisplayName("ID không tồn tại → USER_DID_NOT_EXIST")
        void getById_notFound_throwsException() {
            when(userRepository.findById("bad-id")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.getByID("bad-id"))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.USER_DID_NOT_EXIST);
        }
    }

    @Nested
    @DisplayName("toggleStatus()")
    class ToggleStatusTests {

        @Test
        @DisplayName("Vô hiệu hóa tài khoản → isActive = false trong response")
        void toggleStatus_disable_success() {
            User user = buildUser("id-001", "alice", true);
            UserStatusRequest request = new UserStatusRequest(false);
            UserResponse expected = buildUserResponse("id-001", "alice", false);

            when(userRepository.findById("id-001")).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenReturn(user);
            when(userMapper.toUserResponse(any(User.class))).thenReturn(expected);

            UserResponse result = userService.toggleStatus("id-001", request);

            assertThat(result.isActive()).isFalse();

            verify(userRepository).save(argThat(u -> !u.isActive()));
        }

        @Test
        @DisplayName("Kích hoạt lại tài khoản → isActive = true trong response")
        void toggleStatus_enable_success() {
            User user = buildUser("id-001", "alice", false);
            UserStatusRequest request = new UserStatusRequest(true);
            UserResponse expected = buildUserResponse("id-001", "alice", true);

            when(userRepository.findById("id-001")).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenReturn(user);
            when(userMapper.toUserResponse(any(User.class))).thenReturn(expected);

            UserResponse result = userService.toggleStatus("id-001", request);

            assertThat(result.isActive()).isTrue();
            verify(userRepository).save(argThat(User::isActive));
        }

        @Test
        @DisplayName("User không tồn tại → USER_DID_NOT_EXIST")
        void toggleStatus_userNotFound_throwsException() {
            when(userRepository.findById("bad-id")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.toggleStatus("bad-id", new UserStatusRequest(false)))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.USER_DID_NOT_EXIST);
        }
    }

    @Nested
    @DisplayName("deleteById()")
    class DeleteTests {

        @Test
        @DisplayName("Xóa user → gọi repository.deleteById đúng 1 lần")
        void deleteById_callsRepository() {
            userService.deleteById("id-001");
            verify(userRepository, times(1)).deleteById("id-001");
        }
    }

    @Nested
    @DisplayName("update()")
    class UpdateTests {

        @Test
        @DisplayName("User thường update profile: roles và assignedZones bị bỏ qua")
        void update_nonAdmin_ignoresRolesAndAssignedZones() {
            User user = buildUser("id-001", "alice", true);
            UserUpdateRequest request = UserUpdateRequest.builder()
                    .phone("0987654321")
                    .email("alice@new.com")
                    .roles(List.of("ADMIN"))
                    .assignedZones(Set.of("P411"))
                    .build();

            UserResponse expected = buildUserResponse("id-001", "alice", true);

            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            doReturn(List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("USER"))).when(auth).getAuthorities();
            when(auth.getName()).thenReturn("alice");
            when(ctx.getAuthentication()).thenReturn(auth);

            try (MockedStatic<SecurityContextHolder> holder = mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);

                when(userRepository.findById("id-001")).thenReturn(Optional.of(user));
                when(userRepository.save(any(User.class))).thenReturn(user);
                when(userMapper.toUserResponse(user)).thenReturn(expected);

                UserResponse result = userService.update(request, "id-001");

                assertThat(result).isNotNull();
                verify(userMapper).updateUser(user, request);
                verify(roleRepository, never()).findAllById(any());
                assertThat(user.getRoles()).isEmpty();
                assertThat(user.getAssignedZones()).isEmpty();
            }
        }

        @Test
        @DisplayName("Admin update user: được phép cập nhật roles và assignedZones")
        void update_admin_updatesRolesAndAssignedZones() {
            User user = buildUser("id-001", "bob", true);
            Role adminRole = buildRole("ADMIN");
            UserUpdateRequest request = UserUpdateRequest.builder()
                    .roles(List.of("ADMIN"))
                    .assignedZones(Set.of("P111", "P411"))
                    .build();

            UserResponse expected = buildUserResponse("id-001", "bob", true);

            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            doReturn(List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ADMIN"))).when(auth).getAuthorities();
            when(ctx.getAuthentication()).thenReturn(auth);

            try (MockedStatic<SecurityContextHolder> holder = mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);

                when(userRepository.findById("id-001")).thenReturn(Optional.of(user));
                when(roleRepository.findAllById(List.of("ADMIN"))).thenReturn(List.of(adminRole));
                when(userRepository.save(any(User.class))).thenReturn(user);
                when(userMapper.toUserResponse(user)).thenReturn(expected);

                UserResponse result = userService.update(request, "id-001");

                assertThat(result).isNotNull();
                verify(roleRepository).findAllById(List.of("ADMIN"));
                assertThat(user.getRoles()).contains(adminRole);
                assertThat(user.getAssignedZones()).containsExactlyInAnyOrder("P111", "P411");
            }
        }

        @Test
        @DisplayName("User thường update tài khoản của người khác → UNAUTHORIZED và KHÔNG lưu vào DB")
        void update_nonAdminUpdatingOtherUser_throwsUnauthorizedBeforeSave() {
            User targetUser = buildUser("id-002", "bob", true);
            UserUpdateRequest request = UserUpdateRequest.builder()
                    .password("hacked12345")
                    .phone("0900000000")
                    .build();

            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            doReturn(List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("USER"))).when(auth).getAuthorities();
            when(auth.getName()).thenReturn("alice");
            when(ctx.getAuthentication()).thenReturn(auth);

            try (MockedStatic<SecurityContextHolder> holder = mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);
                when(userRepository.findById("id-002")).thenReturn(Optional.of(targetUser));

                assertThatThrownBy(() -> userService.update(request, "id-002"))
                        .isInstanceOf(AppException.class)
                        .extracting(e -> ((AppException) e).getErrorCode())
                        .isEqualTo(ErrorCode.UNAUTHORIZED);

                verify(userMapper, never()).updateUser(any(), any());
                verify(userRepository, never()).save(any());
            }
        }
    }

    @Nested
    @DisplayName("changePassword Tests")
    class ChangePasswordTests {

        @Test
        @DisplayName("Đổi mật khẩu thành công khi cung cấp đúng mật khẩu cũ")
        void changePassword_success() {
            User user = buildUser("id-001", "alice", true);
            user.setPassword("encoded_old");
            PasswordChangeRequest request = PasswordChangeRequest.builder()
                    .oldPassword("OldSecret123!")
                    .newPassword("NewSecret123!")
                    .build();

            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            when(auth.getName()).thenReturn("alice");
            when(ctx.getAuthentication()).thenReturn(auth);

            try (MockedStatic<SecurityContextHolder> holder = mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);
                when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
                when(passwordEncoder.matches("OldSecret123!", "encoded_old")).thenReturn(true);
                when(passwordEncoder.encode("NewSecret123!")).thenReturn("encoded_new");

                userService.changePassword(request);

                assertThat(user.getPassword()).isEqualTo("encoded_new");
                verify(userRepository).save(user);
            }
        }

        @Test
        @DisplayName("Sai mật khẩu cũ → ném OLD_PASSWORD_INCORRECT (1011)")
        void changePassword_wrongOldPassword_throwsAppException() {
            User user = buildUser("id-001", "alice", true);
            user.setPassword("encoded_old");
            PasswordChangeRequest request = PasswordChangeRequest.builder()
                    .oldPassword("WrongSecret123!")
                    .newPassword("NewSecret123!")
                    .build();

            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            when(auth.getName()).thenReturn("alice");
            when(ctx.getAuthentication()).thenReturn(auth);

            try (MockedStatic<SecurityContextHolder> holder = mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);
                when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
                when(passwordEncoder.matches("WrongSecret123!", "encoded_old")).thenReturn(false);

                assertThatThrownBy(() -> userService.changePassword(request))
                        .isInstanceOf(AppException.class)
                        .extracting(e -> ((AppException) e).getErrorCode())
                        .isEqualTo(ErrorCode.OLD_PASSWORD_INCORRECT);

                verify(passwordEncoder, never()).encode(anyString());
                verify(userRepository, never()).save(any());
            }
        }

        @Test
        @DisplayName("Mật khẩu mới trùng mật khẩu cũ → ném PASSWORD_SAME_AS_OLD (1012)")
        void changePassword_samePassword_throwsAppException() {
            User user = buildUser("id-001", "alice", true);
            user.setPassword("encoded_old");
            PasswordChangeRequest request = PasswordChangeRequest.builder()
                    .oldPassword("SameSecret123!")
                    .newPassword("SameSecret123!")
                    .build();

            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            when(auth.getName()).thenReturn("alice");
            when(ctx.getAuthentication()).thenReturn(auth);

            try (MockedStatic<SecurityContextHolder> holder = mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);
                when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
                when(passwordEncoder.matches("SameSecret123!", "encoded_old")).thenReturn(true);

                assertThatThrownBy(() -> userService.changePassword(request))
                        .isInstanceOf(AppException.class)
                        .extracting(e -> ((AppException) e).getErrorCode())
                        .isEqualTo(ErrorCode.PASSWORD_SAME_AS_OLD);

                verify(passwordEncoder, never()).encode(anyString());
                verify(userRepository, never()).save(any());
            }
        }
    }
}
