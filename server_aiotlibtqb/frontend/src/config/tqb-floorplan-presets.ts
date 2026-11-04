import {
  computeVisualPolygonCenter,
  isPointInPolygon,
} from '@/lib/floorplan/polygon';
import type {
  Point2D,
  RoomResponse,
  RoomType,
  TelemetryResponse,
} from '@/types/api';

const pt = (x: number, y: number): Point2D => ({ x, y });

/**
 * Tỷ lệ khung hình chuẩn của tòa nhà Thư viện Tạ Quang Bửu (76.0m Đông-Tây × 57.2m Bắc-Nam).
 * 1:100 AutoCAD MediaBox [0 0 2384 3370] Rotate 270 -> aspectRatio = 57.2 / 76.0 ≈ 0.75263
 */
export const TQB_BUILDING_WIDTH_M = 76.0;
export const TQB_BUILDING_DEPTH_M = 57.2;
export const TQB_BUILDING_ASPECT_RATIO =
  TQB_BUILDING_DEPTH_M / TQB_BUILDING_WIDTH_M; // ~0.75263158

export type LandmarkKind =
  | 'STAIRS'
  | 'ELEVATOR'
  | 'WC'
  | 'ENTRANCE'
  | 'ATRIUM'
  | 'SERVICE_DESK';

export interface TqbLandmark {
  readonly id: string;
  readonly kind: LandmarkKind;
  readonly labelVi: string;
  readonly shortLabel: string;
  readonly position: Point2D;
  readonly floors: readonly number[];
}

export type StudySpotTag =
  | 'quiet'
  | 'window'
  | 'group'
  | 'multimedia'
  | 'ac_cool';

export interface TqbReadingBay {
  readonly id: string;
  readonly nameVi: string;
  readonly shortLabel: string;
  readonly descriptionVi: string;
  readonly posX: number;
  readonly posY: number;
  readonly seatCapacity: number;
  readonly tags: readonly StudySpotTag[];
  /** Độ lệch vi khí hậu đặc trưng của phân khu bàn đọc so với trung bình phòng */
  readonly microOffsets: {
    readonly tempDelta: number;
    readonly noiseDelta: number;
    readonly luxDelta: number;
    readonly pm25Delta: number;
    readonly humidityDelta: number;
    readonly rssiDelta: number;
    readonly comfortDelta: number;
  };
}

export interface AnonymousMicroZone {
  readonly bayId: string;
  readonly nameVi: string;
  readonly shortLabel: string;
  readonly descriptionVi: string;
  readonly posX: number;
  readonly posY: number;
  readonly seatCapacity: number;
  readonly tags: readonly StudySpotTag[];
  readonly metrics: {
    readonly comfortScore: number;
    readonly temperature: number;
    readonly humidity: number;
    readonly pm2_5: number;
    readonly noiseAvg: number;
    readonly lux: number;
    readonly wifiRssi: number;
  };
}

export interface TqbRoomPreset {
  readonly code: string;
  readonly legacyCodes?: readonly string[];
  readonly name: string;
  readonly floor: number;
  readonly roomType: RoomType;
  readonly capacity: number;
  readonly areaM2: number;
  readonly zoneCode: string;
  readonly boundaryPolygon: readonly Point2D[];
  readonly doorPosition: Point2D;
  readonly nearestLandmarkId: string;
  readonly readingBays: readonly TqbReadingBay[];
  readonly structuralColumns?: readonly Point2D[];
}

export interface WayfindingRoute {
  readonly fromLandmark: TqbLandmark;
  readonly doorPosition: Point2D;
  readonly targetPoint: Point2D;
  readonly waypoints: readonly Point2D[];
  readonly distanceMeters: number;
}

/**
 * Hệ thống mốc định vị kiến trúc chuẩn trên mặt bằng TQB (4 cụm thang bộ góc, 2 thang máy trung tâm, WC, Cổng từ, Giếng trời).
 */
export const TQB_LANDMARKS: readonly TqbLandmark[] = [
  {
    id: 'ELEV_W',
    kind: 'ELEVATOR',
    labelVi: 'Thang máy Trung tâm (Tây)',
    shortLabel: 'TM.Tây',
    position: pt(0.456, 0.478),
    floors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 'ELEV_E',
    kind: 'ELEVATOR',
    labelVi: 'Thang máy Trung tâm (Đông)',
    shortLabel: 'TM.Đông',
    position: pt(0.544, 0.478),
    floors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 'STAIR_NW',
    kind: 'STAIRS',
    labelVi: 'Cầu thang bộ Tây Bắc (45 m²)',
    shortLabel: 'Thang TB',
    position: pt(0.266, 0.115),
    floors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 'STAIR_NE',
    kind: 'STAIRS',
    labelVi: 'Cầu thang bộ Đông Bắc (45 m²)',
    shortLabel: 'Thang ĐB',
    position: pt(0.734, 0.115),
    floors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 'STAIR_SW',
    kind: 'STAIRS',
    labelVi: 'Cầu thang bộ Tây Nam (45 m²)',
    shortLabel: 'Thang TN',
    position: pt(0.266, 0.84),
    floors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 'STAIR_SE',
    kind: 'STAIRS',
    labelVi: 'Cầu thang bộ Đông Nam (45 m²)',
    shortLabel: 'Thang ĐN',
    position: pt(0.734, 0.84),
    floors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 'WC_NW',
    kind: 'WC',
    labelVi: 'Khu Vệ sinh Tây Bắc',
    shortLabel: 'WC.Tây',
    position: pt(0.196, 0.135),
    floors: [1, 2, 3, 4, 5],
  },
  {
    id: 'WC_NE',
    kind: 'WC',
    labelVi: 'Khu Vệ sinh Đông Bắc',
    shortLabel: 'WC.Đông',
    position: pt(0.804, 0.135),
    floors: [1, 2, 3, 4, 5],
  },
  {
    id: 'GATE_MAIN',
    kind: 'ENTRANCE',
    labelVi: 'Cổng chính & Cửa từ Kiểm soát Tầng 1',
    shortLabel: 'Cổng Từ T1',
    position: pt(0.5, 0.885),
    floors: [1],
  },
  {
    id: 'ATRIUM_VOID',
    kind: 'ATRIUM',
    labelVi: 'Giếng trời Thông tầng Trung tâm (417.87 m²)',
    shortLabel: 'Thông tầng 418m²',
    position: pt(0.5, 0.535),
    floors: [2, 3, 4, 5],
  },
];

/**
 * Lưới cột chịu lực BTCT tiêu biểu bên trong các phòng đọc lớn (chuẩn hóa từ layer BTCT trong PDF 1:100).
 */
export const TQB_NORTH_HALL_COLUMNS: readonly Point2D[] = [
  pt(0.399, 0.032),
  pt(0.5, 0.032),
  pt(0.6, 0.032),
  pt(0.399, 0.186),
  pt(0.5, 0.186),
  pt(0.6, 0.186),
];

export const TQB_WEST_HALL_COLUMNS: readonly Point2D[] = [
  pt(0.022, 0.536),
  pt(0.123, 0.536),
];

export const TQB_EAST_HALL_COLUMNS: readonly Point2D[] = [
  pt(0.877, 0.536),
  pt(0.978, 0.536),
];

/**
 * Danh mục Preset Phòng thực tế của Thư viện Tạ Quang Bửu (Tầng 1, 2, 3, 4, 5)
 * Đã hiệu chuẩn 1:1 với bản vẽ CAD `Mat bang Thu vien TQB.pdf`.
 */
