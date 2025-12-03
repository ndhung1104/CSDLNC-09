
-- ==============================================
-- PART 3: PRODUCTS, STOCK, BILLING, REVIEWS, BRANCH/EMPLOYEE ADMIN
-- (Chỉ sửa mô tả/comment tiếng Việt; code giữ nguyên)
-- ==============================================

-- 3.1. Branch & Employee Admin
-- uspBranchList
--   Type: procedure
--   Liệt kê danh sách chi nhánh.
CREATE OR ALTER PROCEDURE dbo.uspBranchList
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM BRANCH;
END;
GO

-- uspBranchCreate
--   Type: procedure
--   Thêm chi nhánh mới kèm thông tin liên hệ và giờ mở/đóng cửa.
CREATE OR ALTER PROCEDURE dbo.uspBranchCreate
  @BranchName NVARCHAR(50),
  @Address NVARCHAR(100),
  @Phone CHAR(10),
  @Open TIME,
  @Close TIME
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO BRANCH (BRANCH_NAME, BRANCH_ADDRESS, BRANCH_PHONE, BRANCH_OPEN_TIME, BRANCH_CLOSED_TIME)
  VALUES (@BranchName, @Address, @Phone, @Open, @Close);
END;
GO

-- uspBranchUpdate
--   Type: procedure
--   Cập nhật thông tin chi nhánh và người quản lý.
CREATE OR ALTER PROCEDURE dbo.uspBranchUpdate
  @BranchId INT,
  @BranchName NVARCHAR(50),
  @Address NVARCHAR(100),
  @Phone CHAR(10),
  @Open TIME,
  @Close TIME,
  @ManagerId INT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE BRANCH
  SET BRANCH_NAME = @BranchName,
      BRANCH_ADDRESS = @Address,
      BRANCH_PHONE = @Phone,
      BRANCH_OPEN_TIME = @Open,
      BRANCH_CLOSED_TIME = @Close,
      BRANCH_MANAGER = @ManagerId
  WHERE BRANCH_ID = @BranchId;
END;
GO

-- uspEmployeeCreate
--   Type: procedure
--   Thêm nhân viên mới (CCCD, lương, chức vụ, chi nhánh).
CREATE OR ALTER PROCEDURE dbo.uspEmployeeCreate
  @CCCD CHAR(12),
  @Name NVARCHAR(50),
  @Gender NVARCHAR(4),
  @Birthdate DATE,
  @JoinDate DATE,
  @Salary DECIMAL(18,0),
  @Position CHAR(10),
  @BranchId INT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO EMPLOYEE (CCCD, EMPLOYEE_NAME, EMPLOYEE_GENDER, EMPLOYEE_BIRTHDATE, EMPLOYEE_JOIN_DATE, EMPLOYEE_SALARY, EMPLOYEE_POSITION, BRANCH_ID)
  VALUES (@CCCD, @Name, @Gender, @Birthdate, @JoinDate, @Salary, @Position, @BranchId);
END;
GO

-- uspEmployeeUpdate
--   Type: procedure
--   Cập nhật lương/chức vụ/chi nhánh cho nhân viên.
CREATE OR ALTER PROCEDURE dbo.uspEmployeeUpdate
  @EmployeeId INT,
  @Salary DECIMAL(18,0),
  @Position CHAR(10),
  @BranchId INT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE EMPLOYEE
  SET EMPLOYEE_SALARY = @Salary,
      EMPLOYEE_POSITION = @Position,
      BRANCH_ID = @BranchId
  WHERE EMPLOYEE_ID = @EmployeeId;
END;
GO

-- uspEmployeeTransfer
--   Type: procedure
--   Điều chuyển nhân viên giữa chi nhánh và ghi lịch sử chuyển.
CREATE OR ALTER PROCEDURE dbo.uspEmployeeTransfer
  @EmployeeId INT,
  @DestBranchId INT,
  @TransferDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @FromBranchId INT;
  SELECT @FromBranchId = BRANCH_ID FROM EMPLOYEE WHERE EMPLOYEE_ID = @EmployeeId;
  IF @FromBranchId IS NULL
  BEGIN
    RAISERROR('Employee not found',16,1);
    RETURN;
  END
  BEGIN TRY
    BEGIN TRAN; -- chuy?n chi nh�nh + ghi l?ch s? c�ng l�c
    INSERT INTO TRANSFER_HISTORY (EMPLOYEE_ID, FROM_BRANCH_ID, DEST_BRANCH_ID, TRANSFER_DATE)
    VALUES (@EmployeeId, @FromBranchId, @DestBranchId, ISNULL(@TransferDate, GETDATE()));
    UPDATE EMPLOYEE SET BRANCH_ID = @DestBranchId WHERE EMPLOYEE_ID = @EmployeeId;
    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- uspEmployeeListByBranch
