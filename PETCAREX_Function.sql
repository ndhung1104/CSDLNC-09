/* =========================================================
   0. HELPER TYPES & FUNCTIONS DÙNG CHUNG
   ========================================================= */

IF TYPE_ID('dbo.ReceiptItemType') IS NULL
    CREATE TYPE dbo.ReceiptItemType AS TABLE (
        ProductId  INT NOT NULL,
        PetId      INT NULL,
        Quantity   INT NOT NULL,
        Price      DECIMAL(18,0) NULL  -- có thể NULL, hệ thống sẽ tự tra SALES_PRODUCT
    );
GO

-- Hạng hội viên mặc định (dùng cho đăng ký)
CREATE OR ALTER FUNCTION dbo.fnGetDefaultMembershipRankId()
RETURNS INT
AS
BEGIN
    DECLARE @RankId INT;

    SELECT TOP(1) @RankId = MEMBERSHIP_RANK_ID
    FROM MEMBERSHIP_RANK
    ORDER BY MEMBERSHIP_RANK_MAINTAIN_THRESHOLD ASC;

    RETURN @RankId;
END
GO

-- Tính điểm tích luỹ từ tổng tiền
CREATE OR ALTER FUNCTION dbo.fnCalculateLoyaltyPoints
(
    @Amount DECIMAL(18,0)
)
RETURNS INT
AS
BEGIN
    DECLARE @Points INT;
    SET @Points = @Amount / 10000;    -- ví dụ 1 điểm / 10.000đ
    RETURN @Points;
END
GO

-- % giảm giá theo hạng hội viên (cho gói tiêm)
CREATE OR ALTER FUNCTION dbo.fnGetMembershipDiscountPercent
(
    @MembershipRankId INT
)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @Discount DECIMAL(5,2) = 0.00;
    DECLARE @RankName NVARCHAR(20);

    SELECT @RankName = MEMBERSHIP_RANK_NAME
    FROM MEMBERSHIP_RANK
    WHERE MEMBERSHIP_RANK_ID = @MembershipRankId;

    IF @RankName LIKE N'%VIP%'       SET @Discount = 0.15;
    ELSE IF @RankName LIKE N'%Vàng%' SET @Discount = 0.10;
    ELSE IF @RankName LIKE N'%Bạc%'  SET @Discount = 0.05;
    ELSE SET @Discount = 0.00;

    RETURN @Discount;
END
GO

/* =========================================================
   1. KỊCH BẢN 1 – KHÁCH HÀNG MỚI ĐĂNG KÝ
   Web flow:
   - (1) /customers/register → uspCustomerCreate
   - (2) /pets/create        → uspPetCreateForCustomer
   - (3) (optional) init spending cho năm hiện tại
   ========================================================= */

