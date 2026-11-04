# QUY ƯỚC KỸ THUẬT VÀ MẪU THIẾT KẾ BẮT BUỘC (AIoTLibTQB)

> **Tài liệu**: `docs/10-conventions.md`  
> **Dự án**: AIoTLibTQB — Hệ thống Giám sát Vi khí hậu & Âm học Thông minh Thư viện Tạ Quang Bửu  
> **Phiên bản**: 2.0 (Toàn diện & Đã kiểm chứng thực địa mã nguồn)  
> **Nguyên tắc kỹ thuật**: Mã nguồn thực tế là nguồn sự thật tối thượng (*Code is the Single Source of Truth*). Mọi quy ước lập trình, mẫu đối chiếu Đúng (Good) / Sai (Bad), và giải thích kỹ thuật đều được trích xuất từ các mẫu chuẩn đang vận hành trong dự án.

---

## 1. MỤC TIÊU

Tài liệu này đóng vai trò là "Sách Quy Chuẩn Kỹ Thuật" (Engineering Style Guide & Architectural Invariants) bắt buộc áp dụng cho toàn bộ các thành viên tham gia phát triển và bảo trì hệ sinh thái AIoTLibTQB:
1. **Thiết lập Các Tiêu Chuẩn Bất Biến (Architectural Invariants)**: Đưa ra các nguyên tắc lập trình bất di bất dịch về an toàn Virtual Threads, xử lý chuỗi thời gian TimeSeries, đồng bộ luồng phi khóa và quản lý bí mật hệ thống.
2. **Minh họa Trực quan Đúng (Good) / Sai (Bad)**: Cung cấp các đoạn mã nguồn đối chiếu thực tế kèm giải thích sâu sắc về hậu quả kỹ thuật (Carrier thread pinning, Memory leak, Write amplification, SQL/NoSQL injection).
3. **Đảm bảo Tính Đồng nhất của Codebase**: Chuẩn hóa phong cách viết REST Controller, đóng gói vỏ bọc `ApiResponse<T>`, phân trang an toàn `PageResponse<T>`, và cơ chế bắt lỗi tập trung qua `GlobalExceptionHandler`.
4. **Hướng dẫn Kiểm toán Mã Nguồn (Code Review Guide)**: Cung cấp danh mục kiểm tra (Checklist) cho các Tech Lead và Senior Reviewer khi duyệt Pull Request (PR).

---

## 2. ĐỐI TƯỢNG ĐỌC

Tài liệu này được biên soạn cho:
- **Kỹ sư Backend (Java 21 & Spring Boot 3.5.8)**: Tuân thủ nghiêm ngặt trong mọi dòng code viết mới hoặc refactor.
- **Kiến trúc sư Phần mềm & Tech Leads**: Dùng làm tiêu chí nghiệm thu chất lượng mã nguồn (Acceptance Criteria) trong các đợt Review PR.
- **Kỹ sư DevOps / SRE**: Hiểu các cơ chế bảo vệ máy chủ (Semaphore limit, Throttling cache, Zero-DB-overhead recovery) để thiết lập cấu hình container và giám sát tài nguyên phù hợp.
- **Kỹ sư Mới Gia Nhập (Onboarding Engineers)**: Đọc hiểu ngay lập tức "văn hóa code" của dự án để tránh mắc các lỗi kinh điển khi tiếp cận hệ thống hiệu năng cao.

---

## 3. NỘI DUNG CHI TIẾT

---

### 3.1. Quy Ước 1: An Toàn Với Luồng Ảo (Virtual Threads Safety - Project Loom)

#### A. Nguyên lý & Cơ chế Hoạt động
Java 21 giới thiệu Luồng ảo (Virtual Threads - Project Loom) với chi phí tạo và chuyển ngữ cảnh cực kỳ thấp. Tuy nhiên, luồng ảo chỉ phát huy hiệu năng tối đa khi chúng có thể "nhả" (unmount) khỏi Luồng nền tảng hệ điều hành (Carrier Thread / Platform Thread) khi gặp các thao tác I/O chặn (Blocking I/O như truy vấn CSDL, gọi mạng).

**Hiện tượng Ghim Luồng (Carrier Thread Pinning)**:
Khi một luồng ảo bước vào một khối `synchronized` hoặc phương thức `synchronized`, máy ảo JVM sẽ **ghim chặt (pin)** luồng ảo đó vào Carrier Thread hiện tại. Nếu bên trong khối `synchronized` xảy ra thao tác I/O chặn (chờ MongoDB ghi đĩa, chờ gửi gói STOMP), Carrier Thread bên dưới sẽ bị phong tỏa hoàn toàn. Khi hàng trăm luồng ảo bị pin đồng thời, toàn bộ Platform Thread Pool của JVM bị cạn kiệt, hệ thống rơi vào trạng thái tê liệt (Deadlock/Starvation).

#### B. Quy tắc Bắt buộc trong Dự án
1. **Tuyệt đối KHÔNG sử dụng từ khóa `synchronized`**: Trong toàn bộ codebase của AIoTLibTQB, tần suất xuất hiện của từ khóa `synchronized` là **0%**.
2. **Sử dụng cấu trúc dữ liệu Non-blocking**: Dùng `ConcurrentHashMap`, `ConcurrentLinkedQueue`, `AtomicReference`, hoặc `Semaphore(30, true)` công bằng thay thế cho khóa độc quyền.
3. **Đưa thao tác I/O ra ngoài khối tính toán Map**: Khi sử dụng `ConcurrentHashMap.compute()`, tuyệt đối chỉ thực hiện các phép gán biến hoặc tính toán trạng thái trong RAM; toàn bộ các thao tác ghi CSDL (`repository.save()`) và gửi mạng (`realtimePublisher.publish()`) phải được thực hiện **sau khi** khối `compute()` đã hoàn tất.

