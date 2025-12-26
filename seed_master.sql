USE PETCAREX;
GO

/* ==========================================
   1. MEMBERSHIP_RANK
   ========================================== */
INSERT INTO MEMBERSHIP_RANK (
    MEMBERSHIP_RANK_NAME,
    MEMBERSHIP_RANK_MAINTAIN_THRESHOLD,
    MEMBERSHIP_RANK_UPGRADE_CONDITION
) VALUES
(N'Cơ bản',    0,        5000000),
(N'Bạc',       5000000,  15000000),
(N'Vàng',      15000000, 30000000),
(N'VIP',       30000000, 999999999);
GO

/* ==========================================
   2. PET_BREED
   ========================================== */
INSERT INTO PET_BREED (BREED_NAME, TYPE_OF_PET) VALUES
(N'Poodle',        N'Chó'),
(N'Husky',         N'Chó'),
(N'Shiba Inu',     N'Chó'),
(N'Golden',        N'Chó'),
(N'Pug',           N'Chó'),
(N'Mèo ta',        N'Mèo'),
(N'Mèo Anh lông ngắn', N'Mèo'),
(N'Mèo Ba Tư',     N'Mèo'),
(N'Alaska',        N'Chó'),
(N'Corgi',         N'Chó'),
(N'Mèo Xiêm',      N'Mèo'),
(N'Mèo Scottish',  N'Mèo');
GO

/* ==========================================
   3. BRANCH (BRANCH_MANAGER để NULL, cập nhật sau)
   ========================================== */
INSERT INTO BRANCH (
    BRANCH_NAME,
    BRANCH_ADDRESS,
    BRANCH_PHONE,
    BRANCH_OPEN_TIME,
    BRANCH_CLOSED_TIME,
    BRANCH_MANAGER
) VALUES
(N'Chi nhánh Quận 1',   N'123 Lê Lợi, Quận 1, TP.HCM',   '0281234567', '08:00', '21:00', NULL),
(N'Chi nhánh Thủ Đức',  N'45 Võ Văn Ngân, Thủ Đức, TP.HCM', '0282345678', '08:00', '21:00', NULL),
(N'Chi nhánh Bình Thạnh', N'90 Điện Biên Phủ, Bình Thạnh, TP.HCM', '0283456789', '08:00', '21:00', NULL),
(N'Chi nhánh Tân Bình', N'12 Cộng Hòa, Tân Bình, TP.HCM', '0284567890', '08:00', '21:00', NULL);
GO

/* ==========================================
   4. SERVICE
   ========================================== */
INSERT INTO SERVICE (SERVICE_NAME) VALUES
(N'Khám tổng quát'),
(N'Khám chuyên khoa'),
(N'Tiêm vaccine'),
(N'Tái khám'),
(N'Bán lẻ sản phẩm'),
(N'Gói tiêm phòng 6 tháng'),
(N'Gói tiêm phòng 12 tháng');
GO

/* ==========================================
   5. PRODUCT (dùng IDENTITY_INSERT để kiểm soát ID)
   - 1-10: thức ăn
   - 11-15: phụ kiện
   - 16-20: thuốc
   - 21-25: dịch vụ y tế (mapping MEDICAL_SERVICE)
   - 26-28: gói tiêm (mapping VACCINATION_PLAN)
   ========================================== */
SET IDENTITY_INSERT PRODUCT ON;
INSERT INTO PRODUCT (PRODUCT_ID, PRODUCT_NAME) VALUES
(1,  N'Thức ăn hạt cho chó nhỏ 2kg'),
(2,  N'Thức ăn hạt cho chó lớn 5kg'),
(3,  N'Thức ăn hạt cho mèo trưởng thành 1.5kg'),
(4,  N'Pate cho mèo 400g'),
(5,  N'Xương gặm sạch răng cho chó'),
(6,  N'Thức ăn ướt cho chó gói 100g'),
(7,  N'Thức ăn hạt cho mèo con 1kg'),
(8,  N'Bánh thưởng cho chó'),
(9,  N'Bánh thưởng cho mèo'),
(10, N'Sữa tắm cho chó lông trắng'),