export const TQB_ROOM_PRESETS: readonly TqbRoomPreset[] = [
  // ============================================================================
  // TẦNG 1 (Trang 1 - Tổng diện tích 4586.19 m²)
  // ============================================================================
  {
    code: 'TQB_101',
    legacyCodes: ['ROOM_001', 'LOBBY_101'],
    name: 'Sảnh Trung Tâm & Cửa Từ Kiểm Soát',
    floor: 1,
    roomType: 'CIRCULATION_HALL',
    capacity: 220,
    areaM2: 1448.37,
    zoneCode: 'ZONE_HALL',
    boundaryPolygon: [
      pt(0.301, 0.36),
      pt(0.699, 0.36),
      pt(0.699, 0.768),
      pt(0.6, 0.768),
      pt(0.6, 0.875),
      pt(0.4, 0.875),
      pt(0.4, 0.768),
      pt(0.301, 0.768),
    ],
    doorPosition: pt(0.5, 0.865),
    nearestLandmarkId: 'GATE_MAIN',
    structuralColumns: [
      pt(0.399, 0.422),
      pt(0.5, 0.422),
      pt(0.6, 0.422),
      pt(0.399, 0.69),
      pt(0.5, 0.69),
      pt(0.6, 0.69),
    ],
    readingBays: [
      {
        id: 'TQB_101_GATE',
        nameVi: 'Khu Cửa Từ & Quầy Tiếp Đón',
        shortLabel: 'Cửa từ',
        descriptionVi:
          'Khu vực kiểm soát thẻ ra vào và hướng dẫn bạn đọc tại sảnh chính',
        posX: 0.5,
        posY: 0.805,
        seatCapacity: 30,
        tags: ['multimedia'],
        microOffsets: {
          tempDelta: 0.6,
          noiseDelta: 4.5,
          luxDelta: 80,
          pm25Delta: 3.5,
          humidityDelta: 1.8,
          rssiDelta: 4,
          comfortDelta: -5,
        },
      },
      {
        id: 'TQB_101_ATRIUM_W',
        nameVi: 'Sảnh Triển Lãm & Chờ Cánh Tây',
        shortLabel: 'Sảnh Tây',
        descriptionVi:
          'Không gian trưng bày sách mới và ghế chờ sảnh Tây cạnh cầu thang lượn',
        posX: 0.38,
        posY: 0.56,
        seatCapacity: 80,
        tags: ['window'],
        microOffsets: {
          tempDelta: -0.2,
          noiseDelta: -1.5,
          luxDelta: 45,
          pm25Delta: -1.0,
          humidityDelta: -0.5,
          rssiDelta: 2,
          comfortDelta: 3,
        },
      },
      {
        id: 'TQB_101_ATRIUM_E',
        nameVi: 'Sảnh Tra Cứu Kiosk Cánh Đông',
        shortLabel: 'Sảnh Đông',
        descriptionVi:
          'Khu vực đặt máy Kiosk tra cứu OPAC và bản đồ nhiệt sảnh Đông',
        posX: 0.62,
        posY: 0.56,
        seatCapacity: 80,
        tags: ['multimedia', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.4,
          noiseDelta: 0.5,
          luxDelta: 30,
          pm25Delta: 0.0,
          humidityDelta: 0.0,
          rssiDelta: 6,
          comfortDelta: 2,
        },
      },
    ],
  },
  {
    code: 'TQB_102',
    legacyCodes: ['ROOM_102_F1'],
    name: 'Khu Nhập & Phân Loại Sách Đĩa',
    floor: 1,
    roomType: 'BOOK_STORAGE',
    capacity: 45,
    areaM2: 367.48,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.398, 0.068),
      pt(0.602, 0.068),
      pt(0.602, 0.212),
      pt(0.698, 0.212),
      pt(0.698, 0.34),
      pt(0.302, 0.34),
      pt(0.302, 0.212),
      pt(0.398, 0.212),
    ],
    doorPosition: pt(0.5, 0.34),
    nearestLandmarkId: 'ELEV_W',
    structuralColumns: [pt(0.5, 0.205)],
    readingBays: [
      {
        id: 'TQB_102_CATALOG',
        nameVi: 'Phân Khu Biên Mục & Mã Hóa RFID',
        shortLabel: 'Biên mục RFID',
        descriptionVi:
          'Khu vực xử lý nghiệp vụ biên mục tài liệu và dán nhãn RFID',
        posX: 0.5,
        posY: 0.165,
        seatCapacity: 25,
        tags: ['quiet', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.5,
          noiseDelta: -3.0,
          luxDelta: 40,
          pm25Delta: -2.0,
          humidityDelta: -2.5,
          rssiDelta: 3,
          comfortDelta: 4,
        },
      },
      {
        id: 'TQB_102_SORT',
        nameVi: 'Phân Khu Tập Kết & Phân Loại Sách',
        shortLabel: 'Phân loại sách',
        descriptionVi:
          'Khu vực tiếp nhận và phân bổ tài liệu về các kho tầng',
        posX: 0.48,
        posY: 0.285,
        seatCapacity: 20,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: 0.3,
          noiseDelta: 2.0,
          luxDelta: -10,
          pm25Delta: 2.5,
          humidityDelta: 1.5,
          rssiDelta: -2,
          comfortDelta: -2,
        },
      },
    ],
  },
  {
    code: 'TQB_103',
    legacyCodes: ['ROOM_101', 'STORAGE_103W'],
    name: 'Kho Sách Tầng 1 - Cánh Tây (264.7 m²)',
    floor: 1,
    roomType: 'BOOK_STORAGE',
    capacity: 25,
    areaM2: 264.7,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.021, 0.422),
      pt(0.234, 0.422),
      pt(0.234, 0.506),
      pt(0.2, 0.506),
      pt(0.2, 0.566),
      pt(0.234, 0.566),
      pt(0.234, 0.695),
      pt(0.021, 0.695),
    ],
    doorPosition: pt(0.15, 0.422),
    nearestLandmarkId: 'STAIR_SW',
    structuralColumns: TQB_WEST_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_103_STACK_N',
        nameVi: 'Kệ Kho Lưu Trữ Tây Bắc (Khu A)',
        shortLabel: 'Kệ Kho A',
        descriptionVi:
          'Dãy giá sách lưu trữ tài liệu khoa học kỹ thuật - yêu cầu kiểm soát ẩm < 60%',
        posX: 0.115,
        posY: 0.485,
        seatCapacity: 12,
        tags: ['quiet', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.6,
          noiseDelta: -5.0,
          luxDelta: -60,
          pm25Delta: -2.0,
          humidityDelta: -1.5,
          rssiDelta: -4,
          comfortDelta: 3,
        },
      },
      {
        id: 'TQB_103_STACK_S',
        nameVi: 'Kệ Kho Lưu Trữ Tây Nam (Khu B)',
        shortLabel: 'Kệ Kho B',
        descriptionVi:
          'Dãy giá sách áp tường hướng Tây Nam dễ chịu tác động nhiệt chiều',
        posX: 0.115,
        posY: 0.625,
        seatCapacity: 13,
        tags: ['quiet'],
        microOffsets: {
          tempDelta: 0.7,
          noiseDelta: -4.0,
          luxDelta: -40,
          pm25Delta: 1.0,
          humidityDelta: 2.2,
          rssiDelta: -7,
          comfortDelta: -3,
        },
      },
    ],
  },
  {
    code: 'TQB_104',
    legacyCodes: ['ROOM_102', 'STORAGE_104E'],
    name: 'Kho Sách Tầng 1 - Cánh Đông (264.7 m²)',
    floor: 1,
    roomType: 'BOOK_STORAGE',
    capacity: 25,
    areaM2: 264.7,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.766, 0.422),
      pt(0.979, 0.422),
      pt(0.979, 0.695),
      pt(0.766, 0.695),
      pt(0.766, 0.566),
      pt(0.8, 0.566),
      pt(0.8, 0.506),
      pt(0.766, 0.506),
    ],
    doorPosition: pt(0.85, 0.422),
    nearestLandmarkId: 'STAIR_SE',
    structuralColumns: TQB_EAST_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_104_STACK_N',
        nameVi: 'Kệ Kho Lưu Trữ Đông Bắc (Khu C)',
        shortLabel: 'Kệ Kho C',
        descriptionVi: 'Khu bảo quản luận văn và tạp chí đóng tập cánh Đông',
        posX: 0.885,
        posY: 0.485,
        seatCapacity: 12,
        tags: ['quiet', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.4,
          noiseDelta: -5.0,
          luxDelta: -50,
          pm25Delta: -1.5,
          humidityDelta: -1.0,
          rssiDelta: -3,
          comfortDelta: 2,
        },
      },
      {
        id: 'TQB_104_STACK_S',
        nameVi: 'Kệ Kho Lưu Trữ Đông Nam (Khu D)',
        shortLabel: 'Kệ Kho D',
        descriptionVi: 'Khu vực kệ sách mật độ cao cánh Đông Nam',
        posX: 0.885,
        posY: 0.625,
        seatCapacity: 13,
        tags: ['quiet'],
        microOffsets: {
          tempDelta: 0.4,
          noiseDelta: -4.5,
          luxDelta: -55,
          pm25Delta: 0.5,
          humidityDelta: 2.5,
          rssiDelta: -6,
          comfortDelta: -2,
        },
      },
    ],
  },
  {
    code: 'TQB_105',
    name: 'Căng Tin Giải Khát & Không Gian Mở',
    floor: 1,
    roomType: 'CIRCULATION_HALL',
    capacity: 65,
    areaM2: 97.81,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.021, 0.122),
      pt(0.121, 0.122),
      pt(0.121, 0.342),
      pt(0.021, 0.342),
    ],
    doorPosition: pt(0.121, 0.31),
    nearestLandmarkId: 'STAIR_NW',
    readingBays: [
      {
        id: 'TQB_105_CAFE',
        nameVi: 'Khu Bàn Giải Khát Cửa Sổ Tây Bắc',
        shortLabel: 'Bàn Căng tin',
        descriptionVi:
          'Khu vực nghỉ ngơi, giải khát cho sinh viên tại cánh Tây Bắc Tầng 1',
        posX: 0.071,
        posY: 0.23,
        seatCapacity: 65,
        tags: ['window', 'group'],
        microOffsets: {
          tempDelta: 0.5,
          noiseDelta: 5.5,
          luxDelta: 90,
          pm25Delta: 2.0,
          humidityDelta: 1.5,
          rssiDelta: 1,
          comfortDelta: -3,
        },
      },
    ],
  },
  {
    code: 'TQB_106',
    name: 'Phòng Đóng Sách & Trung Tâm Kỹ Thuật ĐHKK',
    floor: 1,
    roomType: 'BOOK_STORAGE',
    capacity: 20,
    areaM2: 101.21,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.879, 0.122),
      pt(0.979, 0.122),
      pt(0.979, 0.342),
      pt(0.879, 0.342),
    ],
    doorPosition: pt(0.879, 0.31),
    nearestLandmarkId: 'STAIR_NE',
    readingBays: [
      {
        id: 'TQB_106_TECH',
        nameVi: 'Phân Khu Đóng Sách & Trạm Điều Hòa',
        shortLabel: 'Kỹ thuật & Đóng sách',
        descriptionVi:
          'Phòng phục chế đóng sách và giám sát hệ thống điều hòa trung tâm',
        posX: 0.929,
        posY: 0.23,
        seatCapacity: 20,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: -0.8,
          noiseDelta: 3.0,
          luxDelta: 10,
          pm25Delta: 0.0,
          humidityDelta: -2.0,
          rssiDelta: -2,
          comfortDelta: 1,
        },
      },
    ],
  },
  {
    code: 'TQB_107',
    name: 'Phòng Gửi Mũ Áo & Dịch Vụ Bạn Đọc',
    floor: 1,
    roomType: 'CIRCULATION_HALL',
    capacity: 40,
    areaM2: 112.7,
    zoneCode: 'ZONE_HALL',
    boundaryPolygon: [
      pt(0.301, 0.778),
      pt(0.398, 0.778),
      pt(0.398, 0.927),
      pt(0.301, 0.927),
    ],
    doorPosition: pt(0.392, 0.79),
    nearestLandmarkId: 'STAIR_SW',
    readingBays: [
      {
        id: 'TQB_107_LOCKER',
        nameVi: 'Khu Tủ Đồ Cá Nhân (Locker)',
        shortLabel: 'Tủ gửi đồ',
        descriptionVi:
          'Phòng gửi balo, mũ áo trước khi qua cổng từ vào khu đọc sách',
        posX: 0.35,
        posY: 0.852,
        seatCapacity: 40,
        tags: ['multimedia'],
        microOffsets: {
          tempDelta: 0.3,
          noiseDelta: 2.5,
          luxDelta: 15,
          pm25Delta: 1.0,
          humidityDelta: 0.8,
          rssiDelta: 2,
          comfortDelta: 0,
        },
      },
    ],
  },

  // ============================================================================
  // TẦNG 2 (Trang 2 - Tổng diện tích 3719.54 m², Thông tầng 374.8 m²)
  // ============================================================================
  {
    code: 'TQB_201',
    legacyCodes: ['ROOM_201'],
    name: 'Phòng Multimedia & Mượn Giáo Trình Tầng 2',
    floor: 2,
    roomType: 'STUDY_ROOM',
    capacity: 180,
    areaM2: 570.57,
    zoneCode: 'ZONE_C',
    boundaryPolygon: [
      pt(0.301, 0.008),
      pt(0.699, 0.008),
      pt(0.699, 0.194),
      pt(0.654, 0.194),
      pt(0.654, 0.32),
      pt(0.346, 0.32),
      pt(0.346, 0.194),
      pt(0.301, 0.194),
    ],
    doorPosition: pt(0.43, 0.32),
    nearestLandmarkId: 'ELEV_W',
    structuralColumns: TQB_NORTH_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_201_WINDOW',
        nameVi: 'Dãy Bàn Kính Cửa Sổ Bắc',
        shortLabel: 'Dãy Cửa sổ Bắc',
        descriptionVi:
          'Dãy bàn nhìn ra mặt tiền Bắc, ánh sáng tự nhiên dồi dào',
        posX: 0.5,
        posY: 0.075,
        seatCapacity: 65,
        tags: ['window', 'multimedia'],
        microOffsets: {
          tempDelta: 0.6,
          noiseDelta: -2.0,
          luxDelta: 95,
          pm25Delta: -1.0,
          humidityDelta: -1.0,
          rssiDelta: 2,
          comfortDelta: 2,
        },
      },
      {
        id: 'TQB_201_CENTER',
        nameVi: 'Khu Máy Tính Tra Cứu Trung Tâm',
        shortLabel: 'Khu PC Trung tâm',
        descriptionVi:
          'Dãy bàn trang bị máy trạm tra cứu CSDL điện tử tốc độ cao',
        posX: 0.5,
        posY: 0.175,
        seatCapacity: 75,
        tags: ['multimedia', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.7,
          noiseDelta: 0.5,
          luxDelta: 20,
          pm25Delta: 0.0,
          humidityDelta: -1.5,
          rssiDelta: 6,
          comfortDelta: 4,
        },
      },
      {
        id: 'TQB_201_DESK',
        nameVi: 'Khu Gần Quầy Mượn & Cửa Ra Vào',
        shortLabel: 'Khu Quầy mượn',
        descriptionVi: 'Khu vực bàn đọc nhanh gần quầy thủ thư cho mượn sách',
        posX: 0.5,
        posY: 0.275,
        seatCapacity: 40,
        tags: ['group'],
        microOffsets: {
          tempDelta: 0.3,
          noiseDelta: 4.0,
          luxDelta: -15,
          pm25Delta: 1.5,
          humidityDelta: 1.0,
          rssiDelta: 4,
          comfortDelta: -3,
        },
      },
    ],
  },
  {
    code: 'TQB_202',
    name: 'Phòng Đọc Tổng Hợp Cánh Tây 202',
    floor: 2,
    roomType: 'STUDY_ROOM',
    capacity: 110,
    areaM2: 301.3,
    zoneCode: 'ZONE_C',
    boundaryPolygon: [
      pt(0.008, 0.401),
      pt(0.235, 0.401),
      pt(0.235, 0.506),
      pt(0.2, 0.506),
      pt(0.2, 0.566),
      pt(0.235, 0.566),
      pt(0.235, 0.692),
      pt(0.008, 0.692),
    ],
    doorPosition: pt(0.235, 0.625),
    nearestLandmarkId: 'STAIR_SW',
    structuralColumns: TQB_WEST_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_202_QUIET',
        nameVi: 'Góc Tự Học Yên Tĩnh Sát Cửa Sổ Tây',
        shortLabel: 'Góc Yên tĩnh',
        descriptionVi:
          'Khu bàn đọc cá nhân cách biệt khỏi hành lang và quầy thủ thư',
        posX: 0.075,
        posY: 0.48,
        seatCapacity: 55,
        tags: ['quiet', 'window'],
        microOffsets: {
          tempDelta: -0.3,
          noiseDelta: -5.5,
          luxDelta: 60,
          pm25Delta: -1.5,
          humidityDelta: -0.5,
          rssiDelta: -2,
          comfortDelta: 5,
        },
      },
      {
        id: 'TQB_202_MAIN',
        nameVi: 'Khu Bàn Đọc Trung Tâm & Kho Mở',
        shortLabel: 'Bàn Trung tâm',
        descriptionVi: 'Khu bàn đọc chính cạnh giá sách mở tự chọn',
        posX: 0.145,
        posY: 0.61,
        seatCapacity: 55,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: -0.6,
          noiseDelta: 1.5,
          luxDelta: 10,
          pm25Delta: 0.5,
          humidityDelta: 0.0,
          rssiDelta: 4,
          comfortDelta: 2,
        },
      },
    ],
  },
  {
    code: 'TQB_203',
    name: 'Phòng Đọc Tổng Hợp Cánh Đông 203',
    floor: 2,
    roomType: 'STUDY_ROOM',
    capacity: 110,
    areaM2: 301.3,
    zoneCode: 'ZONE_C',
    boundaryPolygon: [
      pt(0.765, 0.401),
      pt(0.992, 0.401),
      pt(0.992, 0.692),
      pt(0.765, 0.692),
      pt(0.765, 0.566),
      pt(0.8, 0.566),
      pt(0.8, 0.506),
      pt(0.765, 0.506),
    ],
    doorPosition: pt(0.765, 0.625),
    nearestLandmarkId: 'STAIR_SE',
    structuralColumns: TQB_EAST_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_203_QUIET',
        nameVi: 'Góc Tự Học Ánh Sáng Tự Nhiên Đông',
        shortLabel: 'Dãy Cửa sổ Đông',
        descriptionVi:
          'Dãy bàn hướng Đông mát mẻ vào buổi chiều, rất yên tĩnh',
        posX: 0.92,
        posY: 0.48,
        seatCapacity: 55,
        tags: ['quiet', 'window', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.8,
          noiseDelta: -5.0,
          luxDelta: 55,
          pm25Delta: -2.0,
          humidityDelta: -1.0,
          rssiDelta: 1,
          comfortDelta: 6,
        },
      },
      {
        id: 'TQB_203_MAIN',
        nameVi: 'Khu Bàn Đọc Cạnh Quầy Mượn',
        shortLabel: 'Khu Quầy mượn',
        descriptionVi: 'Khu vực bàn đọc gần lối vào và quầy mượn trả',
        posX: 0.85,
        posY: 0.615,
        seatCapacity: 55,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: 0.2,
          noiseDelta: 2.5,
          luxDelta: 0,
          pm25Delta: 1.0,
          humidityDelta: 0.5,
          rssiDelta: 5,
          comfortDelta: 0,
        },
      },
    ],
  },

  // ============================================================================
  // TẦNG 3 (Trang 3 - Tổng diện tích 3550.89 m², Thông tầng 417.87 m²)
  // ============================================================================
  {
    code: 'TQB_301',
    legacyCodes: ['ROOM_301'],
    name: 'Phòng Đa Phương Tiện (Multimedia 301)',
    floor: 3,
    roomType: 'STUDY_ROOM',
    capacity: 200,
    areaM2: 570.57,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.301, 0.008),
      pt(0.699, 0.008),
      pt(0.699, 0.194),
      pt(0.654, 0.194),
      pt(0.654, 0.32),
      pt(0.346, 0.32),
      pt(0.346, 0.194),
      pt(0.301, 0.194),
    ],
    doorPosition: pt(0.43, 0.32),
    nearestLandmarkId: 'ELEV_W',
    structuralColumns: TQB_NORTH_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_301_WINDOW_NW',
        nameVi: 'Dãy Bàn Sát Cửa Sổ Kính Bắc (Tây)',
        shortLabel: 'Cửa sổ Tây Bắc',
        descriptionVi:
          'Dãy bàn nhìn ra quảng trường phía Bắc, độ rọi sáng tự nhiên cao (420–550 lx)',
        posX: 0.385,
        posY: 0.082,
        seatCapacity: 50,
        tags: ['window', 'multimedia'],
        microOffsets: {
          tempDelta: 0.8,
          noiseDelta: -3.0,
          luxDelta: 110,
          pm25Delta: -1.0,
          humidityDelta: -1.5,
          rssiDelta: 1,
          comfortDelta: 2,
        },
      },
      {
        id: 'TQB_301_WINDOW_NE',
        nameVi: 'Dãy Bàn Sát Cửa Sổ Kính Bắc (Đông)',
        shortLabel: 'Cửa sổ Đông Bắc',
        descriptionVi:
          'Góc tự học yên tĩnh sát vách kính Đông Bắc, mát mẻ và đủ sáng',
        posX: 0.615,
        posY: 0.082,
        seatCapacity: 50,
        tags: ['quiet', 'window', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.6,
          noiseDelta: -5.5,
          luxDelta: 75,
          pm25Delta: -2.0,
          humidityDelta: -1.0,
          rssiDelta: 2,
          comfortDelta: 6,
        },
      },
      {
        id: 'TQB_301_CENTER_HUB',
        nameVi: 'Khu Bàn Máy Trạm Trung Tâm',
        shortLabel: 'Bàn Trung tâm',
        descriptionVi:
          'Khu trung tâm dưới họng gió điều hòa chính và Access Point Wi-Fi 6',
        posX: 0.5,
        posY: 0.165,
        seatCapacity: 60,
        tags: ['multimedia', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.9,
          noiseDelta: 0.5,
          luxDelta: 25,
          pm25Delta: -0.5,
          humidityDelta: -2.0,
          rssiDelta: 8,
          comfortDelta: 5,
        },
      },
      {
        id: 'TQB_301_ENTRANCE',
        nameVi: 'Khu Bàn Gần Quầy Mượn & Cửa Chính',
        shortLabel: 'Gần Cửa ra vào',
        descriptionVi:
          'Phù hợp tra cứu nhanh và trao đổi ngắn gần quầy thủ thư',
        posX: 0.5,
        posY: 0.275,
        seatCapacity: 40,
        tags: ['multimedia'],
        microOffsets: {
          tempDelta: 0.7,
          noiseDelta: 4.8,
          luxDelta: -20,
          pm25Delta: 2.0,
          humidityDelta: 1.5,
          rssiDelta: 5,
          comfortDelta: -4,
        },
      },
    ],
  },
  {
    code: 'TQB_302',
    legacyCodes: ['ROOM_302'],
    name: 'Phòng Đọc Lớn Cánh Tây 302 (Kèm Kho Mở)',
    floor: 3,
    roomType: 'STUDY_ROOM',
    capacity: 120,
    areaM2: 301.3,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.008, 0.401),
      pt(0.235, 0.401),
      pt(0.235, 0.506),
      pt(0.2, 0.506),
      pt(0.2, 0.566),
      pt(0.235, 0.566),
      pt(0.235, 0.692),
      pt(0.008, 0.692),
    ],
    doorPosition: pt(0.235, 0.625),
    nearestLandmarkId: 'STAIR_SW',
    structuralColumns: TQB_WEST_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_302_QUIET_CORNER',
        nameVi: 'Góc Tự Học Yên Tĩnh Trong Cùng (Tây Bắc)',
        shortLabel: 'Góc Yên tĩnh',
        descriptionVi:
          'Tách biệt hoàn toàn khỏi cửa ra vào bởi vách ngăn kho sách, độ ồn rất thấp (< 39 dBA)',
        posX: 0.068,
        posY: 0.465,
        seatCapacity: 45,
        tags: ['quiet', 'window'],
        microOffsets: {
          tempDelta: -0.4,
          noiseDelta: -6.5,
          luxDelta: 50,
          pm25Delta: -2.0,
          humidityDelta: -0.5,
          rssiDelta: -3,
          comfortDelta: 7,
        },
      },
      {
        id: 'TQB_302_WINDOW_SW',
        nameVi: 'Dãy Bàn Cửa Sổ Tây Nam',
        shortLabel: 'Dãy Cửa sổ Tây',
        descriptionVi:
          'Dãy bàn dọc mặt dựng kính hướng Tây, nhiều ánh sáng tự nhiên',
        posX: 0.068,
        posY: 0.625,
        seatCapacity: 40,
        tags: ['window'],
        microOffsets: {
          tempDelta: 1.1,
          noiseDelta: -2.0,
          luxDelta: 130,
          pm25Delta: 0.0,
          humidityDelta: -1.5,
          rssiDelta: -1,
          comfortDelta: -2,
        },
      },
      {
        id: 'TQB_302_STACKS_EAST',
        nameVi: 'Khu Giá Sách Mở & Quầy Mượn 302',
        shortLabel: 'Khu Kho mở & Quầy',
        descriptionVi:
          'Khu vực giá sách tự chọn và bàn tra cứu cạnh cửa vào hành lang',
        posX: 0.175,
        posY: 0.555,
        seatCapacity: 35,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: -0.5,
          noiseDelta: 3.5,
          luxDelta: -25,
          pm25Delta: 1.0,
          humidityDelta: 0.8,
          rssiDelta: 4,
          comfortDelta: 1,
        },
      },
    ],
  },
  {
    code: 'TQB_303',
    name: 'Phòng Đọc Lớn Cánh Đông 303 (Kèm Kho Mở)',
    floor: 3,
    roomType: 'STUDY_ROOM',
    capacity: 120,
    areaM2: 301.3,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.765, 0.401),
      pt(0.992, 0.401),
      pt(0.992, 0.692),
      pt(0.765, 0.692),
      pt(0.765, 0.566),
      pt(0.8, 0.566),
      pt(0.8, 0.506),
      pt(0.765, 0.506),
    ],
    doorPosition: pt(0.765, 0.625),
    nearestLandmarkId: 'STAIR_SE',
    structuralColumns: TQB_EAST_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_303_QUIET_NE',
        nameVi: 'Góc Tự Học Yên Tĩnh Sát Cửa Sổ Đông',
        shortLabel: 'Góc Yên tĩnh Đông',
        descriptionVi:
          'Không bị nắng gắt buổi chiều, nhiệt độ mát sâu và cực kỳ yên tĩnh',
        posX: 0.93,
        posY: 0.465,
        seatCapacity: 45,
        tags: ['quiet', 'window', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.8,
          noiseDelta: -6.0,
          luxDelta: 65,
          pm25Delta: -2.5,
          humidityDelta: -1.0,
          rssiDelta: 2,
          comfortDelta: 8,
        },
      },
      {
        id: 'TQB_303_CENTER_SE',
        nameVi: 'Khu Bàn Đọc Chính Đông Nam',
        shortLabel: 'Bàn Đọc Đông Nam',
        descriptionVi: 'Khu bàn đọc rộng rãi cho sinh viên ôn thi cá nhân',
        posX: 0.925,
        posY: 0.625,
        seatCapacity: 40,
        tags: ['quiet', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.3,
          noiseDelta: -2.5,
          luxDelta: 40,
          pm25Delta: -1.0,
          humidityDelta: 0.0,
          rssiDelta: 3,
          comfortDelta: 4,
        },
      },
      {
        id: 'TQB_303_DESK_WEST',
        nameVi: 'Khu Quầy Mượn & Giá Sách Mở 303',
        shortLabel: 'Khu Quầy & Kệ sách',
        descriptionVi:
          'Gần cửa thông ra hành lang vòng và thang bộ Đông Nam',
        posX: 0.825,
        posY: 0.555,
        seatCapacity: 35,
        tags: ['multimedia'],
        microOffsets: {
          tempDelta: 0.4,
          noiseDelta: 3.8,
          luxDelta: -15,
          pm25Delta: 1.5,
          humidityDelta: 1.0,
          rssiDelta: 5,
          comfortDelta: -2,
        },
      },
    ],
  },
  {
    code: 'TQB_304',
    name: 'Phòng Đọc Sách Chuyên Đề Tây Bắc 304',
    floor: 3,
    roomType: 'STUDY_ROOM',
    capacity: 56,
    areaM2: 127.14,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.008, 0.083),
      pt(0.122, 0.083),
      pt(0.122, 0.323),
      pt(0.008, 0.323),
    ],
    doorPosition: pt(0.06, 0.323),
    nearestLandmarkId: 'STAIR_NW',
    readingBays: [
      {
        id: 'TQB_304_NORTH',
        nameVi: 'Góc Đọc Sách Yên Tĩnh Cửa Sổ Bắc',
        shortLabel: 'Góc Bắc 304',
        descriptionVi:
          'Phòng đọc quy mô vừa (127 m²), độ ồn thấp lý tưởng để đọc sâu',
        posX: 0.065,
        posY: 0.145,
        seatCapacity: 28,
        tags: ['quiet', 'window'],
        microOffsets: {
          tempDelta: -0.4,
          noiseDelta: -5.0,
          luxDelta: 55,
          pm25Delta: -1.5,
          humidityDelta: -0.5,
          rssiDelta: 1,
          comfortDelta: 5,
        },
      },
      {
        id: 'TQB_304_SOUTH',
        nameVi: 'Dãy Bàn Đọc Phía Nam 304',
        shortLabel: 'Dãy Nam 304',
        descriptionVi: 'Gần lối vào từ hành lang Tây Bắc và khu WC',
        posX: 0.065,
        posY: 0.255,
        seatCapacity: 28,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: 0.2,
          noiseDelta: 1.5,
          luxDelta: 15,
          pm25Delta: 0.5,
          humidityDelta: 0.5,
          rssiDelta: 3,
          comfortDelta: 1,
        },
      },
    ],
  },
  {
    code: 'TQB_305',
    name: 'Phòng Đọc Sách Chuyên Đề Đông Bắc 305',
    floor: 3,
    roomType: 'STUDY_ROOM',
    capacity: 56,
    areaM2: 127.14,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.878, 0.083),
      pt(0.992, 0.083),
      pt(0.992, 0.323),
      pt(0.878, 0.323),
    ],
    doorPosition: pt(0.94, 0.323),
    nearestLandmarkId: 'STAIR_NE',
    readingBays: [
      {
        id: 'TQB_305_NORTH',
        nameVi: 'Góc Đọc Sách Yên Tĩnh Cửa Sổ Đông Bắc',
        shortLabel: 'Góc Bắc 305',
        descriptionVi:
          'Không gian yên tĩnh tuyệt đối, ánh sáng dịu ổn định cả ngày',
        posX: 0.935,
        posY: 0.145,
        seatCapacity: 28,
        tags: ['quiet', 'window', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.6,
          noiseDelta: -5.5,
          luxDelta: 60,
          pm25Delta: -2.0,
          humidityDelta: -1.0,
          rssiDelta: 2,
          comfortDelta: 6,
        },
      },
      {
        id: 'TQB_305_SOUTH',
        nameVi: 'Dãy Bàn Đọc Phía Nam 305',
        shortLabel: 'Dãy Nam 305',
        descriptionVi: 'Dãy bàn gần cửa ra hành lang Đông Bắc',
        posX: 0.935,
        posY: 0.255,
        seatCapacity: 28,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: 0.1,
          noiseDelta: 1.2,
          luxDelta: 20,
          pm25Delta: 0.0,
          humidityDelta: 0.5,
          rssiDelta: 4,
          comfortDelta: 2,
        },
      },
    ],
  },
  {
    code: 'TQB_306',
    name: 'Phòng Truyền Thống & Lưu Trữ Quý Hiếm',
    floor: 3,
    roomType: 'BOOK_STORAGE',
    capacity: 60,
    areaM2: 225.0,
    zoneCode: 'ZONE_C',
    boundaryPolygon: [
      pt(0.4, 0.752),
      pt(0.6, 0.752),
      pt(0.6, 0.968),
      pt(0.4, 0.968),
    ],
    doorPosition: pt(0.5, 0.752),
    nearestLandmarkId: 'ELEV_E',
    readingBays: [
      {
        id: 'TQB_306_ARCHIVE',
        nameVi: 'Không Gian Trưng Bày Hiện Vật & Ấn Phẩm Quý',
        shortLabel: 'Tủ Hiện vật Quý',
        descriptionVi:
          'Yêu cầu kiểm soát nghiêm ngặt Độ ẩm (< 60%RH) và Ánh sáng để bảo vệ tư liệu lịch sử',
        posX: 0.5,
        posY: 0.82,
        seatCapacity: 30,
        tags: ['quiet', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.7,
          noiseDelta: -4.5,
          luxDelta: -40,
          pm25Delta: -2.5,
          humidityDelta: -2.0,
          rssiDelta: 2,
          comfortDelta: 4,
        },
      },
      {
        id: 'TQB_306_SOUTH',
        nameVi: 'Khu Đọc Tư Liệu Lịch Sử Mặt Nam',
        shortLabel: 'Bàn Tư liệu Nam',
        descriptionVi:
          'Khu vực tra cứu tư liệu truyền thống sát vách kính mặt tiền Nam',
        posX: 0.5,
        posY: 0.92,
        seatCapacity: 30,
        tags: ['window', 'quiet'],
        microOffsets: {
          tempDelta: 0.5,
          noiseDelta: -3.0,
          luxDelta: 50,
          pm25Delta: 0.0,
          humidityDelta: 1.8,
          rssiDelta: -1,
          comfortDelta: 1,
        },
      },
    ],
  },
  {
    code: 'TQB_307',
    name: 'Khu Dịch Vụ Sao Chụp & In Ấn 307',
    floor: 3,
    roomType: 'CIRCULATION_HALL',
    capacity: 30,
    areaM2: 96.16,
    zoneCode: 'ZONE_HALL',
    boundaryPolygon: [
      pt(0.301, 0.785),
      pt(0.398, 0.785),
      pt(0.398, 0.955),
      pt(0.301, 0.955),
    ],
    doorPosition: pt(0.39, 0.785),
    nearestLandmarkId: 'STAIR_SW',
    readingBays: [
      {
        id: 'TQB_307_COPY',
        nameVi: 'Quầy Photocopy & Đóng Quyển Luận Văn',
        shortLabel: 'Sao chụp & In',
        descriptionVi:
          'Khu vực máy photocopy công suất lớn — lưu ý kiểm soát bụi mịn mực in PM2.5 và tiếng ồn',
        posX: 0.35,
        posY: 0.865,
        seatCapacity: 30,
        tags: ['multimedia'],
        microOffsets: {
          tempDelta: 0.9,
          noiseDelta: 6.5,
          luxDelta: 10,
          pm25Delta: 4.5,
          humidityDelta: -1.0,
          rssiDelta: 1,
          comfortDelta: -6,
        },
      },
    ],
  },
  {
    code: 'TQB_308',
    name: 'Quầy Mượn Liên Thư Viện 308',
    floor: 3,
    roomType: 'CIRCULATION_HALL',
    capacity: 30,
    areaM2: 96.16,
    zoneCode: 'ZONE_HALL',
    boundaryPolygon: [
      pt(0.602, 0.785),
      pt(0.699, 0.785),
      pt(0.699, 0.955),
      pt(0.602, 0.955),
    ],
    doorPosition: pt(0.61, 0.785),
    nearestLandmarkId: 'STAIR_SE',
    readingBays: [
      {
        id: 'TQB_308_ILL',
        nameVi: 'Quầy Giao Dịch Mượn Liên Thư Viện',
        shortLabel: 'Liên thư viện',
        descriptionVi:
          'Khu vực tiếp nhận yêu cầu mượn tài liệu liên trường và tư vấn thông tin',
        posX: 0.65,
        posY: 0.865,
        seatCapacity: 30,
        tags: ['multimedia', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.2,
          noiseDelta: 1.5,
          luxDelta: 25,
          pm25Delta: 0.0,
          humidityDelta: 0.0,
          rssiDelta: 4,
          comfortDelta: 2,
        },
      },
    ],
  },

  // ============================================================================
  // TẦNG 4 (Trang 4 - Tổng diện tích 3550.89 m², Thông tầng 417.87 m²)
  // ============================================================================
  {
    code: 'TQB_401',
    name: 'Phòng Đọc Chuyên Ngành Trung Tâm 401',
    floor: 4,
    roomType: 'STUDY_ROOM',
    capacity: 200,
    areaM2: 570.57,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.301, 0.008),
      pt(0.699, 0.008),
      pt(0.699, 0.32),
      pt(0.301, 0.32),
    ],
    doorPosition: pt(0.43, 0.32),
    nearestLandmarkId: 'ELEV_W',
    structuralColumns: TQB_NORTH_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_401_WINDOW',
        nameVi: 'Dãy Bàn Kính Cửa Sổ Bắc 401',
        shortLabel: 'Cửa sổ Bắc',
        descriptionVi: 'Dãy bàn tự học ánh sáng tự nhiên mặt Bắc',
        posX: 0.5,
        posY: 0.085,
        seatCapacity: 100,
        tags: ['quiet', 'window'],
        microOffsets: {
          tempDelta: 0.3,
          noiseDelta: -4.0,
          luxDelta: 80,
          pm25Delta: -1.5,
          humidityDelta: -1.0,
          rssiDelta: 2,
          comfortDelta: 4,
        },
      },
      {
        id: 'TQB_401_CENTER',
        nameVi: 'Khu Bàn Đọc Trung Tâm 401',
        shortLabel: 'Trung tâm 401',
        descriptionVi:
          'Khu bàn đọc chuyên ngành kỹ thuật dưới giàn lạnh trung tâm',
        posX: 0.5,
        posY: 0.22,
        seatCapacity: 100,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: -0.6,
          noiseDelta: 1.0,
          luxDelta: 20,
          pm25Delta: 0.0,
          humidityDelta: 0.0,
          rssiDelta: 6,
          comfortDelta: 3,
        },
      },
    ],
  },
  {
    code: 'TQB_402',
    name: 'Phòng Đọc Chuyên Ngành Nam 402',
    floor: 4,
    roomType: 'STUDY_ROOM',
    capacity: 130,
    areaM2: 332.62,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.301, 0.756),
      pt(0.699, 0.756),
      pt(0.699, 0.937),
      pt(0.301, 0.937),
    ],
    doorPosition: pt(0.5, 0.756),
    nearestLandmarkId: 'STAIR_SW',
    readingBays: [
      {
        id: 'TQB_402_WEST',
        nameVi: 'Phân Khu Đọc Tây Nam 402',
        shortLabel: 'Khu Tây 402',
        descriptionVi: 'Khu bàn đọc chuyên ngành Điện - Điện tử - CNTT',
        posX: 0.4,
        posY: 0.845,
        seatCapacity: 65,
        tags: ['quiet', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.4,
          noiseDelta: -3.5,
          luxDelta: 40,
          pm25Delta: -1.0,
          humidityDelta: 0.0,
          rssiDelta: 4,
          comfortDelta: 4,
        },
      },
      {
        id: 'TQB_402_EAST',
        nameVi: 'Phân Khu Đọc Đông Nam 402',
        shortLabel: 'Khu Đông 402',
        descriptionVi: 'Khu bàn đọc chuyên ngành Cơ khí - Hóa - Vật lý',
        posX: 0.6,
        posY: 0.845,
        seatCapacity: 65,
        tags: ['window', 'quiet'],
        microOffsets: {
          tempDelta: 0.2,
          noiseDelta: -2.0,
          luxDelta: 65,
          pm25Delta: 0.0,
          humidityDelta: 0.5,
          rssiDelta: 3,
          comfortDelta: 2,
        },
      },
    ],
  },

  // ============================================================================
  // TẦNG 5 (Trang 5 - Tổng diện tích 3408.03 m², Thông tầng 417.87 m²)
  // ============================================================================
  {
    code: 'TQB_501',
    name: 'Phòng Đọc Chuyên Ngành Lớn 501 (Cánh Bắc)',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 200,
    areaM2: 570.57,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.301, 0.008),
      pt(0.699, 0.008),
      pt(0.699, 0.32),
      pt(0.301, 0.32),
    ],
    doorPosition: pt(0.43, 0.32),
    nearestLandmarkId: 'ELEV_W',
    structuralColumns: TQB_NORTH_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_501_WINDOW_NW',
        nameVi: 'Dãy Bàn Kính Bắc - Góc Tự Học Sâu',
        shortLabel: 'Cửa sổ Tây Bắc',
        descriptionVi:
          'Tầm nhìn toàn cảnh khuôn viên Bách Khoa từ tầng 5, yên tĩnh tuyệt đối',
        posX: 0.385,
        posY: 0.08,
        seatCapacity: 55,
        tags: ['quiet', 'window'],
        microOffsets: {
          tempDelta: 0.4,
          noiseDelta: -6.0,
          luxDelta: 95,
          pm25Delta: -2.0,
          humidityDelta: -1.0,
          rssiDelta: 2,
          comfortDelta: 6,
        },
      },
      {
        id: 'TQB_501_WINDOW_NE',
        nameVi: 'Dãy Bàn Kính Đông Bắc - Đủ Sáng & Mát',
        shortLabel: 'Cửa sổ Đông Bắc',
        descriptionVi:
          'Độ rọi sáng tự nhiên chuẩn 450 lx, nhiệt độ mát ổn định 22.5°C',
        posX: 0.615,
        posY: 0.08,
        seatCapacity: 55,
        tags: ['quiet', 'window', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.7,
          noiseDelta: -5.5,
          luxDelta: 75,
          pm25Delta: -2.5,
          humidityDelta: -1.5,
          rssiDelta: 3,
          comfortDelta: 8,
        },
      },
      {
        id: 'TQB_501_CENTER',
        nameVi: 'Khu Bàn Đọc Trung Tâm 501',
        shortLabel: 'Khu Trung tâm',
        descriptionVi:
          'Khu vực trung tâm rộng rãi gần tủ sách tham khảo chuyên ngành',
        posX: 0.5,
        posY: 0.215,
        seatCapacity: 90,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: -0.5,
          noiseDelta: 1.5,
          luxDelta: 15,
          pm25Delta: 0.0,
          humidityDelta: 0.0,
          rssiDelta: 7,
          comfortDelta: 3,
        },
      },
    ],
  },
  {
    code: 'TQB_502',
    name: 'Phòng Đọc Chuyên Ngành Cánh Tây 502',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 115,
    areaM2: 301.3,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.008, 0.401),
      pt(0.235, 0.401),
      pt(0.235, 0.506),
      pt(0.2, 0.506),
      pt(0.2, 0.566),
      pt(0.235, 0.566),
      pt(0.235, 0.692),
      pt(0.008, 0.692),
    ],
    doorPosition: pt(0.235, 0.625),
    nearestLandmarkId: 'STAIR_SW',
    structuralColumns: TQB_WEST_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_502_QUIET',
        nameVi: 'Góc Tự Học Yên Tĩnh 502 (Phía Bắc)',
        shortLabel: 'Góc Yên tĩnh 502',
        descriptionVi:
          'Khu bàn cá nhân yên tĩnh cho sinh viên làm đồ án tốt nghiệp',
        posX: 0.08,
        posY: 0.475,
        seatCapacity: 60,
        tags: ['quiet', 'window'],
        microOffsets: {
          tempDelta: -0.3,
          noiseDelta: -5.5,
          luxDelta: 55,
          pm25Delta: -1.5,
          humidityDelta: -0.5,
          rssiDelta: 1,
          comfortDelta: 5,
        },
      },
      {
        id: 'TQB_502_SOUTH',
        nameVi: 'Dãy Bàn Đọc Phía Nam 502',
        shortLabel: 'Dãy Nam 502',
        descriptionVi: 'Khu bàn đọc gần cửa thông ra sảnh thang bộ Tây Nam',
        posX: 0.13,
        posY: 0.62,
        seatCapacity: 55,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: 0.5,
          noiseDelta: 2.0,
          luxDelta: 40,
          pm25Delta: 0.5,
          humidityDelta: 0.5,
          rssiDelta: 4,
          comfortDelta: 1,
        },
      },
    ],
  },
  {
    code: 'TQB_503',
    name: 'Phòng Đọc Chuyên Ngành Cánh Đông 503',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 115,
    areaM2: 301.3,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.765, 0.401),
      pt(0.992, 0.401),
      pt(0.992, 0.692),
      pt(0.765, 0.692),
      pt(0.765, 0.566),
      pt(0.8, 0.566),
      pt(0.8, 0.506),
      pt(0.765, 0.506),
    ],
    doorPosition: pt(0.765, 0.625),
    nearestLandmarkId: 'STAIR_SE',
    structuralColumns: TQB_EAST_HALL_COLUMNS,
    readingBays: [
      {
        id: 'TQB_503_QUIET',
        nameVi: 'Góc Tự Học Cửa Sổ Đông 503',
        shortLabel: 'Cửa sổ Đông 503',
        descriptionVi: 'Mát mẻ, yên tĩnh và ánh sáng tự nhiên ổn định',
        posX: 0.92,
        posY: 0.475,
        seatCapacity: 60,
        tags: ['quiet', 'window', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.7,
          noiseDelta: -5.0,
          luxDelta: 65,
          pm25Delta: -2.0,
          humidityDelta: -1.0,
          rssiDelta: 2,
          comfortDelta: 6,
        },
      },
      {
        id: 'TQB_503_SOUTH',
        nameVi: 'Khu Bàn Trung Tâm 503',
        shortLabel: 'Trung tâm 503',
        descriptionVi: 'Khu bàn đọc gần lối vào hành lang Đông',
        posX: 0.87,
        posY: 0.62,
        seatCapacity: 55,
        tags: ['ac_cool'],
        microOffsets: {
          tempDelta: -0.2,
          noiseDelta: 1.5,
          luxDelta: 15,
          pm25Delta: 0.0,
          humidityDelta: 0.0,
          rssiDelta: 5,
          comfortDelta: 3,
        },
      },
    ],
  },
  {
    code: 'TQB_504',
    name: 'Phòng Đọc Chuyên Ngành Tây Bắc 504',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 52,
    areaM2: 127.14,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.008, 0.083),
      pt(0.122, 0.083),
      pt(0.122, 0.324),
      pt(0.008, 0.324),
    ],
    doorPosition: pt(0.06, 0.324),
    nearestLandmarkId: 'STAIR_NW',
    readingBays: [
      {
        id: 'TQB_504_MAIN',
        nameVi: 'Phòng Đọc Yên Tĩnh Tây Bắc 504',
        shortLabel: 'P.Đọc 504',
        descriptionVi:
          'Phòng đọc chuyên ngành 127 m² yên tĩnh, tách biệt khu thảo luận nhóm',
        posX: 0.065,
        posY: 0.2,
        seatCapacity: 52,
        tags: ['quiet', 'window'],
        microOffsets: {
          tempDelta: -0.4,
          noiseDelta: -5.0,
          luxDelta: 50,
          pm25Delta: -1.5,
          humidityDelta: -0.5,
          rssiDelta: 2,
          comfortDelta: 5,
        },
      },
    ],
  },
  {
    code: 'TQB_505',
    name: 'Phòng Đọc Chuyên Ngành Đông Bắc 505',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 52,
    areaM2: 127.14,
    zoneCode: 'ZONE_A',
    boundaryPolygon: [
      pt(0.878, 0.083),
      pt(0.992, 0.083),
      pt(0.992, 0.324),
      pt(0.878, 0.324),
    ],
    doorPosition: pt(0.94, 0.324),
    nearestLandmarkId: 'STAIR_NE',
    readingBays: [
      {
        id: 'TQB_505_MAIN',
        nameVi: 'Phòng Đọc Yên Tĩnh Đông Bắc 505',
        shortLabel: 'P.Đọc 505',
        descriptionVi:
          'Phòng đọc chuyên ngành 127 m² mát mẻ, ánh sáng chuẩn',
        posX: 0.935,
        posY: 0.2,
        seatCapacity: 52,
        tags: ['quiet', 'window', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.6,
          noiseDelta: -5.5,
          luxDelta: 60,
          pm25Delta: -2.0,
          humidityDelta: -1.0,
          rssiDelta: 3,
          comfortDelta: 6,
        },
      },
    ],
  },
  // Cụm 8 Phòng Làm Việc Theo Nhóm Nhỏ (25.97 m² – 41.47 m²) dọc hành lang Nam Tầng 5
  {
    code: 'TQB_506',
    name: 'Phòng Thảo Luận Nhóm 506 (37.7 m²)',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 14,
    areaM2: 37.74,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.301, 0.756),
      pt(0.398, 0.756),
      pt(0.398, 0.838),
      pt(0.301, 0.838),
    ],
    doorPosition: pt(0.398, 0.795),
    nearestLandmarkId: 'STAIR_SW',
    readingBays: [
      {
        id: 'TQB_506_GROUP',
        nameVi: 'Bàn Họp Nhóm 506 (Kèm Màn Hình Trình Chiếu)',
        shortLabel: 'P.Nhóm 506',
        descriptionVi:
          'Phòng làm việc nhóm 12–14 chỗ, cách âm tốt cho thảo luận đồ án',
        posX: 0.35,
        posY: 0.797,
        seatCapacity: 14,
        tags: ['group', 'multimedia', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.4,
          noiseDelta: 2.0,
          luxDelta: 35,
          pm25Delta: 0.0,
          humidityDelta: 0.0,
          rssiDelta: 6,
          comfortDelta: 4,
        },
      },
    ],
  },
  {
    code: 'TQB_507',
    name: 'Phòng Thảo Luận Nhóm 507 (40.4 m²)',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 16,
    areaM2: 40.37,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.301, 0.841),
      pt(0.398, 0.841),
      pt(0.398, 0.935),
      pt(0.301, 0.935),
    ],
    doorPosition: pt(0.398, 0.865),
    nearestLandmarkId: 'STAIR_SW',
    readingBays: [
      {
        id: 'TQB_507_GROUP',
        nameVi: 'Bàn Họp Nhóm Cửa Sổ Nam 507',
        shortLabel: 'P.Nhóm 507',
        descriptionVi:
          'Phòng thảo luận nhóm 16 chỗ có cửa sổ nhìn ra mặt Nam',
        posX: 0.35,
        posY: 0.888,
        seatCapacity: 16,
        tags: ['group', 'window'],
        microOffsets: {
          tempDelta: 0.2,
          noiseDelta: 1.5,
          luxDelta: 60,
          pm25Delta: -0.5,
          humidityDelta: 0.0,
          rssiDelta: 5,
          comfortDelta: 3,
        },
      },
    ],
  },
  {
    code: 'TQB_508',
    name: 'Phòng Thảo Luận Nhóm 508 (26.0 m²)',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 10,
    areaM2: 25.97,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.422, 0.756),
      pt(0.498, 0.756),
      pt(0.498, 0.838),
      pt(0.422, 0.838),
    ],
    doorPosition: pt(0.422, 0.795),
    nearestLandmarkId: 'ELEV_W',
    readingBays: [
      {
        id: 'TQB_508_GROUP',
        nameVi: 'Bàn Thảo Luận Nhóm Nhỏ 508',
        shortLabel: 'P.Nhóm 508',
        descriptionVi: 'Phòng nhóm 8–10 sinh viên, điều hòa độc lập cực mát',
        posX: 0.46,
        posY: 0.797,
        seatCapacity: 10,
        tags: ['group', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.8,
          noiseDelta: 0.5,
          luxDelta: 30,
          pm25Delta: -1.0,
          humidityDelta: -1.0,
          rssiDelta: 7,
          comfortDelta: 6,
        },
      },
    ],
  },
  {
    code: 'TQB_509',
    name: 'Phòng Thảo Luận Nhóm 509 (41.5 m²)',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 16,
    areaM2: 41.47,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.402, 0.841),
      pt(0.498, 0.841),
      pt(0.498, 0.938),
      pt(0.402, 0.938),
    ],
    doorPosition: pt(0.42, 0.841),
    nearestLandmarkId: 'ELEV_W',
    readingBays: [
      {
        id: 'TQB_509_GROUP',
        nameVi: 'Bàn Seminar Nhóm Lớn 509',
        shortLabel: 'P.Nhóm 509',
        descriptionVi:
          'Phòng làm việc nhóm 16 chỗ trang bị bảng trắng lớn và màn hình LCD',
        posX: 0.45,
        posY: 0.89,
        seatCapacity: 16,
        tags: ['group', 'window', 'multimedia'],
        microOffsets: {
          tempDelta: -0.3,
          noiseDelta: 1.0,
          luxDelta: 55,
          pm25Delta: 0.0,
          humidityDelta: 0.0,
          rssiDelta: 6,
          comfortDelta: 5,
        },
      },
    ],
  },
  {
    code: 'TQB_510',
    name: 'Phòng Thảo Luận Nhóm 510 (26.0 m²)',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 10,
    areaM2: 25.97,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.502, 0.756),
      pt(0.578, 0.756),
      pt(0.578, 0.838),
      pt(0.502, 0.838),
    ],
    doorPosition: pt(0.578, 0.795),
    nearestLandmarkId: 'ELEV_E',
    readingBays: [
      {
        id: 'TQB_510_GROUP',
        nameVi: 'Bàn Thảo Luận Nhóm Nhỏ 510',
        shortLabel: 'P.Nhóm 510',
        descriptionVi:
          'Phòng nhóm tiêu chuẩn 8–10 chỗ gần thang máy trung tâm',
        posX: 0.54,
        posY: 0.797,
        seatCapacity: 10,
        tags: ['group', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.6,
          noiseDelta: 1.0,
          luxDelta: 25,
          pm25Delta: -1.0,
          humidityDelta: -0.5,
          rssiDelta: 8,
          comfortDelta: 5,
        },
      },
    ],
  },
  {
    code: 'TQB_511',
    name: 'Phòng Thảo Luận Nhóm 511 (41.5 m²)',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 16,
    areaM2: 41.47,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.502, 0.841),
      pt(0.598, 0.841),
      pt(0.598, 0.938),
      pt(0.502, 0.938),
    ],
    doorPosition: pt(0.58, 0.841),
    nearestLandmarkId: 'ELEV_E',
    readingBays: [
      {
        id: 'TQB_511_GROUP',
        nameVi: 'Bàn Seminar Nhóm Lớn 511',
        shortLabel: 'P.Nhóm 511',
        descriptionVi: 'Phòng làm việc nhóm 16 chỗ hướng Nam thoáng đãng',
        posX: 0.55,
        posY: 0.89,
        seatCapacity: 16,
        tags: ['group', 'window', 'multimedia'],
        microOffsets: {
          tempDelta: -0.2,
          noiseDelta: 1.5,
          luxDelta: 60,
          pm25Delta: 0.0,
          humidityDelta: 0.0,
          rssiDelta: 6,
          comfortDelta: 4,
        },
      },
    ],
  },
  {
    code: 'TQB_512',
    name: 'Phòng Thảo Luận Nhóm 512 (37.7 m²)',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 14,
    areaM2: 37.74,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.602, 0.756),
      pt(0.699, 0.756),
      pt(0.699, 0.838),
      pt(0.602, 0.838),
    ],
    doorPosition: pt(0.602, 0.795),
    nearestLandmarkId: 'STAIR_SE',
    readingBays: [
      {
        id: 'TQB_512_GROUP',
        nameVi: 'Bàn Họp Nhóm 512',
        shortLabel: 'P.Nhóm 512',
        descriptionVi: 'Phòng thảo luận nhóm 14 chỗ cánh Đông Nam',
        posX: 0.65,
        posY: 0.797,
        seatCapacity: 14,
        tags: ['group', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.5,
          noiseDelta: 0.0,
          luxDelta: 35,
          pm25Delta: -1.0,
          humidityDelta: -0.5,
          rssiDelta: 5,
          comfortDelta: 5,
        },
      },
    ],
  },
  {
    code: 'TQB_513',
    name: 'Phòng Thảo Luận Nhóm 513 (40.4 m²)',
    floor: 5,
    roomType: 'STUDY_ROOM',
    capacity: 16,
    areaM2: 40.37,
    zoneCode: 'ZONE_B',
    boundaryPolygon: [
      pt(0.602, 0.841),
      pt(0.699, 0.841),
      pt(0.699, 0.935),
      pt(0.602, 0.935),
    ],
    doorPosition: pt(0.602, 0.865),
    nearestLandmarkId: 'STAIR_SE',
    readingBays: [
      {
        id: 'TQB_513_GROUP',
        nameVi: 'Bàn Họp Nhóm Cửa Sổ Đông Nam 513',
        shortLabel: 'P.Nhóm 513',
        descriptionVi: 'Phòng thảo luận nhóm 16 chỗ mát mẻ, cách âm tốt',
        posX: 0.65,
        posY: 0.888,
        seatCapacity: 16,
        tags: ['group', 'window', 'ac_cool'],
        microOffsets: {
          tempDelta: -0.4,
          noiseDelta: -0.5,
          luxDelta: 50,
          pm25Delta: -1.5,
          humidityDelta: -0.5,
          rssiDelta: 4,
          comfortDelta: 6,
        },
      },
    ],
  },
];