--   Type: procedure
--   Liệt kê nhân viên theo chi nhánh.
CREATE OR ALTER PROCEDURE dbo.uspEmployeeListByBranch
  @BranchId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM EMPLOYEE WHERE BRANCH_ID = @BranchId;
END;
GO

-- 3.2. Service & Branch Service
-- uspServiceList
--   Type: procedure
--   Liệt kê danh mục dịch vụ.
CREATE OR ALTER PROCEDURE dbo.uspServiceList
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM SERVICE;
END;
GO

-- uspBranchServiceList
--   Type: procedure
--   Liệt kê dịch vụ mà chi nhánh đang cung cấp.
CREATE OR ALTER PROCEDURE dbo.uspBranchServiceList
  @BranchId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT bs.*, s.SERVICE_NAME
  FROM BRANCH_SERVICE bs
  JOIN SERVICE s ON bs.SERVICE_ID = s.SERVICE_ID
  WHERE bs.BRANCH_ID = @BranchId;
END;
GO

-- uspBranchServiceAssign
--   Type: procedure
--   Gán/đăng ký dịch vụ cho chi nhánh.
CREATE OR ALTER PROCEDURE dbo.uspBranchServiceAssign
  @BranchId INT,
  @ServiceId INT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO BRANCH_SERVICE (BRANCH_ID, SERVICE_ID) VALUES (@BranchId, @ServiceId);
END;
GO

-- uspBranchServiceRemove
--   Type: procedure
--   Gỡ dịch vụ khỏi chi nhánh.
CREATE OR ALTER PROCEDURE dbo.uspBranchServiceRemove
  @BranchId INT,
  @ServiceId INT
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM BRANCH_SERVICE WHERE BRANCH_ID = @BranchId AND SERVICE_ID = @ServiceId;
END;
GO

-- 3.3. Product & Stock
-- uspProductMasterList
--   Type: procedure
--   Danh sách sản phẩm (master) không kèm giá.
CREATE OR ALTER PROCEDURE dbo.uspProductMasterList
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM PRODUCT;
END;
GO

-- uspProductList
--   Type: procedure
--   Danh sách sản phẩm/dịch vụ kèm giá, phân loại theo loại sản phẩm.
CREATE OR ALTER PROCEDURE dbo.uspProductList
AS
BEGIN
  SET NOCOUNT ON;
  SELECT p.PRODUCT_ID,
         p.PRODUCT_NAME,
         sp.SALES_PRODUCT_PRICE AS PRICE,
         'SalesProduct' AS PRODUCT_TYPE
  FROM PRODUCT p
  JOIN SALES_PRODUCT sp ON p.PRODUCT_ID = sp.SALES_PRODUCT_ID
  UNION ALL
  SELECT p.PRODUCT_ID, p.PRODUCT_NAME, ms.MEDICAL_SERVICE_FEE, 'MedicalService'
  FROM PRODUCT p
  JOIN MEDICAL_SERVICE ms ON p.PRODUCT_ID = ms.MEDICAL_SERVICE_ID
  UNION ALL
  SELECT p.PRODUCT_ID, p.PRODUCT_NAME, vp.VACCINATION_PLAN_PRICE, 'VaccinationPlan'
  FROM PRODUCT p
  JOIN VACCINATION_PLAN vp ON p.PRODUCT_ID = vp.VACCINATION_PLAN_ID;
END;
GO

-- uspBranchStockAdjust
--   Type: procedure
--   Điều chỉnh tồn kho hàng bán cho chi nhánh; dùng transaction để tránh tồn âm.
CREATE OR ALTER PROCEDURE dbo.uspBranchStockAdjust
  @BranchId INT,
  @SalesProductId INT,
  @Delta INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN; -- tr�nh race di?u ch?nh t?n kho
    IF EXISTS (SELECT 1 FROM BRANCH_STOCK WHERE BRANCH_ID = @BranchId AND SALES_PRODUCT_ID = @SalesProductId)
    BEGIN
      UPDATE BRANCH_STOCK
      SET QUANTITY = QUANTITY + @Delta
      WHERE BRANCH_ID = @BranchId AND SALES_PRODUCT_ID = @SalesProductId;
      IF EXISTS (SELECT 1 FROM BRANCH_STOCK WHERE BRANCH_ID = @BranchId AND SALES_PRODUCT_ID = @SalesProductId AND QUANTITY < 0)
        RAISERROR('Stock cannot be negative',16,1);
    END
    ELSE
    BEGIN
      INSERT INTO BRANCH_STOCK (BRANCH_ID, SALES_PRODUCT_ID, QUANTITY) VALUES (@BranchId, @SalesProductId, @Delta);
      IF @Delta < 0 RAISERROR('Stock cannot be negative',16,1);
    END
    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- uspBranchStockGet
