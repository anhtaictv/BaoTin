export interface RssSourceConfig {
  name: string;
  feedUrl: string;
  /** Cấu hình tần suất riêng theo từng nguồn — xem crawler/runCrawler.ts. */
  pollIntervalMinutes: number;
}

/**
 * Cả 2 URL bên dưới đã được xác minh thủ công là feed RSS 2.0 hợp lệ (curl trực tiếp,
 * content-type text/xml, HTTP 200) tại thời điểm viết — dùng mục "Pháp luật" thay vì
 * trang chủ chung để tỷ lệ khớp từ khóa loại vụ việc cao hơn.
 *
 * Không tìm thấy feed RSS nào cho baodaklak.vn (đã thử /rss/home.rss, /rss.html, kiểm tra
 * cả HTML trang chủ tìm thẻ <link rel="alternate" type="application/rss+xml"> — không có
 * kết quả). Nếu bạn có URL RSS đúng của báo Đắk Lắk (hoặc báo Phú Yên, vì địa bàn seed hiện
 * đã gộp cả 2 tỉnh cũ sau sáp nhập 2025), thêm vào mảng bên dưới.
 */
export const RSS_SOURCES: RssSourceConfig[] = [
  { name: "VnExpress — Pháp luật", feedUrl: "https://vnexpress.net/rss/phap-luat.rss", pollIntervalMinutes: 30 },
  { name: "Tuổi Trẻ — Pháp luật", feedUrl: "https://tuoitre.vn/rss/phap-luat.rss", pollIntervalMinutes: 30 },
];
