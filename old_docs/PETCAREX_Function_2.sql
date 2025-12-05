-- ==============================================
-- PART 2: APPOINTMENTS, MEDICAL RECORDS, VACCINATION
-- (Ghi chú: chỉ chỉnh comment tiếng Việt, giữ nguyên code thủ tục/hàm)
-- ==============================================

-- uspAppointmentAvailableSlots
--   Type: procedure
--   Trả danh sách slot trống cho chi nhánh/dịch vụ trong ngày, tính theo khung giờ mở cửa và lịch đã đặt.
CREATE OR ALTER PROCEDURE dbo.uspAppointmentAvailableSlots
  @BranchId INT,
  @ServiceId INT,
  @Date DATE,
  @IntervalMinutes INT = 60
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @open TIME, @close TIME;
  SELECT @open = BRANCH_OPEN_TIME, @close = BRANCH_CLOSED_TIME FROM BRANCH WHERE BRANCH_ID = @BranchId;
  IF @open IS NULL
  BEGIN
    RAISERROR('Branch not found',16,1);
    RETURN;
  END
  ;WITH Slots AS (
    SELECT CAST(@Date AS DATETIME) + CAST(@open AS DATETIME) AS SlotTime
    UNION ALL
    SELECT DATEADD(MINUTE,@IntervalMinutes,SlotTime) FROM Slots
    WHERE DATEADD(MINUTE,@IntervalMinutes,SlotTime) <= CAST(@Date AS DATETIME) + CAST(@close AS DATETIME)
  )
  SELECT SlotTime
  FROM Slots
  WHERE NOT EXISTS (
    SELECT 1 FROM APPOINTMENT a
    WHERE a.BRANCH_ID = @BranchId
      AND a.SERVICE_ID = @ServiceId
      AND CAST(a.APPOINTMENT_DATE AS DATE) = @Date
      AND CAST(a.APPOINTMENT_DATE AS TIME) = CAST(SlotTime AS TIME)
      AND a.APPOINTMENT_STATUS NOT IN (N'Cancelled')
  )
  OPTION (MAXRECURSION 2000);
END;
GO

-- uspAppointmentStatusUpdate
--   Type: procedure
--   Cập nhật trạng thái cuộc hẹn (pending/confirmed/completed/cancelled/no-show).
CREATE OR ALTER PROCEDURE dbo.uspAppointmentStatusUpdate
  @AppointmentId INT,
  @Status NVARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE APPOINTMENT SET APPOINTMENT_STATUS = @Status WHERE APPOINTMENT_ID = @AppointmentId;
END;
GO

-- uspCheckUpCreate
--   Type: procedure
--   Lập hồ sơ khám bệnh cho thú cưng (triệu chứng, chẩn đoán, hẹn tái khám).
CREATE OR ALTER PROCEDURE dbo.uspCheckUpCreate
  @MedicalServiceId INT,
  @PetId INT,
  @VetId INT,
  @Symptoms NVARCHAR(MAX) = NULL,
  @Diagnosis NVARCHAR(MAX) = NULL,
  @FollowUp DATETIME = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO CHECK_UP (MEDICAL_SERVICE, PET_ID, VET_ID, SYMPTOMS, DIAGNOSIS, FOLLOW_UP_VISIT)
  VALUES (@MedicalServiceId, @PetId, @VetId, @Symptoms, @Diagnosis, @FollowUp);
END;
GO

-- uspCheckUpAssignVet
--   Type: procedure
--   Gán/bổ nhiệm bác sĩ phụ trách cho một lần khám.
CREATE OR ALTER PROCEDURE dbo.uspCheckUpAssignVet
  @CheckUpId INT,
  @VetId INT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE CHECK_UP SET VET_ID = @VetId WHERE CHECK_UP_ID = @CheckUpId;
END;
GO

-- uspCheckUpUpdateStatus
--   Type: procedure
--   Đổi trạng thái phiếu khám và cờ đã có đơn thuốc hay chưa.
CREATE OR ALTER PROCEDURE dbo.uspCheckUpUpdateStatus
  @CheckUpId INT,
  @Status NVARCHAR(10),
  @PrescriptionAvailable BIT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE CHECK_UP
  SET STATUS = @Status,
      PRESCRIPTION_AVAILABLE = ISNULL(@PrescriptionAvailable, PRESCRIPTION_AVAILABLE)
  WHERE CHECK_UP_ID = @CheckUpId;
END;
GO

-- uspCheckUpScheduleFollowUp
--   Type: procedure
--   Đặt hoặc cập nhật lịch tái khám cho thú cưng.
CREATE OR ALTER PROCEDURE dbo.uspCheckUpScheduleFollowUp
  @CheckUpId INT,
  @FollowUp DATETIME
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE CHECK_UP SET FOLLOW_UP_VISIT = @FollowUp WHERE CHECK_UP_ID = @CheckUpId;
END;
GO

-- uspPetMedicalHistory
--   Type: procedure
--   Trả lịch sử y tế tổng hợp của thú cưng (khám, tiêm, đơn thuốc).
CREATE OR ALTER PROCEDURE dbo.uspPetMedicalHistory
  @PetId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM CHECK_UP WHERE PET_ID = @PetId;
  SELECT v.*, vac.VACCINE_NAME FROM VACCINATION v JOIN BRANCH_VACCINE_BATCH bvb ON v.VACCINE_BATCH_ID = bvb.VACCINE_BATCH_ID JOIN VACCINE vac ON bvb.VACCINE_ID = vac.VACCINE_ID WHERE v.PET_ID = @PetId;
  SELECT pd.*, pr.PRODUCT_NAME FROM PRESCRIPTION_DETAIL pd JOIN PRODUCT pr ON pd.PRODUCT_ID = pr.PRODUCT_ID JOIN CHECK_UP cu ON cu.CHECK_UP_ID = pd.CHECK_UP_ID WHERE cu.PET_ID = @PetId;
END;
GO

-- 2.3. Prescription
-- uspPrescriptionAddItem
--   Type: procedure
--   Thêm nhiều dòng thuốc vào đơn, dùng transaction để đảm bảo đồng bộ.
CREATE OR ALTER PROCEDURE dbo.uspPrescriptionAddItem
  @CheckUpId INT,
  @Items dbo.PrescriptionItemType READONLY
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN; -- gi? insert nhi?u d�ng nh?t qu�n
    INSERT INTO PRESCRIPTION_DETAIL (CHECK_UP_ID, PRESCRIPTION_NUMBER, PRODUCT_ID, QUANTITY)
    SELECT @CheckUpId, ROW_NUMBER() OVER (ORDER BY (SELECT 1)), ProductId, Quantity
    FROM @Items;
    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- uspPrescriptionRemoveItem
--   Type: procedure
--   Xóa một dòng thuốc khỏi đơn theo số thứ tự.
CREATE OR ALTER PROCEDURE dbo.uspPrescriptionRemoveItem
  @CheckUpId INT,
  @PrescriptionNumber INT
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM PRESCRIPTION_DETAIL WHERE CHECK_UP_ID = @CheckUpId AND PRESCRIPTION_NUMBER = @PrescriptionNumber;
END;
GO

-- uspPrescriptionListByCheckUp
--   Type: procedure
--   Liệt kê chi tiết đơn thuốc theo một lần khám.
CREATE OR ALTER PROCEDURE dbo.uspPrescriptionListByCheckUp
  @CheckUpId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT pd.*, pr.PRODUCT_NAME
  FROM PRESCRIPTION_DETAIL pd
  JOIN PRODUCT pr ON pd.PRODUCT_ID = pr.PRODUCT_ID
  WHERE pd.CHECK_UP_ID = @CheckUpId;
END;
GO