(11, N'Dây dắt chó size M'),
(12, N'Dây dắt chó size L'),
(13, N'Vòng cổ cho mèo'),
(14, N'Lồng vận chuyển size S'),
(15, N'Lồng vận chuyển size M'),

(16, N'Thuốc tẩy giun cho chó'),
(17, N'Thuốc tẩy giun cho mèo'),
(18, N'Thuốc nhỏ gáy trị ve rận'),
(19, N'Thuốc nhỏ mắt cho chó mèo'),
(20, N'Thuốc trị nấm da cho chó mèo'),

(21, N'Dịch vụ khám tổng quát chó'),
(22, N'Dịch vụ khám tổng quát mèo'),
(23, N'Dịch vụ khám chuyên sâu'),
(24, N'Dịch vụ tái khám'),
(25, N'Dịch vụ tiêm vaccine lẻ'),
(26, N'Gói tiêm phòng 6 tháng cho chó'),
(27, N'Gói tiêm phòng 12 tháng cho chó'),
(28, N'Gói tiêm phòng cơ bản cho mèo'),

(29, N'Vaccine 5 trong 1 cho chó'),
(30, N'Vaccine 7 trong 1 cho chó'),
(31, N'Vaccine dại cho chó mèo'),
(32, N'Vaccine 4 trong 1 cho mèo'),
(33, N'Vaccine FIP cho mèo');


SET IDENTITY_INSERT PRODUCT OFF;
GO

/* ==========================================
   6. SALES_PRODUCT (PRODUCT bán lẻ)
   ========================================== */
INSERT INTO SALES_PRODUCT (SALES_PRODUCT_ID, SALES_PRODUCT_PRICE) VALUES
(1, 150000),
(2, 350000),
(3, 180000),
(4, 50000),
(5, 80000),
(6, 30000),
(7, 160000),
(8, 60000),
(9, 55000),
(10,120000),

(11,90000),
(12,100000),
(13,70000),
(14,250000),
(15,300000),

(16,120000),
(17,130000),
(18,200000),
(19,90000),
(20,220000);
GO

/* ==========================================
   7. MEDICAL_SERVICE (map tới PRODUCT_ID 21-25)
   ========================================== */
INSERT INTO MEDICAL_SERVICE (MEDICAL_SERVICE_ID, MEDICAL_SERVICE_FEE) VALUES
(21, 200000), -- Khám tổng quát chó
(22, 200000), -- Khám tổng quát mèo
(23, 350000), -- Khám chuyên sâu
(24, 150000), -- Tái khám
(25, 180000); -- Tiêm vaccine lẻ
GO

/* ==========================================
   8. VACCINE (mapped to PRODUCT)
   ========================================== */
INSERT INTO VACCINE (VACCINE_ID, VACCINE_NAME, VACCINE_DES, VACCINE_PRICE) VALUES
(29, N'Vaccine 5 trong 1 cho chó', N'Phòng care, parvo, viêm gan, ho cũi chó, dại.', 250000),
(30, N'Vaccine 7 trong 1 cho chó', N'Phòng nhiều bệnh truyền nhiễm cho chó.', 300000),
(31, N'Vaccine dại cho chó mèo',  N'Phòng bệnh dại.', 200000),
(32, N'Vaccine 4 trong 1 cho mèo', N'Phòng cảm mèo, viêm mũi họng, panleukopenia...', 250000),
(33, N'Vaccine FIP cho mèo',      N'Hỗ trợ phòng một số bệnh truyền nhiễm.', 350000);
GO

/* ==========================================
   9. VACCINATION_PLAN (map tới PRODUCT_ID 26-28)
   ========================================== */
