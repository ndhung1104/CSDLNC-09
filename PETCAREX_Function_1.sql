-- ==============================================
-- FUNCTION / STORED PROCEDURE CATALOG - PETCAREX
-- (Bố cục theo phần, mỗi object nằm ngay dưới phần mô tả tương ứng)
-- ==============================================

-- Helper table types for bulk inserts
IF TYPE_ID('dbo.ReceiptItemType') IS NULL
  CREATE TYPE dbo.ReceiptItemType AS TABLE (
    ProductId INT NOT NULL,
    PetId INT NULL,
    Quantity INT NOT NULL,
    Price DECIMAL(18,0) NOT NULL
  );
GO
IF TYPE_ID('dbo.PrescriptionItemType') IS NULL
  CREATE TYPE dbo.PrescriptionItemType AS TABLE (
    ProductId INT NOT NULL,
    Quantity INT NOT NULL,
    Price DECIMAL(18,0) NOT NULL
  );
GO

-- ==============================================
-- PART 1: CUSTOMER ACCOUNTS, PETS, MEMBERSHIP & PORTAL
-- ==============================================

-- 1.1. Customer Account & Authentication
-- uspCustomerRegister
--   Type: procedure
--   Tạo khách hàng mới với hạng membership mặc định, loyalty = 0; kiểm tra trùng số điện thoại/email.
CREATE OR ALTER PROCEDURE dbo.uspCustomerRegister
  @MembershipRankId INT = NULL,
  @CustomerName NVARCHAR(50),
  @Phone CHAR(10) = NULL,
  @Email VARCHAR(100) = NULL,
  @Gender NVARCHAR(4),
  @Birthdate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN; -- giữ nhất quán giữa kiểm tra unique và insert
    IF EXISTS (SELECT 1 FROM CUSTOMER WHERE CUSTOMER_PHONE = @Phone AND @Phone IS NOT NULL)
      RAISERROR('Phone already exists', 16, 1);
    IF EXISTS (SELECT 1 FROM CUSTOMER WHERE CUSTOMER_EMAIL = @Email AND @Email IS NOT NULL)
      RAISERROR('Email already exists', 16, 1);
    IF @MembershipRankId IS NULL
      SELECT TOP 1 @MembershipRankId = MEMBERSHIP_RANK_ID FROM MEMBERSHIP_RANK ORDER BY MEMBERSHIP_RANK_ID;
    INSERT INTO CUSTOMER (MEMBERSHIP_RANK_ID, CUSTOMER_NAME, CUSTOMER_PHONE, CUSTOMER_EMAIL, CUSTOMER_GENDER, CUSTOMER_BIRTHDATE)
    VALUES (@MembershipRankId, @CustomerName, @Phone, @Email, @Gender, @Birthdate);
    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- uspCustomerLoginValidate
--   Type: procedure
--   Xác thực email/phone, trả về profile + hạng thành viên + loyalty.
CREATE OR ALTER PROCEDURE dbo.uspCustomerLoginValidate
  @EmailOrPhone VARCHAR(100)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1 c.*, dbo.fnMembershipRankName(c.MEMBERSHIP_RANK_ID) AS MEMBERSHIP_NAME, dbo.fnCustomerLoyaltyPoints(c.CUSTOMER_ID) AS LOYALTY_POINTS
  FROM CUSTOMER c
  WHERE c.CUSTOMER_EMAIL = @EmailOrPhone OR c.CUSTOMER_PHONE = LEFT(@EmailOrPhone,10);
END;
GO

-- uspCustomerProfileGet
--   Type: procedure
--   Lấy thông tin hồ sơ khách hàng kèm hạng, loyalty và chi tiêu năm hiện tại.
CREATE OR ALTER PROCEDURE dbo.uspCustomerProfileGet
  @CustomerId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT c.*, mr.MEMBERSHIP_RANK_NAME,
         ISNULL(cs.MONEY_SPENT,0) AS MONEY_SPENT_THIS_YEAR,
         dbo.fnCustomerLoyaltyPoints(c.CUSTOMER_ID) AS LOYALTY_POINTS
  FROM CUSTOMER c
  LEFT JOIN MEMBERSHIP_RANK mr ON c.MEMBERSHIP_RANK_ID = mr.MEMBERSHIP_RANK_ID
  LEFT JOIN CUSTOMER_SPENDING cs ON cs.CUSTOMER_ID = c.CUSTOMER_ID AND cs.YEAR = YEAR(GETDATE())
  WHERE c.CUSTOMER_ID = @CustomerId;