--   Type: procedure
--   Xem tồn kho hàng bán tại chi nhánh.
CREATE OR ALTER PROCEDURE dbo.uspBranchStockGet
  @BranchId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT bs.*, p.PRODUCT_NAME
  FROM BRANCH_STOCK bs
  JOIN SALES_PRODUCT sp ON bs.SALES_PRODUCT_ID = sp.SALES_PRODUCT_ID
  JOIN PRODUCT p ON sp.SALES_PRODUCT_ID = p.PRODUCT_ID
  WHERE bs.BRANCH_ID = @BranchId;
END;
GO

-- 3.4. Vaccine Batch per Branch
-- uspBranchVaccineBatchAdd
--   Type: procedure
--   Thêm lô vaccine mới cho chi nhánh, kiểm tra MFD/EXP.
CREATE OR ALTER PROCEDURE dbo.uspBranchVaccineBatchAdd
  @VaccineId INT,
  @BranchId INT,
  @Mfd DATE,
  @Exp DATE,
  @Quantity INT
AS
BEGIN
  SET NOCOUNT ON;
  IF @Mfd > @Exp
  BEGIN
    RAISERROR('MFD must be before or equal EXP',16,1);
    RETURN;
  END
  INSERT INTO BRANCH_VACCINE_BATCH (VACCINE_ID, BRANCH_ID, VACCINE_BATCH_MFD, VACCINE_BATCH_EXP, VACCINE_BATCH_QUANTITY)
  VALUES (@VaccineId, @BranchId, @Mfd, @Exp, @Quantity);
END;
GO

-- uspBranchVaccineBatchAdjust
--   Type: procedure
--   Điều chỉnh số lượng lô vaccine; transaction để tránh âm.
CREATE OR ALTER PROCEDURE dbo.uspBranchVaccineBatchAdjust
  @VaccineBatchId INT,
  @Delta INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN; -- tr�nh �m s? lu?ng
    UPDATE BRANCH_VACCINE_BATCH
    SET VACCINE_BATCH_QUANTITY = VACCINE_BATCH_QUANTITY + @Delta
    WHERE VACCINE_BATCH_ID = @VaccineBatchId;
    IF EXISTS (SELECT 1 FROM BRANCH_VACCINE_BATCH WHERE VACCINE_BATCH_ID = @VaccineBatchId AND VACCINE_BATCH_QUANTITY < 0)
      RAISERROR('Vaccine batch quantity cannot be negative',16,1);
    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- 3.5. Billing & Receipt
-- fnCalculateBillTotal
--   Type: function
--   Tính tổng tiền hóa đơn từ các dòng chi tiết.
CREATE OR ALTER FUNCTION dbo.fnCalculateBillTotal (@ReceiptId INT)
RETURNS DECIMAL(18,0)
AS
BEGIN
  DECLARE @total DECIMAL(18,0);
  SELECT @total = SUM(RECEIPT_ITEM_AMOUNT * RECEIPT_ITEM_PRICE)
  FROM RECEIPT_DETAIL
  WHERE RECEIPT_ID = @ReceiptId;
  RETURN ISNULL(@total,0);
END;
GO

-- uspReceiptCreate
--   Type: procedure
--   Tạo hóa đơn (header + detail) và tính tổng tiền; transaction đảm bảo nhất quán.
CREATE OR ALTER PROCEDURE dbo.uspReceiptCreate
  @BranchId INT,
  @CustomerId INT,
  @ReceptionistId INT,
  @PaymentMethod NVARCHAR(20),
  @Items dbo.ReceiptItemType READONLY,
  @ReceiptId INT OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN; -- header + detail nh?t qu�n
    INSERT INTO RECEIPT (BRANCH_ID, CUSTOMER_ID, RECEPTIONIST_ID, RECEIPT_PAYMENT_METHOD, RECEIPT_STATUS)
    VALUES (@BranchId, @CustomerId, @ReceptionistId, @PaymentMethod, N'Pending');
    SET @ReceiptId = SCOPE_IDENTITY();
    INSERT INTO RECEIPT_DETAIL (RECEIPT_ITEM_ID, RECEIPT_ID, PRODUCT_ID, PET_ID, RECEIPT_ITEM_AMOUNT, RECEIPT_ITEM_PRICE)
    SELECT ROW_NUMBER() OVER (ORDER BY (SELECT 1)), @ReceiptId, ProductId, PetId, Quantity, Price
    FROM @Items;
    UPDATE RECEIPT
    SET RECEIPT_TOTAL_PRICE = dbo.fnCalculateBillTotal(@ReceiptId)
    WHERE RECEIPT_ID = @ReceiptId;
    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- uspReceiptFinalizePayment
