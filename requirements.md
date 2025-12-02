## 2. Chuẩn đầu ra môn học

Đồ án thực hành nhằm đáp ứng các chuẩn đầu ra:

- **G1** – Phân tích, tổng hợp, thực hành các kỹ năng làm việc nhóm trong hoạt động thiết kế CSDL quan hệ theo nhóm.  
- **G3** – Thực hành suy nghĩ có phê phán, sáng tạo trong việc thiết kế CSDL quan hệ.  
- **G5** – Biết và vận dụng được các kiến thức nền tảng phục vụ cho các giai đoạn thiết kế CSDL quan hệ như: mô hình dữ liệu, PTH, dạng chuẩn,...  
- **G6** – Biết và vận dụng được các kỹ thuật xác định yêu cầu người dùng.  
- **G7** – Biết và thực hiện được các công việc trong giai đoạn thiết kế CSDL quan hệ ở mức quan niệm và logic.  
- **G8** – Biết và thực hiện được các công việc trong giai đoạn thiết kế CSDL quan hệ ở mức vật lý.  


## 3. Mô tả đồ án môn học  
### **QUẢN LÝ HỆ THỐNG TRUNG TÂM CHĂM SÓC THÚ CƯNG (PETCAREX)**

**Mục tiêu:** giúp sinh viên quan sát, hiểu cách vận hành một quy trình từ hệ thống thực tế, từ đó thu thập dữ liệu để tự thiết kế, cài đặt mô phỏng quy trình quan sát được bằng cách vận dụng kiến thức lý thuyết.

### **Mô tả gợi ý**

Hệ thống PetCareX gồm 10 chi nhánh tại các thành phố lớn, mỗi chi nhánh cung cấp dịch vụ khám bệnh, tiêm phòng, và cửa hàng bán thức ăn/phụ kiện.  
- Mỗi chi nhánh có tên, địa chỉ, số điện thoại, thời gian mở/đóng cửa, danh sách dịch vụ có cung cấp (mỗi chi nhánh có thể cung cấp các dịch vụ khác nhau).

**Khách hàng** là người nuôi thú cưng, có thể đăng ký hội viên với thông tin:  
- họ tên, số điện thoại, email, CCCD, giới tính, ngày sinh  
- Một khách hàng có thể sở hữu nhiều thú cưng  
- Mỗi thú cưng có: mã, tên, loài (chó, mèo, chim, thỏ...), giống, ngày sinh, giới tính, tình trạng sức khỏe.

**Khách hàng có thể đặt các dịch vụ tại trung tâm**, bao gồm:

- **Khám bệnh:**  
  lưu thông tin bác sĩ phụ trách, triệu chứng, chuẩn đoán, toa thuốc, ngày tái khám.

- **Tiêm phòng:**  
  loại vắc-xin, ngày tiêm, liều lượng, bác sĩ phụ trách.  
  Ngoài tiêm lẻ, trung tâm có **gói tiêm 6/12 tháng**, cho phép khách hàng chọn các mũi theo thời gian.  
  Đăng ký gói có thể được giảm giá **5%–15%**.

- **Mua hàng:**  
  sản phẩm gồm mã, tên, loại (thức ăn, thuốc, phụ kiện), giá bán, số lượng tồn kho.

Khi sử dụng dịch vụ, hệ thống tạo **hóa đơn**, gồm:  
- mã hóa đơn, ngày lập, nhân viên lập, khách hàng  
- danh sách dịch vụ/sản phẩm  
- tổng tiền, khuyến mãi, hình thức thanh toán  
- hóa đơn được liên kết với thú cưng nếu có liên quan.

### **Chương trình hội viên**

3 cấp độ:  
- **Cơ bản**  
- **Thân thiết:** ≥5.000.000/năm, duy trì nếu ≥3.000.000/năm  
- **VIP:** ≥12.000.000/năm, duy trì nếu ≥8.000.000/năm  

Điểm loyalty: **1 điểm = 50.000 VNĐ**