-- 2.4. Vaccination & Vaccination Plan
-- uspVaccinationRecordCreate
--   Type: procedure
--   Ghi nhận một lần tiêm và trừ số lượng vaccine trong lô của chi nhánh.
CREATE OR ALTER PROCEDURE dbo.uspVaccinationRecordCreate
  @MedicalServiceId INT,
  @PetId INT,
  @VetId INT,
  @VaccineBatchId INT,
  @PetVaccinationPlanId INT = NULL,
  @Dosage NVARCHAR(50) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    BEGIN TRAN; -- ti�m + tr? t?n batch c�ng l�c
    INSERT INTO VACCINATION (MEDICAL_SERVICE, PET_ID, VET_ID, VACCINE_BATCH_ID, PET_VACCINATION_PLAN_ID, VACCINATION_DOSAGE)
    VALUES (@MedicalServiceId, @PetId, @VetId, @VaccineBatchId, @PetVaccinationPlanId, @Dosage);
    UPDATE BRANCH_VACCINE_BATCH
    SET VACCINE_BATCH_QUANTITY = VACCINE_BATCH_QUANTITY - 1
    WHERE VACCINE_BATCH_ID = @VaccineBatchId;
    COMMIT;
  END TRY
  BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- uspVaccinationPlanEnroll
--   Type: procedure
--   Đăng ký thú cưng vào gói tiêm, tính ngày kết thúc theo thời lượng gói.
CREATE OR ALTER PROCEDURE dbo.uspVaccinationPlanEnroll
  @PetId INT,
  @VaccinationPlanId INT,
  @StartDate DATE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @duration INT;
  SELECT @duration = VACCINATION_PLAN_DURATION FROM VACCINATION_PLAN WHERE VACCINATION_PLAN_ID = @VaccinationPlanId;
  INSERT INTO PET_VACCINATION_PLAN (PET_ID, VACCINATION_PLAN_ID, PLAN_START_DATE, PLAN_END_DATE)
  VALUES (@PetId, @VaccinationPlanId, @StartDate, DATEADD(DAY,@duration,@StartDate));
END;
GO

-- uspVaccinationPlanProgress
--   Type: procedure
--   Xem tiến độ gói tiêm của thú cưng (lịch cần tiêm và mũi đã tiêm).
CREATE OR ALTER PROCEDURE dbo.uspVaccinationPlanProgress
  @PetVaccinationPlanId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT vpd.*, vac.VACCINE_NAME
  FROM PET_VACCINATION_PLAN pvp
  JOIN VACCINATION_PLAN_DETAIL vpd ON pvp.VACCINATION_PLAN_ID = vpd.VACCINATION_PLAN_ID
  JOIN VACCINE vac ON vpd.VACCINE_ID = vac.VACCINE_ID
  WHERE pvp.PET_VACCINATION_PLAN_ID = @PetVaccinationPlanId;
  SELECT v.* FROM VACCINATION v WHERE v.PET_VACCINATION_PLAN_ID = @PetVaccinationPlanId;
END;
GO

-- uspVaccineList
--   Type: procedure
--   Danh sách vaccine phục vụ chọn khi tạo lô/ghi tiêm.
CREATE OR ALTER PROCEDURE dbo.uspVaccineList
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM VACCINE;
END;
GO

-- uspVaccinationPlanList
--   Type: procedure
--   Danh sách gói tiêm (giá và thời lượng).
CREATE OR ALTER PROCEDURE dbo.uspVaccinationPlanList
AS
BEGIN
  SET NOCOUNT ON;
  SELECT * FROM VACCINATION_PLAN;
END;
GO

-- uspVaccinationPlanDetailGet
--   Type: procedure
--   Chi tiết một gói tiêm (các mũi và vaccine kèm liều).
CREATE OR ALTER PROCEDURE dbo.uspVaccinationPlanDetailGet
  @VaccinationPlanId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT vpd.*, vac.VACCINE_NAME
  FROM VACCINATION_PLAN_DETAIL vpd
  JOIN VACCINE vac ON vpd.VACCINE_ID = vac.VACCINE_ID
  WHERE vpd.VACCINATION_PLAN_ID = @VaccinationPlanId;
END;
GO
