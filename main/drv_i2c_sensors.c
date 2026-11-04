#include "drv_i2c_sensors.h"
#include "driver/i2c.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <stdio.h>
#include <string.h>

/**
 * @file drv_i2c_sensors.c
 * @brief Thực thi Driver Bus I2C Master cho BH1750, SHT30, SCD40 và Màn hình OLED SH1106/SSD1306.
 */

static const char *TAG = "DRV_I2C";
static bool s_i2c_initialized = false;
static bool s_oled_ready      = false;
static uint8_t s_oled_addr    = 0x3C;
static bool s_is_sh1106       = false; // Cờ nhận biết SH1106 (cần offset cột = 2)

// Bảng mã font ASCII 5x7 chuẩn
static const uint8_t font5x7[][5] = {
    {0x00, 0x00, 0x00, 0x00, 0x00}, // 32 ' '
    {0x00, 0x00, 0x5F, 0x00, 0x00}, // 33 '!'
    {0x00, 0x07, 0x00, 0x07, 0x00}, // 34 '"'
    {0x14, 0x7F, 0x14, 0x7F, 0x14}, // 35 '#'
    {0x24, 0x2A, 0x7F, 0x2A, 0x12}, // 36 '$'
    {0x23, 0x13, 0x08, 0x64, 0x62}, // 37 '%'
    {0x36, 0x49, 0x55, 0x22, 0x50}, // 38 '&'
    {0x00, 0x05, 0x03, 0x00, 0x00}, // 39 '''
    {0x00, 0x1C, 0x22, 0x41, 0x00}, // 40 '('
    {0x00, 0x41, 0x22, 0x1C, 0x00}, // 41 ')'
    {0x14, 0x08, 0x3E, 0x08, 0x14}, // 42 '*'
    {0x08, 0x08, 0x3E, 0x08, 0x08}, // 43 '+'
    {0x00, 0x50, 0x30, 0x00, 0x00}, // 44 ','
    {0x08, 0x08, 0x08, 0x08, 0x08}, // 45 '-'
    {0x00, 0x60, 0x60, 0x00, 0x00}, // 46 '.'
    {0x20, 0x10, 0x08, 0x04, 0x02}, // 47 '/'
    {0x3E, 0x51, 0x49, 0x45, 0x3E}, // 48 '0'
    {0x00, 0x42, 0x7F, 0x40, 0x00}, // 49 '1'
    {0x42, 0x61, 0x51, 0x49, 0x46}, // 50 '2'
    {0x21, 0x41, 0x45, 0x4B, 0x31}, // 51 '3'
    {0x18, 0x14, 0x12, 0x7F, 0x10}, // 52 '4'
    {0x27, 0x45, 0x45, 0x45, 0x39}, // 53 '5'
    {0x3C, 0x4A, 0x49, 0x49, 0x30}, // 54 '6'
    {0x01, 0x71, 0x09, 0x05, 0x03}, // 55 '7'
    {0x36, 0x49, 0x49, 0x49, 0x36}, // 56 '8'
    {0x06, 0x49, 0x49, 0x29, 0x1E}, // 57 '9'
    {0x00, 0x36, 0x36, 0x00, 0x00}, // 58 ':'
    {0x00, 0x56, 0x36, 0x00, 0x00}, // 59 ';'
    {0x08, 0x14, 0x22, 0x41, 0x00}, // 60 '<'
    {0x14, 0x14, 0x14, 0x14, 0x14}, // 61 '='
    {0x00, 0x41, 0x22, 0x14, 0x08}, // 62 '>'
    {0x02, 0x01, 0x51, 0x09, 0x06}, // 63 '?'
    {0x32, 0x49, 0x79, 0x41, 0x3E}, // 64 '@'
    {0x7E, 0x11, 0x11, 0x11, 0x7E}, // 65 'A'
    {0x7F, 0x49, 0x49, 0x49, 0x36}, // 66 'B'
    {0x3E, 0x41, 0x41, 0x41, 0x22}, // 67 'C'
    {0x7F, 0x41, 0x41, 0x22, 0x1C}, // 68 'D'
    {0x7F, 0x49, 0x49, 0x49, 0x41}, // 69 'E'
    {0x7F, 0x09, 0x09, 0x09, 0x01}, // 70 'F'
    {0x3E, 0x41, 0x49, 0x49, 0x7A}, // 71 'G'
    {0x7F, 0x08, 0x08, 0x08, 0x7F}, // 72 'H'
    {0x00, 0x41, 0x7F, 0x41, 0x00}, // 73 'I'
    {0x20, 0x40, 0x41, 0x3F, 0x01}, // 74 'J'
    {0x7F, 0x08, 0x14, 0x22, 0x41}, // 75 'K'
    {0x7F, 0x40, 0x40, 0x40, 0x40}, // 76 'L'
    {0x7F, 0x02, 0x0C, 0x02, 0x7F}, // 77 'M'
    {0x7F, 0x04, 0x08, 0x10, 0x7F}, // 78 'N'
    {0x3E, 0x41, 0x41, 0x41, 0x3E}, // 79 'O'
    {0x7F, 0x09, 0x09, 0x09, 0x06}, // 80 'P'
    {0x3E, 0x41, 0x51, 0x21, 0x5E}, // 81 'Q'
    {0x7F, 0x09, 0x19, 0x29, 0x46}, // 82 'R'
    {0x46, 0x49, 0x49, 0x49, 0x31}, // 83 'S'
    {0x01, 0x01, 0x7F, 0x01, 0x01}, // 84 'T'
    {0x3F, 0x40, 0x40, 0x40, 0x3F}, // 85 'U'
    {0x1F, 0x20, 0x40, 0x20, 0x1F}, // 86 'V'
    {0x3F, 0x40, 0x38, 0x40, 0x3F}, // 87 'W'
    {0x63, 0x14, 0x08, 0x14, 0x63}, // 88 'X'
    {0x07, 0x08, 0x70, 0x08, 0x07}, // 89 'Y'
    {0x61, 0x51, 0x49, 0x45, 0x43}, // 90 'Z'
    {0x00, 0x7F, 0x41, 0x41, 0x00}, // 91 '['
    {0x02, 0x04, 0x08, 0x10, 0x20}, // 92 '\'
    {0x00, 0x41, 0x41, 0x7F, 0x00}, // 93 ']'
};