INSERT INTO VACCINATION_PLAN (
    VACCINATION_PLAN_ID,
    VACCINATION_PLAN_DURATION,
    VACCINATION_PLAN_PRICE
) VALUES
(26, 180, 1500000),   -- 6 tháng
(27, 365, 2500000),   -- 12 tháng
(28, 180, 1200000);   -- 6 tháng mèo
GO

/* ==========================================
   10. VACCINATION_PLAN_DETAIL
   ========================================== */
-- Giả sử ID vaccine 29..33 tương ứng theo thứ tự insert ở trên
INSERT INTO VACCINATION_PLAN_DETAIL (VACCINATION_PLAN_ID, VACCINE_ID, VACCINE_DOSAGE) VALUES
(26, 29, 1),
(26, 31, 1),

(27, 29, 2),
(27, 30, 1),
(27, 31, 1),

(28, 32, 2),
(28, 33, 1);
GO
/* ==========================================
   11. EMPLOYEE (gán BRANCH_ID; BRANCH_MANAGER update sau)
   EMPLOYEE_POSITION:
   - 'RECEP' : lễ tân
   - 'SALES' : bán hàng
   - 'VET'   : bác sĩ
   - 'MGR'   : quản lý
   ========================================== */
INSERT INTO EMPLOYEE (
    CCCD,
    EMPLOYEE_NAME,
    EMPLOYEE_GENDER,
    EMPLOYEE_BIRTHDATE,
    EMPLOYEE_EMAIL,
    EMPLOYEE_PASSWORD,
    EMPLOYEE_JOIN_DATE,
    EMPLOYEE_SALARY,
    EMPLOYEE_POSITION,
    BRANCH_ID
) VALUES
('012345678901', N'Nguyễn Thị Lễ Tân 1',        N'Nữ',  '1995-02-10', 'emp1@petcarex.com',  'emp_pwd_0000000001', '2020-01-01', 12000000, 'RECEP', 1),
('012345678902', N'Lê Văn Lễ Tân 2',            N'Nam', '1994-05-20', 'emp2@petcarex.com',  'emp_pwd_0000000002', '2019-03-15', 12000000, 'RECEP', 2),
('012345678903', N'Trần Thị Lễ Tân 3',          N'Nữ',  '1996-09-12', 'emp3@petcarex.com',  'emp_pwd_0000000003', '2021-07-01', 11000000, 'RECEP', 3),
('012345678904', N'Phạm Văn Lễ Tân 4',          N'Nam', '1993-11-30', 'emp4@petcarex.com',  'emp_pwd_0000000004', '2018-09-10', 13000000, 'RECEP', 4),

('012345678905', N'Nguyễn Văn Bán Hàng 1',      N'Nam', '1990-01-15', 'emp5@petcarex.com',  'emp_pwd_0000000005', '2017-05-01', 10000000, 'SALES', 1),
('012345678906', N'Hoàng Thị Bán Hàng 2',       N'Nữ',  '1992-03-22', 'emp6@petcarex.com',  'emp_pwd_0000000006', '2018-08-01', 10500000, 'SALES', 3),

('012345678907', N'Bác sĩ thú y 1',             N'Nam', '1985-04-10', 'emp7@petcarex.com',  'emp_pwd_0000000007', '2015-01-01', 20000000, 'VET',   1),
('012345678908', N'Bác sĩ thú y 2',             N'Nữ',  '1987-07-18', 'emp8@petcarex.com',  'emp_pwd_0000000008', '2016-06-01', 21000000, 'VET',   2),
('012345678909', N'Bác sĩ thú y 3',             N'Nam', '1989-10-30', 'emp9@petcarex.com',  'emp_pwd_0000000009', '2017-09-01', 19000000, 'VET',   3),
('012345678910', N'Bác sĩ thú y 4',             N'Nữ',  '1991-12-05', 'emp10@petcarex.com', 'emp_pwd_0000000010', '2019-02-01', 18000000, 'VET',   4),