/**
 * Trả về đường dẫn file SVG lớp nền kiến trúc CAD TQB cho tầng tương ứng.
 */
export function getFloorCadSvgPath(floor: number): string {
  if (floor <= 1) return '/floorplans/tqb-floor-1.svg';
  if (floor === 2) return '/floorplans/tqb-floor-2.svg';
  if (floor === 3) return '/floorplans/tqb-floor-3.svg';
  if (floor === 4) return '/floorplans/tqb-floor-4.svg';
  return '/floorplans/tqb-floor-5.svg';
}

/**
 * Lấy danh sách mốc định vị (Cầu thang, Thang máy, WC, Giếng trời) của tầng.
 */
export function getFloorLandmarks(floor: number): readonly TqbLandmark[] {
  const effectiveFloor = floor <= 1 ? 1 : floor;
  return TQB_LANDMARKS.filter((lm) => lm.floors.includes(effectiveFloor));
}

/**
 * Lấy danh sách toàn bộ Preset phòng TQB của một tầng.
 */
export function getFloorRoomPresets(floor: number): readonly TqbRoomPreset[] {
  const effectiveFloor = floor === 0 ? 1 : floor;
  return TQB_ROOM_PRESETS.filter((preset) => preset.floor === effectiveFloor);
}

/**
 * Khớp một RoomResponse từ Backend với TqbRoomPreset chuẩn.
 */