static uint8_t s_oled_pages[8][128];

static void oled_clear(void) {
    memset(s_oled_pages, 0x00, sizeof(s_oled_pages));
}

static void oled_draw_string(int x, int page, const char *str) {
    if (page < 0 || page >= 8) return;
    int cur_x = x;
    while (*str && cur_x < 122) {
        char c = *str++;
        if (c >= 'a' && c <= 'z') c = c - 'a' + 'A';
        if (c >= 32 && c <= 93) {
            int idx = c - 32;
            for (int col = 0; col < 5; col++) {
                if (cur_x + col < 128) {
                    s_oled_pages[page][cur_x + col] = font5x7[idx][col];
                }
            }
            if (cur_x + 5 < 128) s_oled_pages[page][cur_x + 5] = 0x00;
            cur_x += 6;
        } else {
            cur_x += 6;
        }
    }
}

static void oled_flush(void) {
    if (!s_oled_ready) return;

    for (uint8_t p = 0; p < 8; p++) {
        // Với SH1106: Cột hiển thị bắt đầu từ cột 2 trong RAM 132 cột (0x02, 0x10)
        // Với SSD1306: Cột bắt đầu từ cột 0 (0x00, 0x10)
        uint8_t col_low = s_is_sh1106 ? 0x02 : 0x00;
        uint8_t set_page_cmds[] = {
            0x00,
            (uint8_t)(0xB0 | p), // Set page address (0-7)
            col_low,             // Lower column address
            0x10                 // Higher column address (0x10)
        };
        i2c_master_write_to_device(I2C_MASTER_NUM, s_oled_addr, set_page_cmds, sizeof(set_page_cmds), pdMS_TO_TICKS(20));

        uint8_t data_chunk[129];
        data_chunk[0] = 0x40; // Co=0, D/C#=1 (Data stream)
        memcpy(&data_chunk[1], s_oled_pages[p], 128);
        i2c_master_write_to_device(I2C_MASTER_NUM, s_oled_addr, data_chunk, sizeof(data_chunk), pdMS_TO_TICKS(50));
    }
}