END;
GO

-- uspCustomerProfileUpdate
--   Type: procedure
--   Cập nhật hồ sơ khách hàng, kiểm tra trùng email/số điện thoại.
CREATE OR ALTER PROCEDURE dbo.uspCustomerProfileUpdate
  @CustomerId INT,
  @CustomerName NVARCHAR(50),
  @Phone CHAR(10) = NULL,
  @Email VARCHAR(100) = NULL,
  @Gender NVARCHAR(4),
  @Birthdate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN; -- đảm bảo update + kiểm tra unique đồng bộ
    IF EXISTS (SELECT 1 FROM CUSTOMER WHERE CUSTOMER_PHONE = @Phone AND CUSTOMER_ID <> @CustomerId AND @Phone IS NOT NULL)
      RAISERROR('Phone already exists',16,1);
    IF EXISTS (SELECT 1 FROM CUSTOMER WHERE CUSTOMER_EMAIL = @Email AND CUSTOMER_ID <> @CustomerId AND @Email IS NOT NULL)
      RAISERROR('Email already exists',16,1);
    UPDATE CUSTOMER
    SET CUSTOMER_NAME = @CustomerName,
        CUSTOMER_PHONE = @Phone,
        CUSTOMER_EMAIL = @Email,
        CUSTOMER_GENDER = @Gender,
        CUSTOMER_BIRTHDATE = @Birthdate
    WHERE CUSTOMER_ID = @CustomerId;
    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- uspCustomerList (Admin)
--   Type: procedure
--   Liệt kê khách hàng, hạng thành viên, số thú cưng và điểm loyalty.
CREATE OR ALTER PROCEDURE dbo.uspCustomerList
AS
BEGIN
  SET NOCOUNT ON;
  SELECT c.*, mr.MEMBERSHIP_RANK_NAME,
         (SELECT COUNT(*) FROM PET p WHERE p.CUSTOMER_ID = c.CUSTOMER_ID) AS PET_COUNT,
         dbo.fnCustomerLoyaltyPoints(c.CUSTOMER_ID) AS LOYALTY_POINTS
  FROM CUSTOMER c
  LEFT JOIN MEMBERSHIP_RANK mr ON mr.MEMBERSHIP_RANK_ID = c.MEMBERSHIP_RANK_ID;
END;
GO

-- 1.2. Membership & Loyalty
-- fnCustomerLoyaltyPoints
--   Type: function
--   Tính điểm loyalty từ bảng CUSTOMER_SPENDING (1 điểm / 50.000 VNĐ).
CREATE OR ALTER FUNCTION dbo.fnCustomerLoyaltyPoints (@CustomerId INT)
RETURNS INT
AS
BEGIN
  DECLARE @points INT = 0;
  SELECT @points = ISNULL(SUM(MONEY_SPENT / 50000), 0)
  FROM CUSTOMER_SPENDING
  WHERE CUSTOMER_ID = @CustomerId;
  RETURN @points;
END;
GO

-- fnMembershipRankName
--   Type: function
--   Trả về tên hạng thành viên theo MEMBERSHIP_RANK_ID.
CREATE OR ALTER FUNCTION dbo.fnMembershipRankName (@RankId INT)
RETURNS NVARCHAR(20)
AS
BEGIN
  DECLARE @name NVARCHAR(20);
  SELECT @name = MEMBERSHIP_RANK_NAME FROM MEMBERSHIP_RANK WHERE MEMBERSHIP_RANK_ID = @RankId;
  RETURN @name;
END;
GO

-- uspMembershipRecalculate
--   Type: procedure
--   Tính lại điểm loyalty và hạng dựa trên chi tiêu trong năm hiện tại.
CREATE OR ALTER PROCEDURE dbo.uspMembershipRecalculate
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE c
    SET CUSTOMER_LOYALTY = dbo.fnCustomerLoyaltyPoints(c.CUSTOMER_ID),
        MEMBERSHIP_RANK_ID = (
          SELECT TOP 1 mr.MEMBERSHIP_RANK_ID
          FROM MEMBERSHIP_RANK mr
          WHERE mr.MEMBERSHIP_RANK_MAINTAIN_THRESHOLD <= ISNULL(cs.MONEY_SPENT,0)
          ORDER BY mr.MEMBERSHIP_RANK_UPGRADE_CONDITION DESC
        )
  FROM CUSTOMER c
  OUTER APPLY (SELECT MONEY_SPENT FROM CUSTOMER_SPENDING WHERE CUSTOMER_ID = c.CUSTOMER_ID AND YEAR = YEAR(GETDATE())) cs;