#### C. Minh họa Đúng / Sai Thực Tế
*Minh chứng mã nguồn thực tế*: `src/main/java/com/example/AIoTLibTQB/service/AlertRuleEngine.java:258`.

❌ **SAI (BAD) — Dùng `synchronized` hoặc thực hiện I/O chặn trong khối `compute()`**:
```java
// BAD: Gây Carrier Thread Pinning nghiêm trọng cho Virtual Threads
public class BadAlertService {
    private final Map<String, FsmState> stateMap = new HashMap<>();

    // NGUY HIỂM: synchronized method ghim Carrier Thread
    public synchronized void processAlert(String deviceId, double value) {
        if (value > threshold) {
            // NGUY HIỂM: Thao tác I/O chặn bên trong synchronized
            Alert alert = alertRepository.save(new Alert(...)); 
            realtimePublisher.send(alert); 
        }
    }

    // NGUY HIỂM: Gọi repository.save() bên trong compute() của ConcurrentHashMap
    public void processWithMap(String key) {
        concurrentMap.compute(key, (k, state) -> {
            // Thao tác I/O này sẽ giữ bucket lock của ConcurrentHashMap, 
            // pin carrier thread nếu thread hiện tại là Virtual Thread!
            alertRepository.save(new Alert(...));
            return state;
        });
    }
}
```

✅ **ĐÚNG (GOOD) — Chuẩn mã nguồn AIoTLibTQB (`AlertRuleEngine.java:258-275`)**:
```java
// GOOD: Tách biệt tính toán trạng thái in-memory và I/O chặn
final boolean[] shouldFire = {false};
final Alert[] alertToSave = {null};
final String[] resolveAlertId = {null};

// Bước 1: Tính toán thuần túy trong RAM (nhanh, microsecond, không block I/O)
fsmMap.compute(key, (k, state) -> {
    if (state == null) {
        state = new FsmState(...);
    }
    if (conditionMet) {
        shouldFire[0] = true;
        alertToSave[0] = Alert.builder().currentValue(currentValue).build();
        state.setStatus(AlertStatus.FIRING);
    }
    return state;
});

// Bước 2: Thực hiện I/O chặn HOÀN TOÀN BÊN NGOÀI compute()
// Virtual thread có thể unmount an toàn tại đây mà không giữ bất kỳ bucket lock nào!
if (shouldFire[0] && alertToSave[0] != null) {
    Alert savedAlert = alertRepository.save(alertToSave[0]); // Blocking MongoDB write
    realtimePublisher.publishAlert(toAlertResponse(savedAlert)); // Blocking WebSocket publish
    log.info("Alert FSM transitioned to FIRING: key={}, alertId={}", key, savedAlert.getId());
}
```

---

### 3.2. Quy Ước 2: Xử Lý Dữ Liệu Chuỗi Thời Gian (TimeSeries Data Handling)

#### A. Nguyên lý CSDL MongoDB TimeSeries
MongoDB 8.0 tối ưu hóa collection TimeSeries (`telemetry_records`) bằng cách tổ chức các bản ghi cảm biến thành các **buckets nén nội bộ (compressed columnar buckets)**. 
- Mỗi bucket gom nhóm dữ liệu theo `metaField` (`metadata.deviceId`, `metadata.roomId`) trong một khoảng thời gian theo `granularity: Granularity.SECONDS`.
- Khi chèn dữ liệu tuần tự (Append-only Insert), MongoDB nén dữ liệu cực kỳ hiệu quả, tiết kiệm tới 80% dung lượng đĩa và tăng tốc độ đọc.

#### B. Quy tắc Bắt buộc trong Dự án
1. **Tuyệt đối KHÔNG thực hiện cập nhật đơn lẻ (`$set`)**: Không bao giờ gọi `updateOne`, `updateMany` hoặc tìm kiếm sửa đổi từng điểm đo trên collection TimeSeries. Việc cập nhật làm vỡ cấu trúc nén của bucket, khiến MongoDB phải giải nén toàn bộ bucket, ghi đè và nén lại (hiện tượng Write Amplification kinh hoàng).
2. **Khai thác qua Aggregation Pipeline & `$dateTrunc`**: Mọi truy vấn lịch sử hoặc vẽ biểu đồ bắt buộc phải sử dụng Aggregation Pipeline kết hợp toán tử `$dateTrunc` để nén điểm dữ liệu thành các buckets thời gian (`15m`, `1h`, `1d`).
3. **Kiểm soát Giới Hạn Tải Bucket**: Chặn đứng mọi truy vấn sinh ra quá **1000 buckets** để bảo vệ bộ nhớ RAM của máy chủ CSDL.

#### C. Minh họa Đúng / Sai Thực Tế
*Minh chứng mã nguồn thực tế*: `src/main/java/com/example/AIoTLibTQB/service/TelemetryService.java:146-183`.

❌ **SAI (BAD) — Update điểm đo TimeSeries hoặc truy vấn quét bảng khổng lồ**:
```java
// BAD: Update đơn lẻ làm hỏng cấu trúc bucket của MongoDB TimeSeries
public void updateTelemetryScore(String recordId, double newScore) {
    Query query = new Query(Criteria.where("id").is(recordId));
    Update update = new Update().set("comfortScore.overall", newScore);
    mongoTemplate.updateFirst(query, update, TelemetryRecord.class); // CẤM!
}

// BAD: Truy vấn lấy hàng triệu bản ghi thô về Java rồi dùng Stream để tính trung bình
public List<TelemetryRecord> getHistoryRaw(String roomId, Instant start, Instant end) {
    // Kéo 100,000 bản ghi thô qua mạng làm tràn RAM máy chủ backend (OOM Crash)!
    return telemetryRepository.findByRoomIdAndTimestampBetween(roomId, start, end);
}
```

✅ **ĐÚNG (GOOD) — Chuẩn mã nguồn AIoTLibTQB (`TelemetryService.java:146-183`)**:
```java
// GOOD: Downsampling bằng Aggregation Pipeline với toán tử $dateTrunc ngay trong MongoDB engine
public Aggregation buildBucketAggregation(String roomId, IntervalConfig config, Instant start, Instant end) {
    // 1. Lọc bản ghi bằng index compound {'metadata.roomId': 1, 'timestamp': -1}
    MatchOperation matchStage = Aggregation.match(
            Criteria.where("metadata.roomId").is(roomId)
                    .and("timestamp").gte(start).lte(end)
    );

    // 2. Gom nhóm theo mốc thời gian chuẩn hóa ($dateTrunc)
    Document dateTrunc = new Document("$dateTrunc",
            new Document("date", "$timestamp")
                    .append("unit", config.unit())       // "minute", "hour", "day"
                    .append("binSize", config.binSize()) // 15 hoặc 1
    );

    Document groupFields = new Document("_id", dateTrunc)
            .append("comfortScoreAvg", new Document("$avg", "$comfortScore.overall"))
            .append("comfortScoreMin", new Document("$min", "$comfortScore.overall"))
            .append("comfortScoreMax", new Document("$max", "$comfortScore.overall"))
            .append("tempAvg", new Document("$avg", "$environment.temperature"))
            .append("humidityAvg", new Document("$avg", "$environment.humidity"))
            .append("noiseAvg", new Document("$avg", "$acoustics.noiseAvg"))
            .append("pm25Avg", new Document("$airQuality.pm2_5"))
            .append("sampleCount", new Document("$sum", 1));

    AggregationOperation groupStage = context -> new Document("$group", groupFields);
    AggregationOperation sortStage = context -> new Document("$sort", new Document("_id", 1));

    return Aggregation.newAggregation(matchStage, groupStage, sortStage);
}
```

---

### 3.3. Quy Ước 3: Đồng Bộ Luồng & Kiểm Soát Tải (Concurrency & Rate Control)

#### A. Nguyên lý Kiểm soát Tải Ghi
Khi hàng trăm thiết bị IoT gửi dữ liệu đồng thời qua giao thức MQTT với chu kỳ 5–10 giây, việc mỗi thông điệp mở một luồng ghi trực tiếp vào MongoDB mà không giới hạn sẽ khiến Connection Pool của MongoDB bị kiệt quệ, gây nghẽn hàng đợi (Connection Pool Starvation) và tăng đột biến độ trễ (Latency Spike).

#### B. Quy tắc Bắt buộc trong Dự án
1. **Kiểm soát Tải Ghi bằng Semaphore Công Bằng (`Semaphore(30, true)`)**: Mọi thao tác ghi telemetry vào CSDL bắt buộc phải xin giấy phép (permit) từ Semaphore với hạn ngạch 30 luồng đồng thời và thời gian chờ tối đa 3000ms.
2. **Throttling In-Memory Tránh Write Amplification**: Thông tin nhịp tim `lastSeenAt` không được ghi đĩa liên tục mỗi giây mà phải qua bộ đệm Caffeine Cache cửa sổ 30 giây.
3. **Phục Hồi Trạng Thái Không Tốn Truy Vấn CSDL (Zero DB Hit Recovery)**: Danh sách thiết bị ngoại tuyến được lưu trong RAM qua `ConcurrentHashMap.newKeySet()`. Khi nhận dữ liệu từ node đang online bình thường, hệ thống trả về ngay lập tức với **0 truy vấn CSDL**.

#### C. Minh họa Đúng / Sai Thực Tế
*Minh chứng mã nguồn thực tế*: `src/main/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherService.java:70-80, 269-301`.

❌ **SAI (BAD) — Ghi CSDL vô tội vạ hoặc khóa luồng bằng lock độc quyền**:
```java
// BAD: Không kiểm soát tải, mỗi bản tin MQTT gọi save() trực tiếp làm sập Connection Pool
public void onMqttMessage(String hardwareId, TelemetryPayload payload) {
    // Khi có 1,000 packets/giây, MongoDB pool (thường 100 connections) sẽ cạn kiệt!
    telemetryRepository.save(toRecord(payload)); 
    
    // BAD: Mỗi giây cập nhật lastSeenAt vào MongoDB làm tăng IOPS đĩa không cần thiết
    deviceRepository.updateLastSeen(hardwareId, Instant.now());
}
```

✅ **ĐÚNG (GOOD) — Chuẩn mã nguồn AIoTLibTQB (`MqttMessageDispatcherService.java`)**:
```java
// GOOD: Điều tiết tải bằng Semaphore công bằng + Caffeine Throttling
private static final int MONGO_WRITE_PERMITS = 30;
private static final long MONGO_ACQUIRE_TIMEOUT_MS = 3000;

final Semaphore mongoWriteSemaphore = new Semaphore(MONGO_WRITE_PERMITS, true);

Cache<String, Instant> lastSeenThrottleCache = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofSeconds(30))
        .maximumSize(10_000)
        .build();

public void handleTelemetryMessage(...) {
    // 1. Throttling ghi lastSeenAt qua Caffeine Cache
    if (lastSeenThrottleCache.getIfPresent(hardwareId) == null) {
        lastSeenThrottleCache.put(hardwareId, timestamp);
        deviceRepository.updateLastSeen(device.getId(), timestamp);
    }

    // 2. Bảo vệ MongoDB bằng Semaphore có timeout
    boolean acquired = false;
    try {
        acquired = mongoWriteSemaphore.tryAcquire(MONGO_ACQUIRE_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        if (!acquired) {
            log.warn("MongoDB write throttled: semaphore timeout for hardwareId={}", hardwareId);
            return; // Thả bỏ gói tin an toàn khi CSDL bị nghẽn
        }
        telemetryRepository.save(record);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        log.warn("Interrupted waiting for semaphore: {}", e.getMessage());
    } finally {
        if (acquired) {
            mongoWriteSemaphore.release(); // Luôn giải phóng trong khối finally
        }
    }
}
```

---

### 3.4. Quy Ước 4: Quản Lý Bí Mật, Khóa & Thông Tin Xác Thực (Secrets & Credentials)

#### A. Nguyên tắc Bảo mật Tuyệt đối
Tuyệt đối không được phép xuất hiện bất kỳ thông tin nhạy cảm nào (Mật khẩu tài khoản, Private Key, JWT Secret Key, Chuỗi kết nối MongoDB chứa credentials) dưới dạng chuỗi cứng (Hardcoded String) trong mã nguồn, tập tin cấu hình Git, hoặc Dockerfile.

#### B. Quy tắc Bắt buộc trong Dự án
1. **Nạp Secrets từ Biến Môi Trường (Environment Variables)**: Toàn bộ thông số bảo mật phải sử dụng cú pháp placeholder Spring `${ENV_VAR_NAME}`.
2. **Thuật toán Băm Mật Khẩu & API Key**:
   - Mật khẩu người dùng: Băm bằng **`BCryptPasswordEncoder(10)`** (`SecurityConfig.java:89`).
   - Khóa API thiết bị: Băm bằng **`BCryptPasswordEncoder(10)`** (`DeviceService.java:328`).
   - Mật khẩu Mosquitto Broker: Sử dụng định dạng chuẩn PBKDF2/SHA512 qua `mosquitto_passwd`.
3. **Cơ chế Fallback An toàn Khi Khởi Động (Startup Fail-Safe)**:
   - Trên môi trường production (`prod` / `production`), ứng dụng bắt buộc phải có biến `INITIAL_ADMIN_PASSWORD`. Nếu thiếu, ứng dụng phải **ngay lập tức dừng khởi động (abort)** và ném `IllegalStateException` để ngăn ngừa lỗ hổng bảo mật do mật khẩu mặc định gây ra.

#### C. Minh họa Đúng / Sai Thực Tế
*Minh chứng mã nguồn thực tế*: `src/main/java/com/example/AIoTLibTQB/configuration/ApplicationInitConfig.java:214-223`.

❌ **SAI (BAD) — Hardcode mật khẩu hoặc secret key trong mã nguồn**:
```java
// BAD: Lỗ hổng an ninh nghiêm trọng - Hardcode secret key và mật khẩu
public class BadSecurityConfig {
    // CẤM: Hardcode secret key trong Java code!
    private String jwtSecret = "MySuperSecretKeyForJWT12345678901234567890";

    // CẤM: Khởi tạo mật khẩu admin cố định trong mã nguồn
    public void initAdmin() {
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword(passwordEncoder.encode("admin123")); // NGUY HIỂM!
        userRepository.save(admin);
    }
}
```

✅ **ĐÚNG (GOOD) — Chuẩn mã nguồn AIoTLibTQB (`ApplicationInitConfig.java`)**:
```java
// GOOD: Kiểm soát an ninh theo môi trường và nạp biến môi trường an toàn
String configuredPassword = environment.getProperty("app.security.initial-admin-password", "").trim();
if (configuredPassword.isEmpty()) {
    String envVar = System.getenv("INITIAL_ADMIN_PASSWORD");
    if (envVar != null && !envVar.trim().isEmpty()) {
        configuredPassword = envVar.trim();
    }
}

boolean isProduction = Arrays.stream(environment.getActiveProfiles())
        .anyMatch(p -> p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));

if (configuredPassword.isEmpty() && isProduction) {
    log.error("[CRITICAL SECURITY VIOLATION] INITIAL_ADMIN_PASSWORD is required in production!");
    // Dừng khởi động ngay lập tức để bảo vệ hệ thống
    throw new IllegalStateException("CRITICAL SECURITY ERROR: INITIAL_ADMIN_PASSWORD must be configured in production profile!");
}

if (!configuredPassword.isEmpty()) {
    User adminUser = User.builder()
            .username("admin")
            .password(passwordEncoder.encode(configuredPassword)) // Băm BCrypt 10 rounds
            .isActive(true)
            .roles(Set.of(adminRole))
            .build();
    userRepository.save(adminUser);
}
```

---

### 3.5. Quy Ước 5: Hợp Đồng Giao Tiếp API & Bọc Vỏ Chuẩn (API Envelope & Error Contract)

#### A. Nguyên lý Thống nhất Giao tiếp
Trong kiến trúc Frontend - Backend hiện đại, việc một số endpoint trả về POJO trực tiếp, một số endpoint trả về mảng, và khi lỗi trả về HTML mặc định của Tomcat hoặc Spring Boot sẽ khiến tầng client (Next.js / TanStack Query) cực kỳ khó xử lý và dễ sụp đổ giao diện (Runtime Exception).

#### B. Quy tắc Bắt buộc trong Dự án
1. **Luôn Bọc Phản Hồi trong `ApiResponse<T>`**: Tất cả các phương thức trong `@RestController` đều phải có kiểu trả về là `ApiResponse<T>`.
2. **Ném Ngoại Lệ Nghiệp Vụ Chuẩn Hóa**: Không bao giờ ném `RuntimeException` chung chung; mọi lỗi nghiệp vụ phải được ném thông qua `new AppException(ErrorCode.XXX)`.
3. **Bắt Ngoại Lệ Tập Trung qua `GlobalExceptionHandler`**: Toàn bộ ngoại lệ từ Controller, Validation, Security đến CSDL đều được chặn và chuyển đổi thành `ApiResponse` với mã HTTP status tương ứng tại `GlobalExceptionHandler.java`.

#### C. Minh họa Đúng / Sai Thực Tế
*Minh chứng mã nguồn thực tế*: `src/main/java/com/example/AIoTLibTQB/exception/GlobalExceptionHandler.java:18-125`.

❌ **SAI (BAD) — Trả về đối tượng thô hoặc bắt lỗi thủ công trong từng Controller**:
```java
// BAD: Trả về đối tượng thô, bắt lỗi thủ công làm phân mảnh mã nguồn
@RestController
@RequestMapping("/bad/devices")
public class BadDeviceController {
    
    // NGUY HIỂM: Trả về DeviceResponse trần trụi, client không biết mã code chuẩn
    @GetMapping("/{id}")
    public DeviceResponse getDevice(@PathVariable String id) {
        Device device = deviceRepository.findById(id).orElse(null);
        if (device == null) {
            // NGUY HIỂM: Trả về null hoặc ném Exception không chuẩn hóa
            throw new RuntimeException("Device not found"); 
        }
        return toDto(device);
    }
}
```

✅ **ĐÚNG (GOOD) — Chuẩn mã nguồn AIoTLibTQB (`DeviceController.java` & `GlobalExceptionHandler.java`)**:
```java
// GOOD: Luôn bọc trong ApiResponse<T> và ném AppException với ErrorCode chuẩn
@RestController
@RequestMapping("/api/v1/devices")
public class DeviceController {
    
    @GetMapping("/{id}")
    public ApiResponse<DeviceResponse> getById(@PathVariable String id) {
        return ApiResponse.<DeviceResponse>builder()
                .result(deviceService.getById(id)) // deviceService ném AppException(ErrorCode.DEVICE_NOT_EXISTED)
                .build();
    }
}

// Xử lý tập trung tại GlobalExceptionHandler:
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(value = AppException.class)
    public ResponseEntity<ApiResponse<?>> handleAppException(AppException e) {
        ErrorCode errorCode = e.getErrorCode();
        ApiResponse<?> api = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .build();
        return ResponseEntity.status(errorCode.getStatusCode()).body(api);
    }
}
```

---

### 3.6. Quy Ước 6: Phân Trang & Sắp Xếp Dữ Liệu An Toàn (Pagination & Sorting Standardization)

#### A. Nguyên lý Bảo vệ Tài nguyên
Khi dữ liệu danh sách người dùng, thiết bị hoặc cảnh báo tăng lên hàng nghìn bản ghi, các truy vấn không phân trang (`findAll()`) sẽ gây nghẽn đường truyền mạng và làm tràn bộ nhớ máy chủ. Đồng thời, việc cho phép người dùng tự do truyền tên cột sắp xếp từ URL mà không kiểm tra sẽ mở ra nguy cơ tấn công hoặc làm sập CSDL (Invalid Sort Field Exception).

#### B. Quy tắc Bắt buộc trong Dự án
1. **Chuẩn hóa Đầu ra qua `PageResponse<T>`**: Sử dụng `PageResponse.builder()` để đóng gói thông tin trang (`content`, `page`, `size`, `totalElements`, `totalPages`, `last`).
2. **Kẹp Giới Hạn Tham Số Đầu Vào (Sanitization & Clamping)**:
   - `safePage = Math.max(0, page)` (Chống truyền số trang âm).
   - `safeSize = Math.max(1, Math.min(100, size))` (Chống truyền size âm hoặc truyền size khổng lồ như 10,000 làm nghẽn CSDL).
3. **Danh Sách Trắng Trường Sắp Xếp (Field Whitelisting)**: Kiểm tra trường `sortBy` có nằm trong danh sách các trường được phép hay không. Nếu không, fallback về trường an toàn mặc định.

#### C. Minh họa Đúng / Sai Thực Tế
*Minh chứng mã nguồn thực tế*: `src/main/java/com/example/AIoTLibTQB/controller/AlertController.java:39-45`.

❌ **SAI (BAD) — Chấp nhận tham số phân trang thô mà không kiểm tra an toàn**:
```java
// BAD: Tin tưởng tuyệt đối dữ liệu người dùng gửi lên
@GetMapping("/alerts")
public List<Alert> getAlerts(@RequestParam int page, @RequestParam int size, @RequestParam String sortBy) {
    // Nếu hacker truyền size = 1,000,000 -> Server chết ngay vì OutOfMemory!
    // Nếu hacker truyền sortBy = "password_hash" hoặc trường không index -> Chậm hệ thống
    Pageable pageable = PageRequest.of(page, size, Sort.by(sortBy));
    return alertRepository.findAll(pageable).getContent();
}
```

✅ **ĐÚNG (GOOD) — Chuẩn mã nguồn AIoTLibTQB (`AlertController.java:39-48`)**:
```java
// GOOD: Kẹp giới hạn an toàn và Whitelist trường sắp xếp
@GetMapping
@PreAuthorize("hasAuthority('VIEW_ALERTS')")
public ApiResponse<PageResponse<AlertResponse>> getAlerts(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "startedAt") String sortBy,
        @RequestParam(defaultValue = "DESC") String direction
) {
    // 1. Kẹp giới hạn an toàn trang và kích thước
    int safePage = Math.max(0, page);
    int safeSize = Math.max(1, Math.min(100, size)); // Tối đa 100 bản ghi/trang

    // 2. Whitelist các trường được phép sắp xếp
    List<String> allowedSortFields = List.of("startedAt", "severity", "status", "type", "createdAt");
    String safeSortBy = allowedSortFields.contains(sortBy) ? sortBy : "startedAt";

    Sort.Direction sortDirection = "ASC".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
    Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(sortDirection, safeSortBy));

    return ApiResponse.<PageResponse<AlertResponse>>builder()
            .result(alertService.getAlerts(roomId, type, status, pageable))
            .build();
}
```

---

### 3.7. Quy Ước 7: Chuyển Đổi DTO & Thực Thể (MapStruct vs Manual Service Builder)

#### A. Nguyên tắc Phân định
Codebase dự án phân định rõ ràng giữa chuyển đổi tự động bằng MapStruct và chuyển đổi thủ công bằng Builder trong Service:
1. **Sử dụng MapStruct Mapper (`@Mapper(componentModel = "spring")`)**:
   - Áp dụng cho các thực thể CRUD tiêu chuẩn: `User`, `Role`, `Permission`.
   - Cấu trúc trường dữ liệu tương đồng 1:1, không đòi hỏi tính toán phụ thuộc trạng thái bên ngoài hoặc truy vấn thêm CSDL.
2. **Sử dụng Manual Builder trong Service / Controller**:
   - Áp dụng cho các cấu trúc tổng hợp dữ liệu vi khí hậu phức tạp: `TelemetryResponse`, `RoomSummaryResponse`, `AlertResponse`, `ComfortScore`.
   - Lý do: Đòi hỏi nạp thông tin động từ bộ đệm RAM (`LatestTelemetryCache`, `DeviceMetadataCache`), kết hợp tính điểm phi tuyến Liebig từ `ComfortScoreService`, kiểm tra null an toàn và loại trừ trường nhạy cảm.

---

### 3.8. Quy Ước 8: Kiến Trúc & Chuẩn Gọi API Frontend (FE-ARC & FE-API)

#### A. Cô Lập Tầng Gọi HTTP (FE-ARC)
- Toàn bộ lời gọi HTTP phải được cô lập tuyệt đối trong thư mục tính năng (`src/features/*/api.ts`) thông qua HTTP Client trung tâm (`src/lib/http/client.ts`).
- **Nghiêm cấm**: Gọi `fetch()` hoặc `axios` trực tiếp bên trong React Component hoặc UI hook.
- Mọi truy vấn Server Cache phải sử dụng **TanStack React Query v5** (`queries.ts`) với cấu trúc query key chuẩn hóa: `[domain, scope, params]`.

#### B. Chuẩn Hóa Phản Hồi & Bắt Lỗi (FE-API)
- **Unwrap ApiResponse**: Tầng HTTP client tự động mở vỏ bọc `ApiResponse<T>`. Chỉ coi là thành công khi `code === 1000`; ngược lại ném ngoại lệ `ApiError{code, message, httpStatus}`.
- **Tra cứu Lỗi theo Code**: Giao diện người dùng phải ánh xạ mã lỗi theo trường `code` (tra bảng `ErrorCode` nghiệp vụ), không bao giờ hiển thị nguyên văn chuỗi `message` tiếng Anh của backend cho người dùng cuối.
- **Xử lý Nullable**: Mọi trường số đo cảm biến coi là `number | null | undefined`, hiển thị ký tự `--` kèm tooltip khi giá trị vắng mặt, tránh lỗi `TypeError: Cannot read properties of null`.

---

### 3.9. Quy Ước 9: Xác Thực Phiên & Hàng Đợi Single-Flight Token Refresh (FE-AUTH)

#### A. Nguyên lý & Cơ chế Phòng hộ
AIoTLibTQB áp dụng cơ chế xoay vòng Refresh Token (Refresh Token Rotation - RTR). Mỗi Refresh Token chỉ được sử dụng đúng một lần và bị đưa vào danh sách đen (Blacklist) ngay lập tức:
- Nếu nhiều request đồng thời nhận lỗi `401 Unauthorized` và cùng tự động gọi `/api/v1/auth/refresh`, request đầu tiên thành công sẽ khiến các request sau bị coi là "dùng lại token đã thu hồi", dẫn tới hệ thống tự động khóa phiên và đăng xuất người dùng ngoài ý muốn.

#### B. Quy tắc Single-Flight Token Refresh Bắt buộc
1. **Hàng Đợi Chờ Duy Nhất (Single-Flight Queue)**:
   - Khi nhận lỗi `401` / mã `1006`, chỉ cho phép **duy nhất một request** `POST /api/v1/auth/refresh` chạy tại một thời điểm.
   - Các request thất bại khác được xếp vào một mảng hàng đợi `pendingRequestsQueue` lưu giữ `resolve` và `reject`.
   - Khi request refresh hoàn tất thành công, cập nhật Access Token trong RAM (`useAuthStore`) và phát lại đồng loạt toàn bộ request trong hàng đợi với token mới.
   - Nếu refresh thất bại: xóa trạng thái phiên, lưu `returnUrl` và điều hướng về `/login`.
2. **Đồng Bộ Đa Tab Qua BroadcastChannel**:
   - Sử dụng `BroadcastChannel("aiot_auth_channel")` để phát thông điệp cập nhật token hoặc đăng xuất giữa các tab trình duyệt, ngăn ngừa việc tab thứ hai sử dụng token cũ đã bị xoay vòng.