('012345678911', N'Quản lý chi nhánh Q1',       N'Nam', '1980-01-01', 'emp11@petcarex.com', 'emp_pwd_0000000011', '2010-01-01', 25000000, 'MGR',   1),
('012345678912', N'Quản lý chi nhánh Thủ Đức',  N'Nữ',  '1982-05-05', 'emp12@petcarex.com', 'emp_pwd_0000000012', '2012-04-01', 24000000, 'MGR',   2),
('012345678913', N'Quản lý chi nhánh Bình Thạnh', N'Nam','1979-08-15', 'emp13@petcarex.com', 'emp_pwd_0000000013', '2011-07-01', 24500000, 'MGR', 3),
('012345678914', N'Quản lý chi nhánh Tân Bình', N'Nữ',  '1983-09-25', 'emp14@petcarex.com', 'emp_pwd_0000000014', '2013-09-01', 24500000, 'MGR', 4),
('012345678915', N'Giám đốc vận hành', N'Nam', '1975-03-15', 'director@petcarex.com', 'director_pwd_001', '2008-01-01', 50000000, 'DIRECTOR', 1);
GO

/* ==========================================
   12. Cập nhật BRANCH_MANAGER
   - Giả sử EMPLOYEE_ID tăng theo thứ tự insert trên (bảng trống ban đầu)
   ========================================== */
UPDATE BRANCH
SET BRANCH_MANAGER = E.EMPLOYEE_ID
FROM BRANCH B
JOIN EMPLOYEE E
    ON B.BRANCH_ID = E.BRANCH_ID
   AND E.EMPLOYEE_POSITION = 'MGR';
GO

/* ==========================================
   12.5 VET_SCHEDULE (basic weekly schedule)
   ========================================== */
INSERT INTO VET_SCHEDULE (
    VET_ID,
    BRANCH_ID,
    DAY_OF_WEEK,
    START_TIME,
    END_TIME,
    SLOT_MINUTES
)
SELECT
    E.EMPLOYEE_ID,
    E.BRANCH_ID,
    D.DAY_OF_WEEK,
    '08:00',
    '12:00',
    30
FROM EMPLOYEE E
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6)) D(DAY_OF_WEEK)
WHERE E.EMPLOYEE_POSITION = 'VET';
GO

/* ==========================================
   13. BRANCH_SERVICE (mỗi chi nhánh đều có full service)
   ========================================== */
INSERT INTO BRANCH_SERVICE (BRANCH_ID, SERVICE_ID)
SELECT B.BRANCH_ID, S.SERVICE_ID
FROM BRANCH B
CROSS JOIN SERVICE S;
GO

/* ==========================================
   14. BRANCH_VACCINE_BATCH
   - Mỗi chi nhánh có 5 loại vaccine, mỗi loại 2 batch
   ========================================== */
DECLARE @today DATE = CAST(GETDATE() AS DATE);

INSERT INTO BRANCH_VACCINE_BATCH (
    VACCINE_ID,
    BRANCH_ID,
    VACCINE_BATCH_MFD,
    VACCINE_BATCH_EXP,
    VACCINE_BATCH_QUANTITY
)
SELECT
    V.VACCINE_ID,
    B.BRANCH_ID,
    DATEADD(MONTH, -6, @today),          -- sản xuất 6 tháng trước
    DATEADD(YEAR, 1, @today),            -- hết hạn sau 1 năm
    100
FROM VACCINE V
CROSS JOIN BRANCH B;
GO

/* ==========================================
   15. BRANCH_STOCK
   - Mỗi chi nhánh có stock cho tất cả SALES_PRODUCT với số lượng khác nhau
   ========================================== */
INSERT INTO BRANCH_STOCK (BRANCH_ID, SALES_PRODUCT_ID, QUANTITY)
SELECT
    B.BRANCH_ID,
    S.SALES_PRODUCT_ID,
    CASE 
        WHEN S.SALES_PRODUCT_ID % 5 = 0 THEN 0
        WHEN S.SALES_PRODUCT_ID % 5 = 1 THEN 10
        WHEN S.SALES_PRODUCT_ID % 5 = 2 THEN 20
        WHEN S.SALES_PRODUCT_ID % 5 = 3 THEN 30
        ELSE 50
    END
