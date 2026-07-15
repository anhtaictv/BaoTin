# Báo Tin

Hệ thống tiếp nhận & xử lý tin báo an ninh trật tự cấp cơ sở — kênh phản ứng nhanh bổ trợ VNeID, không thay thế.

## Language

**Report** (`reports` table):
Tin báo từ chính người dân, luôn gắn `user_id` + tọa độ GPS, luôn đi qua workflow xác minh của cán bộ.
_Avoid_: Signal, tin (dùng chung chung), post

**Signal** (`social_media_signals` table):
Tín hiệu thu thập từ mạng xã hội/báo chí (kênh tình báo mở), không có định danh người báo, không đi qua workflow xác minh chính thức, không bao giờ trộn UI/dữ liệu với Report.
_Avoid_: Report, tin dân báo, OSINT report

**District** (`districts` table):
Đơn vị hành chính cấp xã/phường (sau sáp nhập 2025) dùng làm ranh giới địa lý cho geo-matching — không phải "quận/huyện" theo nghĩa tiếng Anh thông thường.
_Avoid_: Quận, huyện, area, zone

**Officer** (`officers` table):
Cán bộ công an phụ trách một hoặc nhiều District cụ thể, xác minh Report thuộc địa bàn mình.
_Avoid_: Agent, staff, admin (Admin là role khác, cấp cao hơn)

**Trust level** (`social_media_signals.trust_level`):
Mức tin cậy của một Signal (`verified_press` | `unverified_social`) — chỉ tồn tại trên Signal, không bao giờ xuất hiện trên Report vì Report đã có `status` xác minh bởi người thật.
_Avoid_: Status (đó là field riêng của Report), confidence score

**Status** (`reports.status`):
Trạng thái xác minh của một Report do Officer chọn thủ công (`pending` | `verifying` | `confirmed_true` | `confirmed_false`) — không bao giờ do AI tự động gán.
_Avoid_: Trust level (đó là field riêng của Signal)

**Urgency** (`reports.urgency`):
Mức khẩn cấp do luồng nộp tin quyết định (`emergency` từ nút SOS | `normal` từ báo tin thường) — khác với **Priority**, là điểm ưu tiên tính toán để sắp xếp danh sách cho Officer.
_Avoid_: Priority (là khái niệm suy ra, không phải field lưu trực tiếp)

**Geo-matching**:
Bước dùng PostGIS `ST_Contains` để xác định một tọa độ GPS thuộc District nào, từ đó tra ra Officer phụ trách.
_Avoid_: Geocoding (đó là việc chuyển địa chỉ chữ → tọa độ, khác chiều)