3. **Lưu Trữ Token An Toàn**:
   - Access Token **chỉ lưu trong RAM**, không lưu vào `localStorage` hay `cookie` phía client để triệt tiêu nguy cơ tấn công XSS.
   - Khi Logout: gửi cả `accessToken` và `refreshToken` trong cùng 1 request `POST /api/v1/auth/logout` để thu hồi toàn diện.

---

### 3.10. Quy Ước 10: Vòng Đời Kênh Thời Gian Thực STOMP Singleton (FE-RT)

#### A. Singleton Manager & Khởi Tạo Kết Nối
- Sử dụng duy nhất một thể hiện Singleton `AiotStompManager` (`src/lib/realtime/stomp-client.ts`) quản lý `@stomp/stompjs` Client qua kết nối Native WebSocket `/ws-aiot`.
- Chỉ kích hoạt (`client.activate()`) sau khi người dùng đã đăng nhập thành công. Khi đăng xuất, bắt buộc gọi `client.deactivate()`.
- **Tiêm Token Động**: Sử dụng hook `beforeConnect` để đọc Access Token mới nhất từ `useAuthStore` trước mỗi lần kết nối hoặc tự động kết nối lại (`reconnectDelay: 5000ms`), đảm bảo không kết nối bằng token cũ đã hết hạn.

#### B. Quản Lý Vòng Đời Subscription
1. **Subscribe & Unsubscribe Theo Vòng Đời Màn Hình**:
   - Khi Component hiển thị (mount), đăng ký nhận tin theo topic phòng cụ thể: `/topic/rooms/{roomId}/telemetry`.
   - Khi Component hủy (unmount), bắt buộc phải gọi phương thức `subscription.unsubscribe()`. Tuyệt đối không để subscription chạy ngầm gây rò rỉ bộ nhớ.
2. **Ghi Dữ Liệu Trực Tiếp Vào React Query Cache**:
   - Khi nhận bản tin STOMP, cập nhật thẳng vào cache qua `queryClient.setQueryData()` cùng khóa truy vấn với REST `/telemetry/room/{id}/latest`.
   - **Bảo vệ Thứ Tự Thời Gian**: So sánh trường `timestamp` của bản tin đến với bản tin hiện hành trong cache; bỏ qua bản tin nếu timestamp cũ hơn nhằm loại trừ rủi ro bản tin mạng đến lộn xộn.

---

### 3.11. Quy Ước 11: Đồ Họa 2D Canvas Mặt Bằng & HiDPI DevicePixelRatio Scaling (FE-VIZ)

#### A. Chuẩn Hóa Hệ Tọa Độ & Mô-đun Hóa
- Mọi tọa độ điểm ranh giới phòng `boundaryPolygon` và vị trí trạm cảm biến `(posX, posY)` được lưu trữ và truyền nhận dưới dạng số thực tương đối chuẩn hóa trong đoạn `[0.0, 1.0]`.
- Toàn bộ các phép toán nhân tỉ lệ chuyển đổi giữa tọa độ tương đối và tọa độ điểm ảnh pixel phải được tập trung tại một mô-đun duy nhất: `src/lib/floorplan/coords.ts`.

#### B. Xử Lý Co Giãn Tỷ Lệ HiDPI (DevicePixelRatio Scaling)
Để hình ảnh bản đồ nhiệt và ranh giới phòng không bị nhòe mờ trên các màn hình Retina, màn hình 2K/4K và màn hình TV Kiosk:
```typescript
// Chuẩn thiết lập Canvas HiDPI chống mờ hình
const canvas = canvasRef.current;
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;

// Đặt kích thước đệm vẽ theo tỉ lệ điểm ảnh vật lý
canvas.width = Math.floor(displayWidth * dpr);
canvas.height = Math.floor(displayHeight * dpr);

// Khóa kích thước hiển thị CSS
canvas.style.width = `${displayWidth}px`;
canvas.style.height = `${displayHeight}px`;

// Co giãn ma trận tọa độ vẽ
ctx.scale(dpr, dpr);
```

#### C. Cắt Ranh Giới Đa Giác Phòng (Polygon Clipping)
- Thuật toán nội suy trọng số nghịch đảo khoảng cách (IDW) là hàm toán học thuần túy (`src/lib/floorplan/idw.ts`).
- Khi vẽ bản đồ nhiệt cho từng phòng, bắt buộc phải dùng cơ chế cắt đường viền:
  `ctx.save()` $\to$ nạp đường dẫn đa giác phòng $\to$ `ctx.clip()` $\to$ vẽ lưới màu vi khí hậu $\to$ `ctx.restore()`.
  Quy tắc này đảm bảo màu sắc vi khí hậu không bao giờ bị lem ra ngoài hành lang hoặc xuyên qua tường sang phòng lân cận.

---

### 3.12. Quy Ước 12: Khả Năng Tiếp Cận, Bốn Trạng Thái Giao Diện & Trình Bày Vi Khí Hậu (FE-A11Y & FE-UI)

#### A. Bốn Trạng Thái Giao Diện Bắt Buộc (FE-UI-01)
Mọi khối giao diện (Widget/Card) hiển thị số đo môi trường phải hỗ trợ đầy đủ 4 trạng thái:
1. **Loading (Đang tải)**: Hiển thị khung xương Skeleton khớp với bố cục thực tế; nghiêm cấm dùng vòng xoay spinner chặn toàn trang.
2. **Empty (Dữ liệu rỗng)**: Hiển thị thông điệp giải thích ngữ cảnh kèm nút bấm hướng dẫn hành động (ví dụ: `totalRooms = 0` $\to$ "Đang chờ dữ liệu trạm đo sau khi khởi động hệ thống", phòng chưa có tọa độ $\to$ "Chưa vẽ đa giác mặt bằng").
3. **Error / Stale (Lỗi / Mất kết nối)**: Hiển thị nhãn cảnh báo thân thiện kèm nút bấm "Thử lại".
4. **Realtime Active (Đang nhận tin trực tiếp)**: Hiệu ứng nhịp đập pulse nhẹ ($\le 300$ms) tại các số đo vừa thay đổi giá trị.