static void oled_init_hardware(uint8_t addr) {
    s_oled_addr = addr;
    static const uint8_t init_cmds[] = {
        0x00,
        0xAE,       // Display OFF
        0xD5, 0x80, // Set display clock divide ratio/oscillator
        0xA8, 0x3F, // Set multiplex ratio (1 to 64)
        0xD3, 0x00, // Set display offset
        0x40,       // Set start line address
        0x8D, 0x14, // Charge pump enable
        0x20, 0x02, // Set Memory Addressing Mode (Page Addressing Mode)
        0xA1,       // Set segment re-map (A0/A1)
        0xC8,       // Set COM Output Scan Direction
        0xDA, 0x12, // Set COM pins hardware config
        0x81, 0xCF, // Set contrast control
        0xD9, 0xF1, // Set pre-charge period
        0xDB, 0x40, // Set Vcomh deselect level
        0xA4,       // Entire display ON resume
        0xA6,       // Normal display (not inverted)
        0xAF        // Display ON
    };
    i2c_master_write_to_device(I2C_MASTER_NUM, s_oled_addr, init_cmds, sizeof(init_cmds), pdMS_TO_TICKS(50));
    s_oled_ready = true;

    // Hiển thị màn hình chào mừng ban đầu
    oled_clear();
    oled_draw_string(14, 0, "TQB SMARTLIB");
    oled_draw_string(2, 2, "NODE ALL SENSORS");
    oled_draw_string(2, 4, "STATUS: KHOI DONG");
    oled_draw_string(2, 6, "I2C SCANNING...");
    oled_flush();
    ESP_LOGI(TAG, "Da khoi tao Man hinh OLED (0x%02X, SH1106/SSD1306) thanh cong!", s_oled_addr);
}

// CRC-8 Sensirion (Đa thức 0x31, init 0xFF) cho SHT30 và SCD40
static uint8_t sensirion_crc8(const uint8_t *data, int len) {
    uint8_t crc = 0xFF;
    for (int j = 0; j < len; j++) {
        crc ^= data[j];
        for (int i = 0; i < 8; i++) {
            if (crc & 0x80) {
                crc = (uint8_t)((crc << 1) ^ 0x31);
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}

// =============================================================================
// 1. KHỞI TẠO BUS I2C MASTER (SDA = GPIO 8, SCL = GPIO 9)
// =============================================================================
esp_err_t drv_i2c_bus_init(void) {
    if (s_i2c_initialized) {
        return ESP_OK;
    }

    i2c_config_t conf = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = I2C_MASTER_SDA_IO,
        .scl_io_num = I2C_MASTER_SCL_IO,
        .sda_pullup_en = GPIO_PULLUP_ENABLE, // Bật trở kéo nội song song trở ngoại R5, R6 (4.7kΩ)
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = I2C_MASTER_FREQ_HZ,
        .clk_flags = 0
    };

    esp_err_t err = i2c_param_config(I2C_MASTER_NUM, &conf);
    if (err != ESP_OK) return err;

    err = i2c_driver_install(I2C_MASTER_NUM, conf.mode, 0, 0, 0);
    if (err != ESP_OK) return err;

    s_i2c_initialized = true;
    ESP_LOGI(TAG, "Da khoi tao I2C Master Bus: SDA=GPIO%d, SCL=GPIO%d, Toc do=%d Hz",
             I2C_MASTER_SDA_IO, I2C_MASTER_SCL_IO, I2C_MASTER_FREQ_HZ);

    // Kích hoạt chế độ đo liên tục độ phân giải cao cho BH1750 (Lệnh 0x10)
    uint8_t bh1750_cmd = 0x10;
    i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_BH1750, &bh1750_cmd, 1, pdMS_TO_TICKS(50));

    // Kích hoạt chế độ đo định kỳ cho SCD40 (Lệnh 0x21B1)
    uint8_t scd40_start_cmd[2] = {0x21, 0xB1};
    i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_SCD40, scd40_start_cmd, 2, pdMS_TO_TICKS(50));

    // Khởi tạo OLED tại 0x3C (hoặc 0x3D)
    if (drv_i2c_probe_device(I2C_ADDR_OLED_DEFAULT)) {
        oled_init_hardware(I2C_ADDR_OLED_DEFAULT);
    } else if (drv_i2c_probe_device(I2C_ADDR_OLED_ALT)) {
        oled_init_hardware(I2C_ADDR_OLED_ALT);
    } else {
        s_oled_ready = false;
        ESP_LOGW(TAG, "Chua phat hien OLED tai 0x3C hoac 0x3D tren SDA=GPIO%d, SCL=GPIO%d",
                 I2C_MASTER_SDA_IO, I2C_MASTER_SCL_IO);
    }

    return ESP_OK;
}