-- 1.1 Tạo CUSTOMER (không gộp chung với PET)
CREATE OR ALTER PROCEDURE dbo.uspCustomerCreate
(
    @CustomerName      NVARCHAR(50),
    @CustomerPhone     CHAR(10) = NULL,
    @CustomerEmail     VARCHAR(100),
    @CustomerPassword  CHAR(50),
    @CustomerGender    NVARCHAR(4),
    @CustomerBirthdate DATE = NULL,

    @CustomerId INT OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @RankId INT = dbo.fnGetDefaultMembershipRankId();
        IF @RankId IS NULL
        BEGIN
            RAISERROR('No default membership rank configured.', 16, 1);
            ROLLBACK TRAN;
            RETURN;
        END

        INSERT INTO CUSTOMER
        (
            MEMBERSHIP_RANK_ID,
            CUSTOMER_NAME,
            CUSTOMER_PHONE,
            CUSTOMER_EMAIL,
            EMPLOYEE_PASSWORD,
            CUSTOMER_GENDER,
            CUSTOMER_BIRTHDATE,
            CUSTOMER_LOYALTY
        )
        VALUES
        (
            @RankId,
            @CustomerName,
            @CustomerPhone,
            @CustomerEmail,
            @CustomerPassword,
            @CustomerGender,
            @CustomerBirthdate,
            0
        );

        SET @CustomerId = SCOPE_IDENTITY();

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- 1.2 Tạo PET cho 1 customer
CREATE OR ALTER PROCEDURE dbo.uspPetCreateForCustomer
(
    @CustomerId       INT,
    @PetName          NVARCHAR(20),
    @PetBreedId       INT,
    @PetGender        NVARCHAR(4),
    @PetBirthdate     DATE = NULL,
    @PetHealthStatus  NVARCHAR(20),

    @PetId INT OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM CUSTOMER WHERE CUSTOMER_ID = @CustomerId)
        BEGIN
            RAISERROR('Customer not found.', 16, 1);
            ROLLBACK TRAN;
            RETURN;
        END

        INSERT INTO PET
        (
            CUSTOMER_ID,
            PET_NAME,
            PET_BREED_ID,
            PET_GENDER,
            PET_BIRTHDATE,
            PET_HEALTH_STATUS
        )
        VALUES
        (
            @CustomerId,
            @PetName,
            @PetBreedId,
            @PetGender,
            @PetBirthdate,
            @PetHealthStatus
        );

        SET @PetId = SCOPE_IDENTITY();

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- 1.3 Khởi tạo dòng CUSTOMER_SPENDING cho năm hiện tại (nếu cần)
CREATE OR ALTER PROCEDURE dbo.uspCustomerInitSpendingForCurrentYear
(
    @CustomerId INT
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Year INT = YEAR(GETDATE());

    IF NOT EXISTS (
        SELECT 1
        FROM CUSTOMER_SPENDING
        WHERE CUSTOMER_ID = @CustomerId AND YEAR = @Year
    )
    BEGIN
        INSERT INTO CUSTOMER_SPENDING (CUSTOMER_ID, YEAR, MONEY_SPENT)
        VALUES (@CustomerId, @Year, 0);
    END
END
GO

/* =========================================================
   2. KỊCH BẢN 2 – ĐI KHÁM, THANH TOÁN VÀ TÍCH ĐIỂM
   Web flow:
   - (1) Lễ tân tạo hóa đơn "Chờ thanh toán" → uspReceiptCreateDraft
   - (2) Lễ tân/Bác sĩ tạo phiếu khám → uspCheckUpCreate
   - (3) Bác sĩ update triệu chứng / chẩn đoán → uspCheckUpUpdateNotes
   - (4) Bác sĩ kê toa → uspPrescriptionReplaceForCheckUp
   - (5) Hệ thống/FE thêm các item toa vào hóa đơn → uspReceiptAddItems (1 hoặc nhiều lần)
   - (6) Lễ tân nhấn "Thanh toán" → uspReceiptMarkCompletedAndAccumulate
   ========================================================= */

-- 2.1 Tạo HÓA ĐƠN ở trạng thái dự thảo / chờ thanh toán
CREATE OR ALTER PROCEDURE dbo.uspReceiptCreateDraft
(
    @BranchId       INT,
    @CustomerId     INT,
    @ReceptionistId INT,
    @PaymentMethod  NVARCHAR(20),

    @ReceiptId INT OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        INSERT INTO RECEIPT
        (
            BRANCH_ID,
            CUSTOMER_ID,
            RECEPTIONIST_ID,
            RECEIPT_CREATED_DATE,
            RECEIPT_TOTAL_PRICE,
            RECEIPT_PAYMENT_METHOD,
            RECEIPT_STATUS
        )
        VALUES
        (
            @BranchId,
            @CustomerId,
            @ReceptionistId,
            GETDATE(),
            0,                        -- chưa có total
            @PaymentMethod,
            N'Chờ thanh toán'
        );

        SET @ReceiptId = SCOPE_IDENTITY();

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- 2.2 Thêm 1 hoặc nhiều items vào RECEIPT (và tự tính giá, không đụng loyalty)
CREATE OR ALTER PROCEDURE dbo.uspReceiptAddItems
(
    @ReceiptId INT,
    @Items     dbo.ReceiptItemType READONLY
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM RECEIPT WHERE RECEIPT_ID = @ReceiptId)
        BEGIN
            RAISERROR('Receipt not found.', 16, 1);
            ROLLBACK TRAN;
            RETURN;
        END

        DECLARE @MaxItemId INT;

        SELECT @MaxItemId = ISNULL(MAX(RECEIPT_ITEM_ID), 0)
        FROM RECEIPT_DETAIL
        WHERE RECEIPT_ID = @ReceiptId;

        ;WITH PriceCTE AS (
            SELECT
                i.ProductId,
                i.PetId,
                i.Quantity,
                COALESCE(i.Price, sp.SALES_PRODUCT_PRICE) AS UnitPrice
            FROM @Items i
            LEFT JOIN SALES_PRODUCT sp
                ON sp.SALES_PRODUCT_ID = i.ProductId
        ),
        RowCTE AS (
            SELECT
                ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS rn,
                ProductId,
                PetId,
                Quantity,
                UnitPrice
            FROM PriceCTE
        )
        INSERT INTO RECEIPT_DETAIL
        (
            RECEIPT_ITEM_ID,
            RECEIPT_ID,
            PRODUCT_ID,
            PET_ID,
            RECEIPT_ITEM_AMOUNT,
            RECEIPT_ITEM_PRICE
        )
        SELECT
            @MaxItemId + rn,
            @ReceiptId,
            ProductId,
            PetId,
            Quantity,
            UnitPrice
        FROM RowCTE;

        -- Recalc tổng tiền
        DECLARE @Total DECIMAL(18,0);
        SELECT @Total = SUM(RECEIPT_ITEM_AMOUNT * RECEIPT_ITEM_PRICE)
        FROM RECEIPT_DETAIL
        WHERE RECEIPT_ID = @ReceiptId;

        UPDATE RECEIPT
        SET RECEIPT_TOTAL_PRICE = @Total
        WHERE RECEIPT_ID = @ReceiptId;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- 2.3 Tạo PHIẾU KHÁM (độc lập với việc tạo hóa đơn)
CREATE OR ALTER PROCEDURE dbo.uspCheckUpCreate
(
    @PetId            INT,
    @VetId            INT,
    @MedicalServiceId INT,             -- ID trong MEDICAL_SERVICE

    @CheckUpId INT OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        INSERT INTO CHECK_UP
        (
            MEDICAL_SERVICE,
            PET_ID,
            VET_ID,
            SYMPTOMS,
            DIAGNOSIS,
            PRESCRIPTION_AVAILABLE,
            FOLLOW_UP_VISIT,
            STATUS
        )
        VALUES
        (
            @MedicalServiceId,
            @PetId,
            @VetId,
            NULL,
            NULL,
            0,
            NULL,
            N'Chờ'
        );

        SET @CheckUpId = SCOPE_IDENTITY();

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- 2.4 Bác sĩ cập nhật triệu chứng, chẩn đoán, ngày tái khám
CREATE OR ALTER PROCEDURE dbo.uspCheckUpUpdateNotes
(
    @CheckUpId      INT,
    @Symptoms       NVARCHAR(MAX) = NULL,
    @Diagnosis      NVARCHAR(MAX) = NULL,
    @FollowUpVisit  DATETIME       = NULL,
    @Status         NVARCHAR(10)   = NULL  -- 'Chờ', 'Hoàn tất', ...
)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE CHECK_UP
    SET
        SYMPTOMS       = COALESCE(@Symptoms, SYMPTOMS),
        DIAGNOSIS      = COALESCE(@Diagnosis, DIAGNOSIS),
        FOLLOW_UP_VISIT = COALESCE(@FollowUpVisit, FOLLOW_UP_VISIT),
        STATUS         = COALESCE(@Status, STATUS)
    WHERE CHECK_UP_ID = @CheckUpId;
END
GO

-- 2.5 Ghi toa thuốc cho 1 phiếu khám (clear cũ + insert mới)
CREATE OR ALTER PROCEDURE dbo.uspPrescriptionReplaceForCheckUp
(
    @CheckUpId INT,
    @Items     dbo.ReceiptItemType READONLY  -- dùng ProductId, Quantity
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM CHECK_UP WHERE CHECK_UP_ID = @CheckUpId)
        BEGIN
            RAISERROR('Check up not found.', 16, 1);
            ROLLBACK TRAN;
            RETURN;
        END

        DELETE FROM PRESCRIPTION_DETAIL
        WHERE CHECK_UP_ID = @CheckUpId;

        ;WITH ItemsCTE AS (
            SELECT
                ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS rn,
                ProductId,
                Quantity
            FROM @Items
        )
        INSERT INTO PRESCRIPTION_DETAIL
        (
            CHECK_UP_ID,
            PRESCRIPTION_NUMBER,
            PRODUCT_ID,
            QUANTITY
        )
        SELECT
            @CheckUpId,
            rn,
            ProductId,
            Quantity
        FROM ItemsCTE;

        UPDATE CHECK_UP
        SET PRESCRIPTION_AVAILABLE = CASE WHEN EXISTS (
                SELECT 1 FROM PRESCRIPTION_DETAIL WHERE CHECK_UP_ID = @CheckUpId
            ) THEN 1 ELSE 0 END
        WHERE CHECK_UP_ID = @CheckUpId;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- 2.6 Thanh toán hóa đơn + cập nhật spending & loyalty
CREATE OR ALTER PROCEDURE dbo.uspReceiptMarkCompletedAndAccumulate
(
    @ReceiptId INT
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        DECLARE
            @CustomerId INT,
            @Total      DECIMAL(18,0),
            @Status     NVARCHAR(20),
            @Created    DATETIME;

        SELECT
            @CustomerId = CUSTOMER_ID,
            @Total      = RECEIPT_TOTAL_PRICE,
            @Status     = RECEIPT_STATUS,
            @Created    = RECEIPT_CREATED_DATE
        FROM RECEIPT
        WHERE RECEIPT_ID = @ReceiptId;

        IF @CustomerId IS NULL
        BEGIN
            RAISERROR('Receipt not found.', 16, 1);
            ROLLBACK TRAN;
            RETURN;
        END

        IF @Status = N'Đã hoàn thành'
        BEGIN
            COMMIT TRAN;
            RETURN;
        END

        UPDATE RECEIPT
        SET RECEIPT_STATUS = N'Đã hoàn thành'
        WHERE RECEIPT_ID = @ReceiptId;

        DECLARE @Year INT = YEAR(@Created);

        IF EXISTS (SELECT 1 FROM CUSTOMER_SPENDING WHERE CUSTOMER_ID = @CustomerId AND YEAR = @Year)
        BEGIN
            UPDATE CUSTOMER_SPENDING
            SET MONEY_SPENT = MONEY_SPENT + @Total
            WHERE CUSTOMER_ID = @CustomerId AND YEAR = @Year;
        END
        ELSE
        BEGIN
            INSERT INTO CUSTOMER_SPENDING (CUSTOMER_ID, YEAR, MONEY_SPENT)
            VALUES (@CustomerId, @Year, @Total);
        END

        DECLARE @Points INT = dbo.fnCalculateLoyaltyPoints(@Total);

        UPDATE CUSTOMER
        SET CUSTOMER_LOYALTY = CUSTOMER_LOYALTY + @Points
        WHERE CUSTOMER_ID = @CustomerId;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

/* =========================================================
   3. KỊCH BẢN 3 – KHÁCH HÀNG THÂN THIẾT MUA GÓI TIÊM PHÒNG
   Web flow:
   - FE query plan để show giá/ưu đãi → (SELECT, không cần proc)
   - Ấn "Đăng ký + Thanh toán":
        + (1) tạo PET_VACCINATION_PLAN    → uspPetVaccinationPlanCreate
        + (2) tạo Hóa đơn & cộng điểm     → uspReceiptCreateForVaccinationPlan
   2 bước này có thể được bọc trong API server-side transaction; 
   ở DB để 2 proc nhỏ, không gộp.
   ========================================================= */

-- 3.1 Tạo PET_VACCINATION_PLAN cho 1 pet + 1 plan
CREATE OR ALTER PROCEDURE dbo.uspPetVaccinationPlanCreate
(
    @PetId             INT,
    @VaccinationPlanId INT,
    @PlanStartDate     DATE,

    @PetVaccinationPlanId INT OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @Duration INT, @PlanEndDate DATE;

        SELECT @Duration = VACCINATION_PLAN_DURATION
        FROM VACCINATION_PLAN
        WHERE VACCINATION_PLAN_ID = @VaccinationPlanId;

        IF @Duration IS NULL
        BEGIN
            RAISERROR('Vaccination plan not found.', 16, 1);
            ROLLBACK TRAN;
            RETURN;
        END

        SET @PlanEndDate = DATEADD(MONTH, @Duration, @PlanStartDate);

        INSERT INTO PET_VACCINATION_PLAN
        (
            PET_ID,
            VACCINATION_PLAN_ID,
            PLAN_START_DATE,
            PLAN_END_DATE
        )
        VALUES
        (
            @PetId,
            @VaccinationPlanId,
            @PlanStartDate,
            @PlanEndDate
        );

        SET @PetVaccinationPlanId = SCOPE_IDENTITY();

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- 3.2 Tạo hóa đơn cho gói tiêm (áp dụng ưu đãi + cộng điểm)
CREATE OR ALTER PROCEDURE dbo.uspReceiptCreateForVaccinationPlan
(
    @CustomerId        INT,
    @BranchId          INT,
    @ReceptionistId    INT,
    @PaymentMethod     NVARCHAR(20),
    @VaccinationPlanId INT,
    @PetId             INT,

    @ReceiptId INT OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        DECLARE
            @PlanPrice   DECIMAL(18,0),
            @RankId      INT,
            @DiscountPct DECIMAL(5,2),
            @FinalPrice  DECIMAL(18,0),
            @Year        INT = YEAR(GETDATE());

        SELECT @PlanPrice = VACCINATION_PLAN_PRICE
        FROM VACCINATION_PLAN
        WHERE VACCINATION_PLAN_ID = @VaccinationPlanId;

        IF @PlanPrice IS NULL
        BEGIN
            RAISERROR('Vaccination plan not found.', 16, 1);
            ROLLBACK TRAN;
            RETURN;
        END

        SELECT @RankId = MEMBERSHIP_RANK_ID
        FROM CUSTOMER
        WHERE CUSTOMER_ID = @CustomerId;

        IF @RankId IS NULL
        BEGIN
            RAISERROR('Customer not found.', 16, 1);
            ROLLBACK TRAN;
            RETURN;
        END

        SET @DiscountPct = dbo.fnGetMembershipDiscountPercent(@RankId);
        SET @FinalPrice  = CAST(@PlanPrice * (1 - @DiscountPct) AS DECIMAL(18,0));

        INSERT INTO RECEIPT
        (
            BRANCH_ID,
            CUSTOMER_ID,
            RECEPTIONIST_ID,
            RECEIPT_CREATED_DATE,
            RECEIPT_TOTAL_PRICE,
            RECEIPT_PAYMENT_METHOD,
            RECEIPT_STATUS
        )
        VALUES
        (
            @BranchId,
            @CustomerId,
            @ReceptionistId,
            GETDATE(),
            @FinalPrice,
            @PaymentMethod,
            N'Đã hoàn thành'
        );

        SET @ReceiptId = SCOPE_IDENTITY();

        INSERT INTO RECEIPT_DETAIL
        (
            RECEIPT_ITEM_ID,
            RECEIPT_ID,
            PRODUCT_ID,
            PET_ID,
            RECEIPT_ITEM_AMOUNT,
            RECEIPT_ITEM_PRICE
        )
        VALUES
        (
            1,
            @ReceiptId,
            @VaccinationPlanId,  -- mapping qua PRODUCT
            @PetId,
            1,
            @FinalPrice
        );

        IF EXISTS (SELECT 1 FROM CUSTOMER_SPENDING WHERE CUSTOMER_ID = @CustomerId AND YEAR = @Year)
        BEGIN
            UPDATE CUSTOMER_SPENDING
            SET MONEY_SPENT = MONEY_SPENT + @FinalPrice
            WHERE CUSTOMER_ID = @CustomerId AND YEAR = @Year;
        END
        ELSE
        BEGIN
            INSERT INTO CUSTOMER_SPENDING (CUSTOMER_ID, YEAR, MONEY_SPENT)
            VALUES (@CustomerId, @Year, @FinalPrice);
        END

        DECLARE @Points INT = dbo.fnCalculateLoyaltyPoints(@FinalPrice);

        UPDATE CUSTOMER
        SET CUSTOMER_LOYALTY = CUSTOMER_LOYALTY + @Points
        WHERE CUSTOMER_ID = @CustomerId;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

/* =========================================================
   4. KỊCH BẢN 4 – MUA HÀNG TẠI CỬA HÀNG & TỒN KHO
   Web flow gợi ý:
   - (1) FE quét sản phẩm → API lấy tồn kho (SELECT)
   - (2) Khi bấm "Thanh toán":
        + gọi 1 proc atomic: check tồn kho + tạo hóa đơn + trừ kho + cộng điểm
     → việc này trong thực tế vẫn nên gộp 1 transaction (nút Thanh toán).
   ========================================================= */

CREATE OR ALTER PROCEDURE dbo.uspRetailPurchaseWithStockCheck
(
    @BranchId       INT,
    @CustomerId     INT,
    @ReceptionistId INT,
    @PaymentMethod  NVARCHAR(20),
    @Items          dbo.ReceiptItemType READONLY,

    @ReceiptId INT OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        -- Check stock
        IF EXISTS (
            SELECT 1
            FROM @Items i
            LEFT JOIN BRANCH_STOCK s
                ON s.BRANCH_ID = @BranchId
               AND s.SALES_PRODUCT_ID = i.ProductId
            WHERE s.SALES_PRODUCT_ID IS NULL
               OR s.QUANTITY < i.Quantity
        )
        BEGIN
            RAISERROR('Not enough stock for one or more items.', 16, 1);
            ROLLBACK TRAN;
            RETURN;
        END

        DECLARE @Total DECIMAL(18,0);

        ;WITH PriceCTE AS (
            SELECT
                i.ProductId,
                i.PetId,
                i.Quantity,
                COALESCE(i.Price, sp.SALES_PRODUCT_PRICE) AS UnitPrice
            FROM @Items i
            LEFT JOIN SALES_PRODUCT sp
                ON sp.SALES_PRODUCT_ID = i.ProductId
        )
        SELECT @Total = SUM(Quantity * UnitPrice)
        FROM PriceCTE;

        INSERT INTO RECEIPT
        (
            BRANCH_ID,
            CUSTOMER_ID,
            RECEPTIONIST_ID,
            RECEIPT_CREATED_DATE,
            RECEIPT_TOTAL_PRICE,
            RECEIPT_PAYMENT_METHOD,
            RECEIPT_STATUS
        )
        VALUES
        (
            @BranchId,
            @CustomerId,
            @ReceptionistId,
            GETDATE(),
            @Total,
            @PaymentMethod,
            N'Đã thanh toán'
        );

        SET @ReceiptId = SCOPE_IDENTITY();

        ;WITH PriceCTE AS (
            SELECT
                i.ProductId,
                i.PetId,
                i.Quantity,
                COALESCE(i.Price, sp.SALES_PRODUCT_PRICE) AS UnitPrice
            FROM @Items i
            LEFT JOIN SALES_PRODUCT sp
                ON sp.SALES_PRODUCT_ID = i.ProductId
        ),
        RowCTE AS (
            SELECT
                ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS rn,
                ProductId,
                PetId,
                Quantity,
                UnitPrice
            FROM PriceCTE
        )
        INSERT INTO RECEIPT_DETAIL
        (
            RECEIPT_ITEM_ID,
            RECEIPT_ID,
            PRODUCT_ID,
            PET_ID,
            RECEIPT_ITEM_AMOUNT,
            RECEIPT_ITEM_PRICE
        )
        SELECT
            rn,
            @ReceiptId,
            ProductId,
            PetId,
            Quantity,
            UnitPrice
        FROM RowCTE;

        UPDATE s
        SET s.QUANTITY = s.QUANTITY - i.Quantity
        FROM BRANCH_STOCK s
        JOIN @Items i
            ON s.BRANCH_ID = @BranchId
           AND s.SALES_PRODUCT_ID = i.ProductId;

        DECLARE @Year INT = YEAR(GETDATE());

        IF EXISTS (SELECT 1 FROM CUSTOMER_SPENDING WHERE CUSTOMER_ID = @CustomerId AND YEAR = @Year)
        BEGIN
            UPDATE CUSTOMER_SPENDING
            SET MONEY_SPENT = MONEY_SPENT + @Total
            WHERE CUSTOMER_ID = @CustomerId AND YEAR = @Year;
        END
        ELSE
        BEGIN
            INSERT INTO CUSTOMER_SPENDING (CUSTOMER_ID, YEAR, MONEY_SPENT)
            VALUES (@CustomerId, @Year, @Total);
        END

        DECLARE @Points INT = dbo.fnCalculateLoyaltyPoints(@Total);

        UPDATE CUSTOMER
        SET CUSTOMER_LOYALTY = CUSTOMER_LOYALTY + @Points
        WHERE CUSTOMER_ID = @CustomerId;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

/* =========================================================
   5. KỊCH BẢN 5 – QUẢN LÝ CHI NHÁNH XEM BÁO CÁO CUỐI NGÀY
   Một nút "Xem báo cáo" = 1 procedure trả về nhiều result set.
   ========================================================= */

CREATE OR ALTER PROCEDURE dbo.uspGetBranchDailyReport
(
    @BranchId   INT,
    @ReportDate DATE
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Start DATETIME = CAST(@ReportDate AS DATETIME);
    DECLARE @End   DATETIME = DATEADD(DAY, 1, @Start);

    -- 1) Doanh thu trong ngày
    SELECT
        r.BRANCH_ID,
        TotalRevenue = SUM(r.RECEIPT_TOTAL_PRICE),
        ReceiptCount = COUNT(*)
    FROM RECEIPT r
    WHERE r.BRANCH_ID = @BranchId
      AND r.RECEIPT_STATUS = N'Đã hoàn thành'
      AND r.RECEIPT_CREATED_DATE >= @Start
      AND r.RECEIPT_CREATED_DATE <  @End
    GROUP BY r.BRANCH_ID;

    -- 2) Hiệu suất nhân viên lễ tân/bán hàng
    SELECT
        e.EMPLOYEE_ID,
        e.EMPLOYEE_NAME,
        ReceiptCount  = COUNT(r.RECEIPT_ID),
        TotalRevenue  = SUM(r.RECEIPT_TOTAL_PRICE),
        AvgReceiptVal = AVG(CAST(r.RECEIPT_TOTAL_PRICE AS DECIMAL(18,2)))
    FROM EMPLOYEE e
    LEFT JOIN RECEIPT r
        ON r.RECEPTIONIST_ID = e.EMPLOYEE_ID
       AND r.BRANCH_ID = @BranchId
       AND r.RECEIPT_STATUS = N'Đã hoàn thành'
       AND r.RECEIPT_CREATED_DATE >= @Start
       AND r.RECEIPT_CREATED_DATE <  @End
    WHERE e.BRANCH_ID = @BranchId
    GROUP BY e.EMPLOYEE_ID, e.EMPLOYEE_NAME;

    -- 3) Thống kê khách hàng (khách mới/quay lại)
    ;WITH TodayReceipts AS (
        SELECT DISTINCT r.CUSTOMER_ID
        FROM RECEIPT r
        WHERE r.BRANCH_ID = @BranchId
          AND r.RECEIPT_STATUS = N'Đã hoàn thành'
          AND r.RECEIPT_CREATED_DATE >= @Start
          AND r.RECEIPT_CREATED_DATE <  @End
    ),
    FirstReceiptDate AS (
        SELECT
            CUSTOMER_ID,
            MIN(RECEIPT_CREATED_DATE) AS FirstDate
        FROM RECEIPT
        GROUP BY CUSTOMER_ID
    )
    SELECT
        TotalCustomersToday = COUNT(t.CUSTOMER_ID),
        NewCustomers        = SUM(CASE WHEN CAST(f.FirstDate AS DATE) = @ReportDate THEN 1 ELSE 0 END),
        ReturningCustomers  = SUM(CASE WHEN CAST(f.FirstDate AS DATE) < @ReportDate THEN 1 ELSE 0 END)
    FROM TodayReceipts t
    JOIN FirstReceiptDate f
        ON f.CUSTOMER_ID = t.CUSTOMER_ID;

    -- 4) Phân bố điểm đánh giá trong ngày
    SELECT
        Score = r.OVERALL_SCORE,
        CountReview = COUNT(*)
    FROM REVIEW r
    JOIN RECEIPT re
        ON re.RECEIPT_ID = r.RECEIPT_ID
    WHERE re.BRANCH_ID = @BranchId
      AND re.RECEIPT_CREATED_DATE >= @Start
      AND re.RECEIPT_CREATED_DATE <  @End
    GROUP BY r.OVERALL_SCORE
    ORDER BY Score;
END
GO

/* =========================================================
   6. KỊCH BẢN 6 – GIÁM ĐỐC VẬN HÀNH XÉT THĂNG HẠNG CUỐI NĂM
   Nút "Chạy tổng kết cuối năm" trả kết quả
   ========================================================= */

CREATE OR ALTER PROCEDURE dbo.uspRunYearlyMembershipReview
(
    @Year INT
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        ;WITH ReceiptYearly AS (
            SELECT
                r.CUSTOMER_ID,
                [YEAR]    = @Year,
                TotalSpent = SUM(r.RECEIPT_TOTAL_PRICE)
            FROM RECEIPT r
            WHERE r.RECEIPT_STATUS = N'Đã hoàn thành'
              AND YEAR(r.RECEIPT_CREATED_DATE) = @Year
            GROUP BY r.CUSTOMER_ID
        )
        MERGE CUSTOMER_SPENDING AS tgt
        USING ReceiptYearly AS src
           ON tgt.CUSTOMER_ID = src.CUSTOMER_ID
          AND tgt.YEAR        = src.[YEAR]
        WHEN MATCHED THEN
            UPDATE SET MONEY_SPENT = src.TotalSpent
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (CUSTOMER_ID, YEAR, MONEY_SPENT)
            VALUES (src.CUSTOMER_ID, src.[YEAR], src.TotalSpent)
        WHEN NOT MATCHED BY SOURCE AND tgt.YEAR = @Year THEN
            UPDATE SET MONEY_SPENT = 0
        ;

        ;WITH CustSpend AS (
            SELECT
                c.CUSTOMER_ID,
                c.MEMBERSHIP_RANK_ID AS CurrentRankId,
                s.MONEY_SPENT
            FROM CUSTOMER c
            LEFT JOIN CUSTOMER_SPENDING s
                ON s.CUSTOMER_ID = c.CUSTOMER_ID
               AND s.YEAR        = @Year
        ),
        TargetRank AS (
            SELECT
                cs.CUSTOMER_ID,
                cs.CurrentRankId,
                cs.MONEY_SPENT,
                NewRankId = COALESCE((
                    SELECT TOP(1) r.MEMBERSHIP_RANK_ID
                    FROM MEMBERSHIP_RANK r
                    WHERE cs.MONEY_SPENT >= r.MEMBERSHIP_RANK_UPGRADE_CONDITION
                    ORDER BY r.MEMBERSHIP_RANK_UPGRADE_CONDITION DESC
                ), cs.CurrentRankId)
            FROM CustSpend cs
        ),
        Classified AS (
            SELECT
                CUSTOMER_ID,
                CurrentRankId,
                NewRankId,
                MONEY_SPENT,
                CaseType = CASE
                    WHEN NewRankId = CurrentRankId THEN 'KEEP'
                    WHEN NewRankId > CurrentRankId THEN 'UPGRADE'
                    WHEN NewRankId < CurrentRankId THEN 'DOWNGRADE'
                END
            FROM TargetRank
        )
        SELECT * INTO #MembershipReview FROM Classified;

        UPDATE c
        SET c.MEMBERSHIP_RANK_ID = r.NewRankId
        FROM CUSTOMER c
        JOIN #MembershipReview r
            ON r.CUSTOMER_ID = c.CUSTOMER_ID;

        -- Summary
        SELECT
            CaseType,
            CustomerCount = COUNT(*)
        FROM #MembershipReview
        GROUP BY CaseType;

        -- Detail (để FE export CSV, v.v.)
        SELECT
            r.CUSTOMER_ID,
            CurrentRankName = cr.MEMBERSHIP_RANK_NAME,
            NewRankName     = nr.MEMBERSHIP_RANK_NAME,
            r.MONEY_SPENT,
            r.CaseType
        FROM #MembershipReview r
        LEFT JOIN MEMBERSHIP_RANK cr ON cr.MEMBERSHIP_RANK_ID = r.CurrentRankId
        LEFT JOIN MEMBERSHIP_RANK nr ON nr.MEMBERSHIP_RANK_ID = r.NewRankId
        ORDER BY r.CaseType, r.CUSTOMER_ID;

        DROP TABLE #MembershipReview;

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO
