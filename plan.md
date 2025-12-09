# Plans to complete the demonstration web for the database project

## Step 1: Reading and understanding the database project
- You need to read the src folder and understand its template, the routing, service and the design theme.
- Read the PETCAREX_Script.sql init file and understand its schema.
- Read the PETCAREX_Function.sql file for functions and stored procedures.
- This step is completed if you can have a hold on what the database is trying to achieve. The goal of the web is to demonstrate some usecases of the database. That's what you need to do in the next steps.

## Step 2: Refactoring the code and bootstrap the project
- You need to refactor the code to use esmodule instead of commonjs.
- You need to bootstrap the project by writing the dockerfile and docker-compose.yml file to use MS SQL Server as the databas, you can keep the express and nodejs server as it is. 
- There is a seed_Faker.py that can insert dummy data into the database. You need to run it after the database is initialized.
- Write a test.py file to test the requests or use the browser to test the requests.
- This step is completed if you can run the project successfully with docker compose and the requests are working.

## Step 3: Adding the database integration into the model
- You will be provided with a list of usecases that the web should demonstrate.
- For each usecase, you need to add the database integration into the models. You should use the stored procedures or functions provided in the PETCAREX_Function.sql file to interact with the database. For other queries, you can use the raw sql queries. Knex would be a good choice to interact with the database.
- After adding a usecase route, you need to test it with the test.py file or use the browser to test the requests.
- This step is completed if you can run the project successfully with docker compose and the requests are working with all the usecases.

## Step 4: Final refactoring
- You will need to clean up the web source code, remove the unused code, and make the code more readable.
- This step is completed if the code is clean and readable and the comments style and coding convention is satisfied.

# Rules about architecture and conventions
- Use MVC design patterns, with routes as the controller, models as the model, and views as the view.
- Use esmodule instead of commonjs.
- Use express.js as the framework.
- Use express session to handles the sessions.
- Use ejs as the template engine.
- Use bootstrap as the frontend framework, the template is provided so you should use its design language.
- Use knex as the database client.
- Files in the routes folder should be name abc.route.js, where abc is the name of the route.
- Files in the models folder should be name abc.model.js, where abc is the name of the model.
- Files in the services folder should be name abc.service.js, where abc is the name of the service.
- You can add /middleware folder to store the middleware functions and /utils folder to store the utility functions.
- The comments to explain the code should be simple, like // Checking the password, ... and should not be reduntdant.

## Usecases that need to be code in Vietnamese
### 1. Khách hàng mới đăng ký

**Actor:** Chị A (khách hàng mới), Nhân viên lễ tân, Hệ thống.  
**Mục tiêu:** Tạo tài khoản khách hàng mới và hồ sơ thú cưng tương ứng.

1.  Chị A mang thú cưng đến chi nhánh Quận 1 của PetCareX và gặp Nhân viên lễ tân để yêu cầu dịch vụ khám bệnh.
2.  Nhân viên lễ tân kiểm tra trên Hệ thống và xác nhận chị A chưa có tài khoản. Nhân viên chọn chức năng "Đăng ký khách hàng mới" và nhập thông tin cá nhân (họ tên, số điện thoại, email, địa chỉ, ...). Hệ thống tạo hồ sơ khách hàng mới cho chị A.
3.  Nhân viên lễ tân hỏi thêm thông tin thú cưng (tên, loài, giống, cân nặng, tuổi, tình trạng sức khỏe chung, ...) và nhập vào Hệ thống. Hệ thống tạo hồ sơ thú cưng mới và liên kết với tài khoản của chị A.
4.  Hệ thống khởi tạo hạng hội viên mặc định (ví dụ: "Cơ bản") và số điểm tích lũy ban đầu bằng 0 cho chị A.

### 2. Đi khám, thanh toán và tích điểm

**Actor:** Bác sĩ B, Lễ tân C, Chị A, Hệ thống.  
**Mục tiêu:** Hoàn tất quy trình khám bệnh, kê toa, thanh toán và cập nhật điểm tích lũy.

1.  Chị A đưa thú cưng đến chi nhánh theo lịch hẹn (hoặc khám trực tiếp). Lễ tân C tìm tài khoản của chị trên Hệ thống và tạo một Hóa đơn mới cùng với một Phiếu khám trong hóa đơn, ghi nhận thông tin khách hàng, thú cưng, bác sĩ phụ trách và lý do khám.
2.  Bác sĩ B xem danh sách Phiếu khám được phân công, chọn phiếu của chị A và mở hồ sơ thú cưng.
3.  Trong quá trình khám, Bác sĩ B ghi lại triệu chứng, chẩn đoán và các ghi chú cần thiết vào Phiếu khám trên Hệ thống.
4.  Bác sĩ B kê toa thuốc và/hoặc dịch vụ điều trị. Hệ thống tạo một toa thuốc liên kết với Phiếu khám, bao gồm danh sách thuốc, liều lượng, cách dùng và ngày tái khám (nếu có).
5.  Sau khi khám xong, lễ tân C kéo thông tin từ Phiếu khám (phí khám, phí dịch vụ, tiền thuốc, ...). Hệ thống tính tổng tiền và đặt trạng thái hoá đơn là "Chờ thanh toán".
6.  Chị A thanh toán tại quầy. Lễ tân C xác nhận thanh toán, Hệ thống cập nhật trạng thái hoá đơn thành "Đã hoàn thành".
7.  Hệ thống tự động tính điểm tích lũy dựa trên giá trị hoá đơn và chính sách tích điểm hiện hành, cộng vào tài khoản hội viên của chị A và cập nhật tổng chi tiêu năm.
8.  Chị A có thể điền đánh giá dịch vụ (review) trên phiếu hoặc trên giao diện điện tử; Hệ thống ghi nhận đánh giá liên kết với Phiếu khám hoặc Hoá đơn tương ứng.

### 3. Khách hàng thân thiết mua gói tiêm phòng

**Actor:** Anh D (khách hàng hạng VIP), Lễ tân C, Hệ thống.  
**Mục tiêu:** Đăng ký gói tiêm phòng 12 tháng cho thú cưng và áp dụng ưu đãi hội viên.

1.  Anh D đến chi nhánh Thủ Đức và hỏi mua gói tiêm phòng cho thú cưng của anh.
2.  Lễ tân C dùng Hệ thống để tra cứu danh sách các gói tiêm phòng hiện có (ví dụ: gói 6 tháng, 12 tháng) và tư vấn gói phù hợp cho Anh D.
3.  Lễ tân C kiểm tra tài khoản hội viên của Anh D trên Hệ thống; Hệ thống xác nhận anh đang ở hạng VIP và hiển thị các mức ưu đãi tương ứng.
4.  Lễ tân C tạo bản đăng ký gói tiêm phòng cho thú cưng của Anh D, chọn gói 12 tháng và áp dụng "Chính sách ưu đãi" theo hạng VIP. Hệ thống tạo bản ghi gói tiêm với trạng thái "Chờ thanh toán", tính toán giá sau giảm và hiển thị phần giảm giá.
5.  Lễ tân C tạo hoá đơn cho gói tiêm phòng; Hệ thống hiển thị tổng tiền phải thanh toán sau khi áp dụng ưu đãi.
6.  Anh D thanh toán, Hệ thống ghi nhận thanh toán và cập nhật trạng thái gói tiêm thành "Đã thanh toán". Lịch tiêm định kỳ có thể được tạo sẵn hoặc được lên lịch sau.
7.  Hệ thống cộng điểm tích lũy và cập nhật tổng chi tiêu năm cho Anh D dựa trên giá trị hoá đơn.
8.  Anh D có thể để lại đánh giá về trải nghiệm đăng ký gói tiêm; Hệ thống lưu đánh giá phục vụ thống kê chất lượng dịch vụ.

### 4. Mua hàng tại cửa hàng và kiểm tra tồn kho

**Actor:** Chị E, Nhân viên bán hàng F, Hệ thống.  
**Mục tiêu:** Mua thức ăn cho thú cưng, kiểm tra tồn kho và tích điểm.

1.  Chị E đến cửa hàng tại chi nhánh Bình Thạnh để mua đồ ăn cho thú cưng.
2.  Nhân viên bán hàng F sử dụng Hệ thống để tra cứu sản phẩm theo tên, mã vạch hoặc danh mục.
3.  Hệ thống hiển thị thông tin chi tiết sản phẩm (tên, loại, trọng lượng, giá bán, chi nhánh, tình trạng tồn kho).
4.  F thông báo đang còn 5 túi thức ăn loại mà Chị E cần; chị quyết định mua 2 túi.
5.  F tạo hoá đơn bán lẻ, quét mã vạch sản phẩm; Hệ thống tự động thêm thông tin khách hàng của Chị E (nếu là hội viên) vào hoá đơn để tích điểm, trạng thái hoá đơn là "Chờ thanh toán".
6.  F thu tiền, xác nhận thanh toán; Hệ thống cập nhật trạng thái hoá đơn là "Đã thanh toán" và trừ tồn kho của sản phẩm tại chi nhánh Bình Thạnh từ 5 còn 3 túi.
7.  Hệ thống tính điểm tích lũy tương ứng và cộng vào tài khoản hội viên của Chị E.
8.  Chị E có thể để lại đánh giá về sản phẩm/dịch vụ; Hệ thống lưu đánh giá phục vụ báo cáo chất lượng.

### 5. Quản lý chi nhánh xem báo cáo cuối ngày

**Actor:** Quản lý G (quản lý chi nhánh Quận 1), Hệ thống.  
**Mục tiêu:** Xem báo cáo doanh thu, hiệu suất nhân viên và tình hình khách hàng trong ngày.

1.  Quản lý G đăng nhập vào Hệ thống với vai trò quản lý chi nhánh Quận 1.
2.  Quản lý chọn chức năng "Báo cáo doanh thu trong ngày"; Hệ thống truy vấn tất cả hoá đơn đã hoàn tất trong ngày của chi nhánh Quận 1 và hiển thị tổng doanh thu, số lượng hoá đơn theo từng loại dịch vụ.
3.  Quản lý G chọn xem "Báo cáo hiệu suất nhân viên"; Hệ thống thống kê số lượng hoá đơn theo từng nhân viên lễ tân/bán hàng và số lượng phiếu khám bệnh theo từng bác sĩ trong ngày, kèm theo các chỉ số như giá trị trung bình mỗi hoá đơn.
4.  Quản lý G chọn xem "Báo cáo khách hàng"; Hệ thống thống kê số khách hàng mới, số khách hàng quay lại, số khách hàng là hội viên, cũng như phân bố điểm đánh giá dịch vụ trong ngày.
5.  Dựa trên các báo cáo, Quản lý G có thể đưa ra nhận xét về tình hình hoạt động chi nhánh và đề xuất điều chỉnh ca làm hoặc chương trình khuyến mãi.

### 6. Giám đốc vận hành xem xét thăng hạng hội viên

**Actor:** Chị H (Giám đốc vận hành cấp công ty), Hệ thống.  
**Mục tiêu:** Chạy logic xét duyệt hạng thành viên cuối năm và đánh giá tổng quan hệ thống.

1.  Chị H đăng nhập vào phân hệ "Quản trị toàn hệ thống".
2.  Chị chọn chức năng "Báo cáo vận hành"; Hệ thống tổng hợp doanh thu từ tất cả chi nhánh dựa trên hoá đơn trong năm và hiển thị theo từng chi nhánh, từng tháng.
3.  Chị H xem thống kê hội viên; Hệ thống hiển thị số lượng khách hàng theo từng hạng (Cơ bản, Bạc, Vàng, VIP, ...) kèm biểu đồ tỉ lệ hội viên so với khách hàng thông thường.
4.  Chị H kích hoạt chức năng "Tổng kết và xét duyệt hạng hội viên cuối năm". Hệ thống chạy thủ tục quét toàn bộ khách hàng:
    * **Case 1 (Giữ hạng):** Hệ thống so sánh tổng chi tiêu năm của khách hàng với ngưỡng giữ hạng hiện tại. Những khách hàng đạt đủ mốc giữ hạng sẽ được giữ nguyên hạng; Hệ thống hiển thị thống kê số lượng khách giữ hạng.
    * **Case 2 (Rớt hạng):** Với các khách hàng không đạt mốc giữ hạng, Hệ thống liệt kê theo từng hạng hiện tại, hiển thị số lượng khách hàng rớt hạng và điều chỉnh hạng xuống mức thấp hơn.
    * **Case 3 (Thăng hạng):** Với các khách hàng có tổng chi tiêu năm vượt mốc thăng hạng, Hệ thống thống kê và nâng hạng tương ứng. Danh sách khách hàng được thăng hạng có thể xuất ra để phục vụ các chiến dịch chăm sóc khách hàng.
5.  Sau khi kết thúc thủ tục, Hệ thống cập nhật lại các chỉ số thống kê hội viên và chuyển sang sẵn sàng cho chu kỳ năm mới.