// Quét toàn bộ 127 địa chỉ I2C trên bus
void drv_i2c_scan_bus(void) {
    ESP_LOGI(TAG, "==================================================");
    ESP_LOGI(TAG, "  QUET TOAN BO I2C BUS (SDA=GPIO%d, SCL=GPIO%d)", I2C_MASTER_SDA_IO, I2C_MASTER_SCL_IO);
    ESP_LOGI(TAG, "==================================================");
    int count = 0;
    for (uint8_t a = 1; a < 127; a++) {
        if (drv_i2c_probe_device(a)) {
            const char *dev_name = "Ngoai vi I2C";
            if (a == I2C_ADDR_BH1750) dev_name = "BH1750 (Anh sang)";
            else if (a == I2C_ADDR_SHT30) dev_name = "SHT30 (Nhiet/Am)";
            else if (a == I2C_ADDR_SCD40) dev_name = "SCD40 (CO2 NDIR)";
            else if (a == I2C_ADDR_OLED_DEFAULT || a == I2C_ADDR_OLED_ALT) dev_name = "OLED SH1106/SSD1306";

            ESP_LOGI(TAG, ">>> [I2C PHAT HIEN] Dia chi 0x%02X (%d) -> %s", a, a, dev_name);
            count++;
        }
    }
    if (count == 0) {
        ESP_LOGW(TAG, ">>> [I2C SCAN] Khong co thiet bi nao phan hoi ACK tren bus!");
    } else {
        ESP_LOGI(TAG, ">>> [I2C SCAN] Tong cong tim thay %d thiet bi hoat dong tot!", count);
    }
    ESP_LOGI(TAG, "==================================================");
}

// Kiểm tra ACK thiết bị I2C (Plug-and-Play)
bool drv_i2c_probe_device(uint8_t addr_7bit) {
    if (!s_i2c_initialized) return false;
    i2c_cmd_handle_t cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (addr_7bit << 1) | I2C_MASTER_WRITE, true);
    i2c_master_stop(cmd);
    esp_err_t ret = i2c_master_cmd_begin(I2C_MASTER_NUM, cmd, pdMS_TO_TICKS(25));
    i2c_cmd_link_delete(cmd);
    return (ret == ESP_OK);
}

// =============================================================================
// 2. DRIVER CẢM BIẾN ÁNH SÁNG BH1750 (0x23)
// =============================================================================
esp_err_t drv_bh1750_read_lux(float *lux_out) {
    if (!lux_out) return ESP_ERR_INVALID_ARG;
    uint8_t raw[2] = {0};
    esp_err_t err = i2c_master_read_from_device(I2C_MASTER_NUM, I2C_ADDR_BH1750, raw, 2, pdMS_TO_TICKS(50));
    if (err != ESP_OK) {
        return err;
    }

    uint16_t raw_val = ((uint16_t)raw[0] << 8) | raw[1];
    *lux_out = (float)raw_val / 1.2f; // Quy đổi theo độ nhạy quang học Datasheet BH1750
    return ESP_OK;
}

// =============================================================================
// 3. DRIVER CẢM BIẾN NHIỆT ĐỘ & ĐỘ ẨM SHT30 / SHT31 (0x44)
// =============================================================================
esp_err_t drv_sht30_read_temp_rh(float *temp_out, float *rh_out) {
    // Lệnh Single-Shot Measurement, High Repeatability (0x2400)
    uint8_t cmd[2] = {0x24, 0x00};
    esp_err_t err = i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_SHT30, cmd, 2, pdMS_TO_TICKS(50));
    if (err != ESP_OK) return err;

    // Đợi 15ms cho chuyển đổi ADC nội
    vTaskDelay(pdMS_TO_TICKS(15));

    uint8_t buf[6] = {0};
    err = i2c_master_read_from_device(I2C_MASTER_NUM, I2C_ADDR_SHT30, buf, 6, pdMS_TO_TICKS(50));
    if (err != ESP_OK) return err;

    // Kiểm tra CRC-8 Sensirion
    if (sensirion_crc8(&buf[0], 2) != buf[2] || sensirion_crc8(&buf[3], 2) != buf[5]) {
        ESP_LOGW(TAG, "Loi CRC-8 khi doc SHT30!");
        return ESP_ERR_INVALID_CRC;
    }

    uint16_t raw_temp = ((uint16_t)buf[0] << 8) | buf[1];
    uint16_t raw_rh   = ((uint16_t)buf[3] << 8) | buf[4];

    if (temp_out) *temp_out = -45.0f + 175.0f * ((float)raw_temp / 65535.0f);
    if (rh_out)   *rh_out   = 100.0f * ((float)raw_rh / 65535.0f);

    return ESP_OK;
}

esp_err_t drv_sht30_set_heater(bool enable) {
    uint8_t cmd[2] = {0x30, enable ? 0x6D : 0x66};
    return i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_SHT30, cmd, 2, pdMS_TO_TICKS(50));
}

// =============================================================================
// 4. DRIVER CẢM BIẾN CO2 QUANG ÂM SCD40 (0x62)
// =============================================================================
esp_err_t drv_scd40_read_measurement(uint16_t *co2_out, float *temp_out, float *rh_out) {
    uint8_t cmd[2] = {0xEC, 0x05}; // Lệnh Read Measurement
    esp_err_t err = i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_SCD40, cmd, 2, pdMS_TO_TICKS(50));
    if (err != ESP_OK) return err;

    vTaskDelay(pdMS_TO_TICKS(3));

    uint8_t buf[9] = {0};
    err = i2c_master_read_from_device(I2C_MASTER_NUM, I2C_ADDR_SCD40, buf, 9, pdMS_TO_TICKS(50));
    if (err != ESP_OK) return err;

    if (sensirion_crc8(&buf[0], 2) != buf[2]) {
        return ESP_ERR_INVALID_CRC;
    }

    if (co2_out) *co2_out = ((uint16_t)buf[0] << 8) | buf[1];

    if (temp_out != NULL && sensirion_crc8(&buf[3], 2) == buf[5]) {
        uint16_t raw_t = ((uint16_t)buf[3] << 8) | buf[4];
        *temp_out = -45.0f + 175.0f * ((float)raw_t / 65535.0f);
    }
    if (rh_out != NULL && sensirion_crc8(&buf[6], 2) == buf[8]) {
        uint16_t raw_rh = ((uint16_t)buf[6] << 8) | buf[7];
        *rh_out = 100.0f * ((float)raw_rh / 65535.0f);
    }
    return ESP_OK;
}

// =============================================================================
// 5. CẬP NHẬT MÀN HÌNH OLED (SH1106 / SSD1306)
// =============================================================================
void drv_oled_update(const sensor_data_t *data) {
    if (!data) return;

    char line1[32], line2[32], line3[32], line4[32];

    // Dòng 1: TQB SMARTLIB & Điểm LCS / Hạng tiện nghi
    if (data->lcs_score > 0.0f) {
        snprintf(line1, sizeof(line1), "TQB: LCS %.0f [%s]", data->lcs_score, data->lcs_rank);
    } else {
        snprintf(line1, sizeof(line1), "TQB: %s", data->status);
    }

    // Dòng 2: Độ ồn LAeq
    if (data->laeq_db >= 30.0f) {
        snprintf(line2, sizeof(line2), "NOISE: %.1f dBA", data->laeq_db);
    } else {
        snprintf(line2, sizeof(line2), "NOISE: -- dBA");
    }

    // Dòng 3: CO2 & Bụi mịn PM2.5
    snprintf(line3, sizeof(line3), "CO2:%uppm PM:%.1f", data->co2_ppm, data->pm25);

    // Dòng 4: Nhiệt độ, Độ ẩm & Lux
    snprintf(line4, sizeof(line4), "%.1fC %.0f%% %.0fLux", data->temp, data->rh, data->lux);

    if (s_oled_ready) {
        oled_clear();
        oled_draw_string(2, 0, line1);
        oled_draw_string(2, 2, line2);
        oled_draw_string(2, 4, line3);
        oled_draw_string(2, 6, line4);
        oled_flush();
    }
}

// Bí danh tương thích ngược
void drv_oled_ssd1306_update(const sensor_data_t *data) {
    drv_oled_update(data);
}
