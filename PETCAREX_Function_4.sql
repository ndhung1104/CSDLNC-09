
-- ==============================================
-- PART 4: ANALYTICS, REPORTING & KPI
-- (Chỉ sửa mô tả/comment tiếng Việt; code giữ nguyên)
-- ==============================================

-- uspRevenueStats
--   Type: procedure
--   Thống kê doanh thu theo ngày/tháng/quý/năm, lọc theo chi nhánh hoặc toàn hệ thống.
CREATE OR ALTER PROCEDURE dbo.uspRevenueStats
  @BranchId INT = NULL,
  @Granularity NVARCHAR(10) = N'day' -- day|month|quarter|year
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    CASE @Granularity
      WHEN 'day' THEN CAST(RECEIPT_CREATED_DATE AS DATE)
      WHEN 'month' THEN DATEFROMPARTS(YEAR(RECEIPT_CREATED_DATE), MONTH(RECEIPT_CREATED_DATE), 1)
      WHEN 'quarter' THEN DATEFROMPARTS(YEAR(RECEIPT_CREATED_DATE), ((DATEPART(QUARTER, RECEIPT_CREATED_DATE)-1)*3)+1, 1)
      ELSE DATEFROMPARTS(YEAR(RECEIPT_CREATED_DATE),1,1)
    END AS PeriodStart,
    SUM(RECEIPT_TOTAL_PRICE) AS Revenue
  FROM RECEIPT
  WHERE RECEIPT_STATUS IS NOT NULL
    AND (@BranchId IS NULL OR BRANCH_ID = @BranchId)
  GROUP BY CASE @Granularity
      WHEN 'day' THEN CAST(RECEIPT_CREATED_DATE AS DATE)
      WHEN 'month' THEN DATEFROMPARTS(YEAR(RECEIPT_CREATED_DATE), MONTH(RECEIPT_CREATED_DATE), 1)
      WHEN 'quarter' THEN DATEFROMPARTS(YEAR(RECEIPT_CREATED_DATE), ((DATEPART(QUARTER, RECEIPT_CREATED_DATE)-1)*3)+1, 1)
      ELSE DATEFROMPARTS(YEAR(RECEIPT_CREATED_DATE),1,1)
    END;
END;
GO

-- uspTopServicesByRevenue
--   Type: procedure
--   Top dịch vụ/sản phẩm theo doanh thu trong số tháng gần nhất.
CREATE OR ALTER PROCEDURE dbo.uspTopServicesByRevenue
  @MonthsBack INT = 6,
  @TopN INT = 5
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @from DATE = DATEADD(MONTH, -@MonthsBack, CAST(GETDATE() AS DATE));
  SELECT TOP (@TopN) rd.PRODUCT_ID, p.PRODUCT_NAME, SUM(rd.RECEIPT_ITEM_AMOUNT * rd.RECEIPT_ITEM_PRICE) AS Revenue
  FROM RECEIPT_DETAIL rd
  JOIN RECEIPT r ON rd.RECEIPT_ID = r.RECEIPT_ID
  JOIN PRODUCT p ON rd.PRODUCT_ID = p.PRODUCT_ID
  WHERE r.RECEIPT_CREATED_DATE >= @from
  GROUP BY rd.PRODUCT_ID, p.PRODUCT_NAME
  ORDER BY Revenue DESC;
END;
GO

-- uspVaccineUsageStats
--   Type: procedure
--   Thống kê số lần sử dụng vaccine theo khoảng ngày.
CREATE OR ALTER PROCEDURE dbo.uspVaccineUsageStats
  @FromDate DATE = NULL,
  @ToDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT vac.VACCINE_NAME, COUNT(*) AS UsageCount
  FROM VACCINATION v
  JOIN BRANCH_VACCINE_BATCH bvb ON v.VACCINE_BATCH_ID = bvb.VACCINE_BATCH_ID
  JOIN VACCINE vac ON bvb.VACCINE_ID = vac.VACCINE_ID
  WHERE (@FromDate IS NULL OR CAST(v.VACCINATION_ID AS DATE) >= @FromDate)
    AND (@ToDate IS NULL OR CAST(v.VACCINATION_ID AS DATE) <= @ToDate)
  GROUP BY vac.VACCINE_NAME;
END;
GO

-- uspCustomerTierDistribution
--   Type: procedure
--   Phân bố khách hàng theo hạng membership.
CREATE OR ALTER PROCEDURE dbo.uspCustomerTierDistribution
AS
BEGIN
  SET NOCOUNT ON;
  SELECT mr.MEMBERSHIP_RANK_NAME, COUNT(*) AS CustomerCount
  FROM CUSTOMER c
  JOIN MEMBERSHIP_RANK mr ON c.MEMBERSHIP_RANK_ID = mr.MEMBERSHIP_RANK_ID
  GROUP BY mr.MEMBERSHIP_RANK_NAME;
END;
GO

-- uspCustomerRetentionStats
--   Type: procedure
--   Thống kê khách hàng quay lại/không quay lại trong N tháng.
CREATE OR ALTER PROCEDURE dbo.uspCustomerRetentionStats
  @Months INT = 12
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @cutoff DATE = DATEADD(MONTH, -@Months, CAST(GETDATE() AS DATE));
  SELECT
    SUM(CASE WHEN LastVisit >= @cutoff THEN 1 ELSE 0 END) AS ActiveCustomers,
    SUM(CASE WHEN LastVisit < @cutoff THEN 1 ELSE 0 END) AS InactiveCustomers
  FROM (
    SELECT CUSTOMER_ID, MAX(RECEIPT_CREATED_DATE) AS LastVisit
    FROM RECEIPT
    GROUP BY CUSTOMER_ID
  ) x;
END;
GO