--   Type: procedure
--   Hoàn tất thanh toán, cập nhật loyalty và chi tiêu khách hàng; transaction giữ đồng bộ.
CREATE OR ALTER PROCEDURE dbo.uspReceiptFinalizePayment
  @ReceiptId INT,
  @PaymentMethod NVARCHAR(20),
  @Status NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN; -- thanh to�n + loyalty c�ng l�c
    UPDATE RECEIPT
    SET RECEIPT_PAYMENT_METHOD = @PaymentMethod,
        RECEIPT_STATUS = @Status,
        RECEIPT_TOTAL_PRICE = dbo.fnCalculateBillTotal(@ReceiptId)
    WHERE RECEIPT_ID = @ReceiptId;
    DECLARE @custId INT, @total DECIMAL(18,0);
    SELECT @custId = CUSTOMER_ID, @total = RECEIPT_TOTAL_PRICE FROM RECEIPT WHERE RECEIPT_ID = @ReceiptId;
    IF @custId IS NOT NULL
    BEGIN
      MERGE CUSTOMER_SPENDING AS tgt
      USING (SELECT @custId AS CUSTOMER_ID, YEAR(GETDATE()) AS [YEAR], @total AS MONEY_SPENT) AS src
      ON tgt.CUSTOMER_ID = src.CUSTOMER_ID AND tgt.YEAR = src.YEAR
      WHEN MATCHED THEN UPDATE SET MONEY_SPENT = tgt.MONEY_SPENT + src.MONEY_SPENT
      WHEN NOT MATCHED THEN INSERT (CUSTOMER_ID, YEAR, MONEY_SPENT) VALUES (src.CUSTOMER_ID, src.YEAR, src.MONEY_SPENT);
      UPDATE CUSTOMER SET CUSTOMER_LOYALTY = dbo.fnCustomerLoyaltyPoints(@custId) WHERE CUSTOMER_ID = @custId;
    END
    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- uspReceiptListByBranchDate
--   Type: procedure
--   Liệt kê hóa đơn theo chi nhánh và khoảng ngày.
CREATE OR ALTER PROCEDURE dbo.uspReceiptListByBranchDate
  @BranchId INT,
  @FromDate DATE,
  @ToDate DATE
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM RECEIPT
  WHERE BRANCH_ID = @BranchId
    AND CAST(RECEIPT_CREATED_DATE AS DATE) BETWEEN @FromDate AND @ToDate;
END;
GO

-- 3.6. Review
-- uspReviewSubmit
--   Type: procedure
--   Tạo/cập nhật đánh giá cho hóa đơn (service/staff/overall + comment).
CREATE OR ALTER PROCEDURE dbo.uspReviewSubmit
  @ReceiptId INT,
  @ServiceScore INT,
  @StaffScore INT,
  @OverallScore INT,
  @Comment NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  MERGE REVIEW AS tgt
  USING (SELECT @ReceiptId AS RECEIPT_ID) src
  ON tgt.RECEIPT_ID = src.RECEIPT_ID
  WHEN MATCHED THEN UPDATE SET SERVICE_SCORE=@ServiceScore, STAFF_SCORE=@StaffScore, OVERALL_SCORE=@OverallScore, COMMENT=@Comment
  WHEN NOT MATCHED THEN INSERT (RECEIPT_ID, SERVICE_SCORE, STAFF_SCORE, OVERALL_SCORE, COMMENT) VALUES (@ReceiptId, @ServiceScore, @StaffScore, @OverallScore, @Comment);
END;
GO

-- uspReviewListByBranch
--   Type: procedure
--   Danh sách đánh giá theo chi nhánh, lọc theo khoảng ngày.
CREATE OR ALTER PROCEDURE dbo.uspReviewListByBranch
  @BranchId INT,
  @FromDate DATE = NULL,
  @ToDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT r.*, rc.RECEIPT_CREATED_DATE
  FROM REVIEW r
  JOIN RECEIPT rc ON r.RECEIPT_ID = rc.RECEIPT_ID
  WHERE rc.BRANCH_ID = @BranchId
    AND (@FromDate IS NULL OR CAST(rc.RECEIPT_CREATED_DATE AS DATE) >= @FromDate)
    AND (@ToDate IS NULL OR CAST(rc.RECEIPT_CREATED_DATE AS DATE) <= @ToDate);
END;
GO