END;
GO

-- uspMembershipRankList
--   Type: procedure
--   Danh sách hạng thành viên.
CREATE OR ALTER PROCEDURE dbo.uspMembershipRankList
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM MEMBERSHIP_RANK;
END;
GO

-- 1.3. Pet & Breed
-- uspCustomerPetsList
--   Type: procedure
--   Liệt kê thú cưng của khách hàng kèm giống/loài.
CREATE OR ALTER PROCEDURE dbo.uspCustomerPetsList
  @CustomerId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT p.*, b.BREED_NAME, b.TYPE_OF_PET
  FROM PET p
  JOIN PET_BREED b ON p.PET_BREED_ID = b.BREED_ID
  WHERE p.CUSTOMER_ID = @CustomerId;
END;
GO

-- uspCustomerPetAdd
--   Type: procedure
--   Thêm thú cưng mới cho khách hàng.
CREATE OR ALTER PROCEDURE dbo.uspCustomerPetAdd
  @CustomerId INT,
  @PetName NVARCHAR(20),
  @PetBreedId INT,
  @PetGender NVARCHAR(4),
  @PetBirthdate DATE = NULL,
  @HealthStatus NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO PET (CUSTOMER_ID, PET_NAME, PET_BREED_ID, PET_GENDER, PET_BIRTHDATE, PET_HEALTH_STATUS)
  VALUES (@CustomerId, @PetName, @PetBreedId, @PetGender, @PetBirthdate, @HealthStatus);
END;
GO

-- uspCustomerPetUpdate
--   Type: procedure
--   Cập nhật thông tin thú cưng.
CREATE OR ALTER PROCEDURE dbo.uspCustomerPetUpdate
  @PetId INT,
  @PetBreedId INT,
  @PetGender NVARCHAR(4),
  @PetBirthdate DATE = NULL,
  @HealthStatus NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE PET
  SET PET_BREED_ID = @PetBreedId,
      PET_GENDER = @PetGender,
      PET_BIRTHDATE = @PetBirthdate,
      PET_HEALTH_STATUS = @HealthStatus
  WHERE PET_ID = @PetId;
END;
GO

-- uspCustomerPetDelete
--   Type: procedure
--   Xóa thú cưng nếu không còn lịch hẹn pending/confirmed.
CREATE OR ALTER PROCEDURE dbo.uspCustomerPetDelete
  @PetId INT
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (SELECT 1 FROM APPOINTMENT WHERE PET_ID = @PetId AND APPOINTMENT_STATUS IN (N'Pending',N'Confirmed'))
  BEGIN
    RAISERROR('Pet has pending appointments',16,1);
    RETURN;
  END
  DELETE FROM PET WHERE PET_ID = @PetId;
END;
GO

-- uspCustomerPetDetails
--   Type: procedure
--   Xem chi tiết thú cưng và lịch sử khám/tiêm.
CREATE OR ALTER PROCEDURE dbo.uspCustomerPetDetails
  @PetId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT p.*, b.BREED_NAME, b.TYPE_OF_PET FROM PET p JOIN PET_BREED b ON p.PET_BREED_ID = b.BREED_ID WHERE p.PET_ID = @PetId;
  SELECT * FROM CHECK_UP WHERE PET_ID = @PetId;
  SELECT * FROM VACCINATION WHERE PET_ID = @PetId;
END;
GO

-- uspPetBreedList
--   Type: procedure
--   Danh sách giống/loài thú cưng.
CREATE OR ALTER PROCEDURE dbo.uspPetBreedList
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM PET_BREED;
END;
GO

-- 1.4. Customer Portal: Appointments, Receipts, Vaccination History
-- uspCustomerAppointmentsList
--   Type: procedure
--   Liệt kê lịch hẹn của khách (kèm chi nhánh, dịch vụ, thú cưng).
CREATE OR ALTER PROCEDURE dbo.uspCustomerAppointmentsList
  @CustomerId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT a.*, b.BRANCH_NAME, s.SERVICE_NAME, p.PET_NAME
  FROM APPOINTMENT a
  JOIN BRANCH b ON a.BRANCH_ID = b.BRANCH_ID
  JOIN SERVICE s ON a.SERVICE_ID = s.SERVICE_ID
  LEFT JOIN PET p ON a.CUSTOMER_ID = p.CUSTOMER_ID AND a.PET_ID = p.PET_ID
  WHERE a.CUSTOMER_ID = @CustomerId;