export function resolveRoomPreset(
  room: Pick<RoomResponse, 'code' | 'name' | 'floor' | 'boundaryPolygon'>,
  indexOnFloor = 0
): TqbRoomPreset | null {
  const normalizedCode = room.code.trim().toUpperCase();

  // 1. Khớp trực tiếp theo mã TQB hoặc legacyCodes
  const directMatch = TQB_ROOM_PRESETS.find(
    (p) =>
      p.code.toUpperCase() === normalizedCode ||
      (p.legacyCodes?.some((lc) => lc.toUpperCase() === normalizedCode) ??
        false)
  );
  if (directMatch) return directMatch;

  // 2. Khớp theo tầng và từ khóa tên phòng
  const effectiveFloor = room.floor === 0 ? 1 : room.floor;
  const floorPresets = getFloorRoomPresets(effectiveFloor);
  if (floorPresets.length === 0) return null;

  const lowerName = room.name.toLowerCase();
  const byName = floorPresets.find(
    (p) =>
      p.name.toLowerCase() === lowerName ||
      (lowerName.includes('multimedia') &&
        p.name.toLowerCase().includes('multimedia')) ||
      (lowerName.includes('sảnh') && p.name.toLowerCase().includes('sảnh')) ||
      (lowerName.includes('truyền thống') &&
        p.name.toLowerCase().includes('truyền thống')) ||
      (lowerName.includes('nhập') && p.name.toLowerCase().includes('nhập'))
  );
  if (byName) return byName;

  // 3. Fallback theo thứ tự phòng trên tầng
  return floorPresets[indexOnFloor % floorPresets.length] ?? null;
}