### **Quản lý nhân sự**

Nhân sự gồm:  
- bác sĩ thú y  
- nhân viên bán hàng  
- nhân viên tiếp tân  
- quản lý chi nhánh  

Mỗi nhân viên có: mã NV, họ tên, ngày sinh, giới tính, ngày vào làm, chức vụ, chi nhánh, lương cơ bản.  
Một số nhân viên có lịch sử điều động qua chi nhánh khác.

### **Đánh giá dịch vụ**

Khách hàng có thể đánh giá:  
- điểm chất lượng  
- thái độ nhân viên  
- mức độ hài lòng  
- bình luận  


---

## **Một số yêu cầu gợi ý**

### **1. Cấp chi nhánh**

- Doanh thu theo ngày/tháng/quý/năm  
- Danh sách thú cưng được tiêm phòng trong kỳ  
- Thống kê các loại vắc-xin đặt nhiều nhất  
- Tồn kho sản phẩm  
- Tra cứu vắc-xin theo tên, loại, ngày sản xuất  
- Tra cứu lịch sử khám của thú cưng / gói tiêm / tình hình tiêm chủng  
- Hiệu suất nhân viên: số đơn hàng/dịch vụ, điểm đánh giá  
- Thống kê số lượng khách hàng, khách hàng lâu không quay lại  
- Quản lý nhân viên chi nhánh (tra cứu/thêm/xóa/cập nhật)  
- ...  

### **2. Cấp công ty**

- Doanh thu toàn hệ thống và từng chi nhánh  
- Dịch vụ mang lại doanh thu cao nhất trong 6 tháng gần nhất  
- Thống kê thú cưng theo loài/giống  
- Tình hình hội viên (tỷ lệ Cơ bản/Thân thiết/VIP)  
- Quản lý nhân sự toàn hệ thống  
- Tra cứu nhân sự, chi nhánh  

---

## **Yêu cầu của đồ án**

### **Giai đoạn 1**
- Mô tả chi tiết quy trình, dữ liệu, ràng buộc  
- Danh sách chức năng + tần suất giao dịch (tự quan sát & đề xuất)  
- Thiết kế dữ liệu mức quan niệm và logic  

### **Giai đoạn 2**
- Thiết kế CSDL mức vật lý  
- Đề xuất cải thiện hiệu quả truy vấn  
- Source code mô phỏng một số chức năng (CRUD, tìm kiếm, thống kê)  
- Script tạo CSDL, query, index, partition  
- Tạo & thực thi các chỉ mục, chụp hình & giải thích kết quả  
- So sánh có/không có giải pháp nâng cao hiệu suất  

### **Lưu ý**
- Báo cáo có thông tin cá nhân + nhóm  
- Mô tả từ phân tích → thiết kế → cài đặt → đánh giá  
- Tự phát sinh dữ liệu ≥ 70,000 dòng/bảng để test chỉ mục  
- Phải dùng công cụ quản lý phân công nhóm  
- Tham khảo: https://www.guru99.com/test-data-generation-tools.html  

---

## **Thang điểm**

- **Mức quan niệm:** 20%  
  (đặc tả, thiết kế ER, báo cáo)

- **Mức logic:** 10%  
  (lược đồ quan hệ, ràng buộc, dạng chuẩn, chuẩn hoá, báo cáo)

- **Mức vật lý:** 50%  
  (script DB, stored, function, trigger, phân tích tần suất, index, partition, báo cáo)  
  - Mô tả **5–8 kịch bản sử dụng liên quan nhau**, xác định tần suất  
  - Áp dụng phân tích vật lý để chọn giải pháp tối ưu

- **Cài đặt ứng dụng:** 20%  
  (web/winform + báo cáo)  
  - Cài đặt tối thiểu quy trình hẹn – khám – chữa cho bệnh nhân, có đủ 3 vai trò.

- Tất cả thành viên phải tham gia **cả 4 giai đoạn**: quan niệm – logic – vật lý – cài đặt.