-- uspAppointmentStats
--   Type: procedure
--   Thống kê số lượng lịch hẹn theo trạng thái và khoảng ngày.
CREATE OR ALTER PROCEDURE dbo.uspAppointmentStats
  @FromDate DATE = NULL,
  @ToDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT APPOINTMENT_STATUS, COUNT(*) AS Cnt
  FROM APPOINTMENT
  WHERE (@FromDate IS NULL OR CAST(APPOINTMENT_DATE AS DATE) >= @FromDate)
    AND (@ToDate IS NULL OR CAST(APPOINTMENT_DATE AS DATE) <= @ToDate)
  GROUP BY APPOINTMENT_STATUS;
END;
GO

-- uspEmployeePerformance
--   Type: procedure
--   Hiệu suất nhân viên (số ca khám/tiêm/hóa đơn) trong khoảng ngày.
CREATE OR ALTER PROCEDURE dbo.uspEmployeePerformance
  @FromDate DATE = NULL,
  @ToDate DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT e.EMPLOYEE_ID, e.EMPLOYEE_NAME,
    SUM(CASE WHEN cu.CHECK_UP_ID IS NOT NULL THEN 1 ELSE 0 END) AS CheckUps,
    SUM(CASE WHEN v.VACCINATION_ID IS NOT NULL THEN 1 ELSE 0 END) AS Vaccinations,
    SUM(CASE WHEN r.RECEIPT_ID IS NOT NULL THEN 1 ELSE 0 END) AS Receipts
  FROM EMPLOYEE e
  LEFT JOIN CHECK_UP cu ON cu.VET_ID = e.EMPLOYEE_ID AND (@FromDate IS NULL OR CAST(cu.CHECK_UP_ID AS DATE) >= @FromDate) AND (@ToDate IS NULL OR CAST(cu.CHECK_UP_ID AS DATE) <= @ToDate)
  LEFT JOIN VACCINATION v ON v.VET_ID = e.EMPLOYEE_ID AND (@FromDate IS NULL OR CAST(v.VACCINATION_ID AS DATE) >= @FromDate) AND (@ToDate IS NULL OR CAST(v.VACCINATION_ID AS DATE) <= @ToDate)
  LEFT JOIN RECEIPT r ON r.RECEPTIONIST_ID = e.EMPLOYEE_ID AND (@FromDate IS NULL OR CAST(r.RECEIPT_CREATED_DATE AS DATE) >= @FromDate) AND (@ToDate IS NULL OR CAST(r.RECEIPT_CREATED_DATE AS DATE) <= @ToDate)
  GROUP BY e.EMPLOYEE_ID, e.EMPLOYEE_NAME;
END;
GO

-- uspBranchInventoryReport
--   Type: procedure
--   Báo cáo tồn kho (hàng bán + vaccine) của chi nhánh.
CREATE OR ALTER PROCEDURE dbo.uspBranchInventoryReport
  @BranchId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT 'SalesProduct' AS ItemType, p.PRODUCT_NAME, bs.QUANTITY
  FROM BRANCH_STOCK bs
  JOIN SALES_PRODUCT sp ON bs.SALES_PRODUCT_ID = sp.SALES_PRODUCT_ID
  JOIN PRODUCT p ON sp.SALES_PRODUCT_ID = p.PRODUCT_ID
  WHERE bs.BRANCH_ID = @BranchId
  UNION ALL
  SELECT 'VaccineBatch', vac.VACCINE_NAME + ' (Batch ' + CAST(bvb.VACCINE_BATCH_ID AS NVARCHAR(10)) + ')', bvb.VACCINE_BATCH_QUANTITY
  FROM BRANCH_VACCINE_BATCH bvb
  JOIN VACCINE vac ON bvb.VACCINE_ID = vac.VACCINE_ID
  WHERE bvb.BRANCH_ID = @BranchId;
END;
GO

-- uspPetVaccinationDueSoon
--   Type: procedure
--   Danh sách thú cưng sắp tới lịch tiêm trong số ngày cấu hình.
CREATE OR ALTER PROCEDURE dbo.uspPetVaccinationDueSoon
  @WithinDays INT = 30
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @today DATE = CAST(GETDATE() AS DATE);
  SELECT pvp.PET_VACCINATION_PLAN_ID, p.PET_NAME, c.CUSTOMER_NAME, vpd.VACCINE_ID, vpd.VACCINE_DOSAGE,
         DATEADD(DAY, vpd.VACCINE_DOSAGE, pvp.PLAN_START_DATE) AS ExpectedDate
  FROM PET_VACCINATION_PLAN pvp
  JOIN PET p ON pvp.PET_ID = p.PET_ID
  JOIN CUSTOMER c ON p.CUSTOMER_ID = c.CUSTOMER_ID
  JOIN VACCINATION_PLAN_DETAIL vpd ON pvp.VACCINATION_PLAN_ID = vpd.VACCINATION_PLAN_ID
  WHERE DATEADD(DAY, vpd.VACCINE_DOSAGE, pvp.PLAN_START_DATE) BETWEEN @today AND DATEADD(DAY, @WithinDays, @today);
END;
GO

-- uspSpendingByCustomer
--   Type: procedure
--   Báo cáo chi tiêu tổng theo khách hàng.
CREATE OR ALTER PROCEDURE dbo.uspSpendingByCustomer
AS
BEGIN
  SET NOCOUNT ON;
  SELECT c.CUSTOMER_ID, c.CUSTOMER_NAME, SUM(r.RECEIPT_TOTAL_PRICE) AS TotalSpending
  FROM CUSTOMER c
  LEFT JOIN RECEIPT r ON c.CUSTOMER_ID = r.CUSTOMER_ID
  GROUP BY c.CUSTOMER_ID, c.CUSTOMER_NAME;
END;
GO