/**
 * Lấy đa giác chuẩn hóa để vẽ cho RoomResponse.
 */
export function resolveRoomPolygon(
  room: Pick<RoomResponse, 'code' | 'name' | 'floor' | 'boundaryPolygon'>,
  indexOnFloor = 0
): readonly Point2D[] | null {
  const preset = resolveRoomPreset(room, indexOnFloor);
  const existing = room.boundaryPolygon;

  if (existing && existing.length >= 3) {
    const isLegacySeedBox =
      existing.length === 4 &&
      ['ROOM_001', 'ROOM_101', 'ROOM_102', 'ROOM_201', 'ROOM_301', 'ROOM_302'].includes(
        room.code.trim().toUpperCase()
      );
    if (!isLegacySeedBox) {
      return existing;
    }
  }

  if (preset) {
    return preset.boundaryPolygon;
  }

  return existing && existing.length >= 3 ? existing : null;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Tổng hợp các Phân khu Bàn đọc Ẩn danh (Anonymous Reading Bays / Micro-zones) cho Role USER / VIEWER.
 * Tuân thủ tuyệt đối FE-VIZ-09: KHÔNG lộ hardwareId hay thông tin phần cứng ESP32,
 * nhưng vẫn tái tạo vùng chuyển màu đa tâm (Case C Gaussian Diffusion) dựa trên telemetry thực của phòng.
 */
export function synthesizeAnonymousMicroZones(
  room: RoomResponse,
  roomTelemetry: TelemetryResponse | null | undefined,
  indexOnFloor = 0
): readonly AnonymousMicroZone[] {
  const preset = resolveRoomPreset(room, indexOnFloor);
  const polygon = resolveRoomPolygon(room, indexOnFloor);

  const baseTemp = roomTelemetry?.environment?.temperature ?? 23.2;
  const baseHum = roomTelemetry?.environment?.humidity ?? 54.0;
  const baseLux = roomTelemetry?.environment?.lux ?? 380;
  const basePm25 = roomTelemetry?.airQuality?.pm2_5 ?? 16.0;
  const baseNoise = roomTelemetry?.acoustics?.noiseAvg ?? 41.5;
  const baseRssi = roomTelemetry?.wifiRssi ?? -58;
  const baseComfort = roomTelemetry?.comfortScore?.overall ?? 84;

  if (preset && preset.readingBays.length > 0) {
    return preset.readingBays.map((bay) => {
      let posX = bay.posX;
      let posY = bay.posY;
      if (
        polygon &&
        polygon.length >= 3 &&
        !isPointInPolygon({ x: posX, y: posY }, polygon)
      ) {
        const centroid = computeVisualPolygonCenter(polygon);
        posX = +(centroid.x * 0.65 + posX * 0.35).toFixed(4);
        posY = +(centroid.y * 0.65 + posY * 0.35).toFixed(4);
        if (!isPointInPolygon({ x: posX, y: posY }, polygon)) {
          posX = centroid.x;
          posY = centroid.y;
        }
      }

      return {
        bayId: bay.id,
        nameVi: bay.nameVi,
        shortLabel: bay.shortLabel,
        descriptionVi: bay.descriptionVi,
        posX,
        posY,
        seatCapacity: bay.seatCapacity,
        tags: bay.tags,
        metrics: {
          comfortScore: Math.round(
            clamp(baseComfort + bay.microOffsets.comfortDelta, 15, 100)
          ),
          temperature: +clamp(
            baseTemp + bay.microOffsets.tempDelta,
            16,
            38
          ).toFixed(1),
          humidity: +clamp(
            baseHum + bay.microOffsets.humidityDelta,
            25,
            95
          ).toFixed(1),
          pm2_5: +clamp(basePm25 + bay.microOffsets.pm25Delta, 2, 180).toFixed(
            1
          ),
          noiseAvg: +clamp(
            baseNoise + bay.microOffsets.noiseDelta,
            28,
            88
          ).toFixed(1),
          lux: Math.round(
            clamp(baseLux + bay.microOffsets.luxDelta, 40, 1200)
          ),
          wifiRssi: Math.round(
            clamp(baseRssi + bay.microOffsets.rssiDelta, -92, -35)
          ),
        },
      };
    });
  }

  if (!polygon || polygon.length < 3) return [];
  const centroid = computeVisualPolygonCenter(polygon);
  return [
    {
      bayId: `${room.code}_BAY_QUIET`,
      nameVi: 'Góc Tự Học Yên Tĩnh',
      shortLabel: 'Góc Yên tĩnh',
      descriptionVi: 'Phân khu bàn đọc yên tĩnh bên trong phòng',
      posX: centroid.x,
      posY: centroid.y,
      seatCapacity: Math.max(10, Math.round((room.capacity ?? 40) * 0.6)),
      tags: ['quiet', 'ac_cool'],
      metrics: {
        comfortScore: Math.round(clamp(baseComfort + 3, 15, 100)),
        temperature: +(baseTemp - 0.3).toFixed(1),
        humidity: +baseHum.toFixed(1),
        pm2_5: +basePm25.toFixed(1),
        noiseAvg: +Math.max(30, baseNoise - 3.0).toFixed(1),
        lux: Math.round(baseLux + 25),
        wifiRssi: Math.round(baseRssi),
      },
    },
  ];
}

/**
 * Tính toán lộ trình dẫn đường đi bộ (Wayfinding Route) từ Thang máy / Cầu thang bộ gần nhất
 * tới cửa phòng và phân khu bàn đọc được chọn, kèm khoảng cách thực tế bằng mét (theo khung 76.0m × 57.2m).
 */
export function computeWayfindingPath(
  room: RoomResponse,
  targetPointOverride?: Point2D | null,
  indexOnFloor = 0
): WayfindingRoute | null {
  const preset = resolveRoomPreset(room, indexOnFloor);
  const polygon = resolveRoomPolygon(room, indexOnFloor);
  if (!polygon || polygon.length < 3) return null;

  const centroid = computeVisualPolygonCenter(polygon);
  const doorPosition: Point2D = preset?.doorPosition ?? centroid;
  const targetPoint: Point2D = targetPointOverride ?? centroid;

  const floorLandmarks = getFloorLandmarks(room.floor);
  let fromLandmark: TqbLandmark | undefined = preset
    ? floorLandmarks.find((lm) => lm.id === preset.nearestLandmarkId)
    : undefined;

  if (!fromLandmark) {
    const navLandmarks = floorLandmarks.filter(
      (lm) =>
        lm.kind === 'ELEVATOR' || lm.kind === 'STAIRS' || lm.kind === 'ENTRANCE'
    );
    fromLandmark = navLandmarks.reduce<TqbLandmark | undefined>(
      (best, curr) => {
        if (!best) return curr;
        const dCurr = Math.hypot(
          curr.position.x - doorPosition.x,
          curr.position.y - doorPosition.y
        );
        const dBest = Math.hypot(
          best.position.x - doorPosition.x,
          best.position.y - doorPosition.y
        );
        return dCurr < dBest ? curr : best;
      },
      undefined
    );
  }

  if (!fromLandmark) return null;

  const start = fromLandmark.position;
  const midCorridorPoint: Point2D = {
    x: +(start.x * 0.35 + doorPosition.x * 0.65).toFixed(4),
    y: +(start.y * 0.75 + doorPosition.y * 0.25).toFixed(4),
  };

  const waypoints: Point2D[] = [
    start,
    midCorridorPoint,
    doorPosition,
    targetPoint,
  ];

  let distanceMeters = 0;
  for (let i = 1; i < waypoints.length; i += 1) {
    const dxMeters =
      (waypoints[i].x - waypoints[i - 1].x) * TQB_BUILDING_WIDTH_M;
    const dyMeters =
      (waypoints[i].y - waypoints[i - 1].y) * TQB_BUILDING_DEPTH_M;
    distanceMeters += Math.hypot(dxMeters, dyMeters);
  }

  return {
    fromLandmark,
    doorPosition,
    targetPoint,
    waypoints,
    distanceMeters: Math.max(4, Math.round(distanceMeters)),
  };
}