END;
GO

-- uspCustomerAppointmentCreate
--   Type: procedure
--   Đặt lịch hẹn mới, kiểm tra dịch vụ của chi nhánh, giờ làm và trùng slot.
CREATE OR ALTER PROCEDURE dbo.uspCustomerAppointmentCreate
  @CustomerId INT,
  @PetId INT,
  @BranchId INT,
  @ServiceId INT,
  @AppointmentDate DATETIME,
  @Notes NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN; -- đảm bảo kiểm tra + insert đồng bộ
    IF NOT EXISTS (SELECT 1 FROM BRANCH_SERVICE WHERE BRANCH_ID = @BranchId AND SERVICE_ID = @ServiceId)
      RAISERROR('Branch does not offer this service',16,1);
    DECLARE @open TIME, @close TIME;
    SELECT @open = BRANCH_OPEN_TIME, @close = BRANCH_CLOSED_TIME FROM BRANCH WHERE BRANCH_ID = @BranchId;
    IF @open IS NULL RAISERROR('Branch not found',16,1);
    IF CAST(@AppointmentDate AS TIME) < @open OR CAST(@AppointmentDate AS TIME) > @close
      RAISERROR('Appointment outside branch hours',16,1);
    IF EXISTS (
      SELECT 1 FROM APPOINTMENT
      WHERE BRANCH_ID = @BranchId
        AND SERVICE_ID = @ServiceId
        AND APPOINTMENT_DATE = @AppointmentDate
        AND APPOINTMENT_STATUS NOT IN (N'Cancelled')
    )
      RAISERROR('Slot already booked',16,1);
    INSERT INTO APPOINTMENT (CUSTOMER_ID, BRANCH_ID, SERVICE_ID, APPOINTMENT_CREATE_DATE, APPOINTMENT_DATE, APPOINTMENT_STATUS)
    VALUES (@CustomerId, @BranchId, @ServiceId, GETDATE(), @AppointmentDate, N'Pending');
    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- uspCustomerAppointmentCancel
--   Type: procedure
--   Hủy lịch hẹn đang ở trạng thái pending/confirmed.
CREATE OR ALTER PROCEDURE dbo.uspCustomerAppointmentCancel
  @AppointmentId INT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE APPOINTMENT
  SET APPOINTMENT_STATUS = N'Cancelled'
  WHERE APPOINTMENT_ID = @AppointmentId AND APPOINTMENT_STATUS IN (N'Pending',N'Confirmed');
END;
GO

-- uspCustomerReceiptsList
--   Type: procedure
--   Liệt kê hóa đơn của khách hàng.
CREATE OR ALTER PROCEDURE dbo.uspCustomerReceiptsList
  @CustomerId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM RECEIPT WHERE CUSTOMER_ID = @CustomerId;
END;
GO

-- uspCustomerReceiptDetail
--   Type: procedure
--   Xem chi tiết một hóa đơn và các dòng sản phẩm/dịch vụ.
CREATE OR ALTER PROCEDURE dbo.uspCustomerReceiptDetail
  @ReceiptId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM RECEIPT WHERE RECEIPT_ID = @ReceiptId;
  SELECT rd.*, p.PRODUCT_NAME
  FROM RECEIPT_DETAIL rd
  JOIN PRODUCT p ON rd.PRODUCT_ID = p.PRODUCT_ID
  WHERE rd.RECEIPT_ID = @ReceiptId;
END;
GO

-- uspCustomerVaccinationHistory
--   Type: procedure
--   Lịch sử tiêm phòng của thú cưng (vaccine, lô, bác sĩ, chi nhánh).
CREATE OR ALTER PROCEDURE dbo.uspCustomerVaccinationHistory
  @PetId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT v.*, vac.VACCINE_NAME, b.BRANCH_NAME, e.EMPLOYEE_NAME
  FROM VACCINATION v
  JOIN BRANCH_VACCINE_BATCH bvb ON v.VACCINE_BATCH_ID = bvb.VACCINE_BATCH_ID
  JOIN VACCINE vac ON bvb.VACCINE_ID = vac.VACCINE_ID
  JOIN BRANCH b ON bvb.BRANCH_ID = b.BRANCH_ID
  JOIN EMPLOYEE e ON v.VET_ID = e.EMPLOYEE_ID
  WHERE v.PET_ID = @PetId;
END;
GO