FROM BRANCH B
CROSS JOIN SALES_PRODUCT S;
GO

/* ==========================================
   16. SAMPLE CUSTOMERS (for testing)
   ========================================== */
DECLARE @CustomerId1 INT, @CustomerId2 INT, @CustomerId3 INT;

EXEC dbo.uspCustomerCreate
    @CustomerName = N'Nguyễn Văn An',
    @CustomerPhone = '0901234567',
    @CustomerEmail = 'nguyenvanan@gmail.com',
    @CustomerPassword = 'customer_pwd_001',
    @CustomerGender = N'Nam',
    @CustomerBirthdate = '1990-05-15',
    @CustomerId = @CustomerId1 OUTPUT;

EXEC dbo.uspCustomerCreate
    @CustomerName = N'Trần Thị Bình',
    @CustomerPhone = '0912345678',
    @CustomerEmail = 'tranthiminh@gmail.com',
    @CustomerPassword = 'customer_pwd_002',
    @CustomerGender = N'Nữ',
    @CustomerBirthdate = '1988-03-20',
    @CustomerId = @CustomerId2 OUTPUT;

EXEC dbo.uspCustomerCreate
    @CustomerName = N'Lê Hoàng Cường',
    @CustomerPhone = '0923456789',
    @CustomerEmail = 'lehoangcuong@gmail.com',
    @CustomerPassword = 'customer_pwd_003',
    @CustomerGender = N'Nam',
    @CustomerBirthdate = '1995-11-10',
    @CustomerId = @CustomerId3 OUTPUT;

/* ==========================================
   17. SAMPLE PETS (for testing)
   ========================================== */
DECLARE @PetId INT;

-- Customer 1's pets
EXEC dbo.uspPetCreateForCustomer
    @CustomerId = @CustomerId1,
    @PetName = N'Milu',
    @PetBreedId = 1, -- Poodle
    @PetGender = N'Nam',
    @PetBirthdate = '2022-01-10',
    @PetHealthStatus = N'Khỏe mạnh',
    @PetId = @PetId OUTPUT;

EXEC dbo.uspPetCreateForCustomer
    @CustomerId = @CustomerId1,
    @PetName = N'Bông',
    @PetBreedId = 6, -- Mèo ta
    @PetGender = N'Nữ',
    @PetBirthdate = '2023-03-15',
    @PetHealthStatus = N'Khỏe mạnh',
    @PetId = @PetId OUTPUT;

-- Customer 2's pets
EXEC dbo.uspPetCreateForCustomer
    @CustomerId = @CustomerId2,
    @PetName = N'Lucky',
    @PetBreedId = 4, -- Golden
    @PetGender = N'Nam',
    @PetBirthdate = '2021-06-20',
    @PetHealthStatus = N'Khỏe mạnh',
    @PetId = @PetId OUTPUT;

EXEC dbo.uspPetCreateForCustomer
    @CustomerId = @CustomerId2,
    @PetName = N'Mimi',
    @PetBreedId = 7, -- Mèo Anh lông ngắn
    @PetGender = N'Nữ',
    @PetBirthdate = '2022-09-01',
    @PetHealthStatus = N'Đang điều trị',
    @PetId = @PetId OUTPUT;

-- Customer 3's pets
EXEC dbo.uspPetCreateForCustomer
    @CustomerId = @CustomerId3,
    @PetName = N'Max',
    @PetBreedId = 2, -- Husky
    @PetGender = N'Nam',
    @PetBirthdate = '2020-12-25',
    @PetHealthStatus = N'Khỏe mạnh',
    @PetId = @PetId OUTPUT;

PRINT N'Sample customers and pets created successfully!';
GO