#### B. Quy Chuẩn Tiếp Cận WCAG 2.1 AA (FE-A11Y)
- **Tương Phản Màu & Nhãn Kép**: Tỷ lệ tương phản chữ $\ge 4.5:1$. Không bao giờ biểu thị trạng thái duy nhất bằng màu sắc; bắt buộc kèm theo biểu tượng (Icon) và nhãn chữ (ví dụ: chấm xanh kèm chữ "ONLINE", chấm đỏ kèm chữ "OFFLINE", nhãn hạng "Platinum - Tối ưu").
- **Font Chữ Tabular Nums**: Mọi số đo cảm biến vi khí hậu phải áp dụng thuộc tính `font-variant-numeric: tabular-nums` (hoặc lớp Tailwind `tabular-nums` / `font-mono`) để các chữ số có độ rộng cố định, chống hiện tượng nhảy giật giao diện khi giá trị cảm biến biến thiên liên tục.
- **Hỗ Trợ Screen Reader**: Các thông báo cảnh báo khẩn cấp (`FIRING`) phải gắn thuộc tính `aria-live="assertive"`; các cập nhật thông thường dùng `aria-live="polite"`. Cung cấp chế độ xem bảng dữ liệu thay thế cho Canvas bản đồ nhiệt.

---

## 4. BẢNG CHECKLIST DUYỆT PULL REQUEST (PR CODE REVIEW CHECKLIST)

Mọi kỹ sư khi tạo hoặc review Pull Request phải tích đủ các tiêu chí dưới đây trước khi bấm Merge:

| STT | Phân Hệ | Hạng Mục Kiểm Tra | Tiêu Chí Đạt Chuẩn (Acceptance Criteria) | Tự Kiểm | Reviewer |
| :---: | :---: | :--- | :--- | :---: | :---: |
| 1 | **Backend** | **Virtual Threads Safety** | Không có từ khóa `synchronized`. Không có I/O chặn bên trong `compute()`. | [ ] | [ ] |
| 2 | **Backend** | **TimeSeries Collections** | Không gọi `updateFirst`, `updateOne` trên `telemetry_records`. Dùng `$dateTrunc`. | [ ] | [ ] |
| 3 | **Backend** | **Đồng Bộ & Kiểm Soát Tải** | Thao tác ghi CSDL đồng thời có được giới hạn bởi `Semaphore(30, true)` hoặc Throttling không? | [ ] | [ ] |
| 4 | **Backend** | **Bảo Mật Secrets** | Không hardcode API key, password, connection string. Mật khẩu băm BCrypt strength 10. | [ ] | [ ] |
| 5 | **Backend** | **API Response Envelope** | Toàn bộ endpoint trả về `ApiResponse<T>`. Lỗi nghiệp vụ ném qua `AppException`. | [ ] | [ ] |
| 6 | **Backend** | **Phân Trang An Toàn** | `safeSize` được kẹp tối đa 100. Có whitelist trường `sortBy`. | [ ] | [ ] |
| 7 | **Backend** | **Chuyển Đổi DTO / Entity** | MapStruct dùng cho CRUD đơn giản; Manual Builder dùng cho Telemetry/Alert tính toán. | [ ] | [ ] |
| 8 | **Frontend** | **Cô Lập Tầng Gọi HTTP (FE-ARC)**| Không gọi fetch/axios trực tiếp trong component; toàn bộ qua React Query `queries.ts`. | [ ] | [ ] |
| 9 | **Frontend** | **Single-Flight Refresh (FE-AUTH)** | Silent refresh có hàng đợi chặn gửi trùng không? Token chỉ lưu RAM `useAuthStore`? | [ ] | [ ] |
| 10 | **Frontend** | **Vòng Đời STOMP (FE-RT)** | Singleton `AiotStompManager`? Có tiêm token qua `beforeConnect`? Unsubscribe khi unmount? | [ ] | [ ] |
| 11 | **Frontend** | **Canvas HiDPI Scaling (FE-VIZ)** | Canvas có scale theo `devicePixelRatio` không? Tọa độ có qua `coords.ts` không? | [ ] | [ ] |
| 12 | **Frontend** | **A11Y & Trạng Thái (FE-A11Y/UI)** | Đủ 4 trạng thái UI (Loading/Empty/Error/Realtime)? Font có dùng `tabular-nums`? | [ ] | [ ] |

---

## 5. ĐỌC TIẾP

Để nắm vững cách thức hiện thực các quy ước này vào từng phân hệ cụ thể, hãy tham khảo các tài liệu liên quan:
- **Kiến trúc Tổng thể & Luồng Dữ liệu**: [`docs/02-architecture.md`](./02-architecture.md)
- **Đường ống Thu nạp Telemetry & Watchdog**: [`docs/03-ingestion-pipeline.md`](./03-ingestion-pipeline.md)
- **Mô hình Dữ liệu MongoDB & TimeSeries**: [`docs/05-data-model.md`](./05-data-model.md)
- **Kiến trúc Bảo mật & Phân quyền RBAC**: [`docs/06-security-rbac.md`](./06-security-rbac.md)
- **Đặc tả REST API & Bảng Mã Lỗi**: [`docs/07-api-reference.md`](./07-api-reference.md)
- **Cẩm nang Triển khai & Vận hành (Runbook)**: [`docs/11-onboarding-runbook.md`](./11-onboarding-runbook.md)
