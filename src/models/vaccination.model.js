import db from '../utils/db.js';

// Get all vaccination plans - join with PRODUCT for name
export async function getAll({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const countQuery = db('VACCINATION_PLAN').count('* as count').first();
    const dataQuery = db('VACCINATION_PLAN')
        .join('PRODUCT', 'VACCINATION_PLAN.VACCINATION_PLAN_ID', 'PRODUCT.PRODUCT_ID')
        .select(
            'VACCINATION_PLAN.VACCINATION_PLAN_ID as id',
            'PRODUCT.PRODUCT_NAME as name',
            'VACCINATION_PLAN.VACCINATION_PLAN_DURATION as duration',
            'VACCINATION_PLAN.VACCINATION_PLAN_PRICE as price'
        )
        .orderBy('VACCINATION_PLAN.VACCINATION_PLAN_ID', 'asc')
        .offset(offset)
        .limit(limit);

    const [total, plans] = await Promise.all([countQuery, dataQuery]);
    return { plans, total: total?.count || 0, page, limit };
}

// Get vaccination plan by ID with vaccines
export async function getById(id) {
    const plan = await db('VACCINATION_PLAN')
        .join('PRODUCT', 'VACCINATION_PLAN.VACCINATION_PLAN_ID', 'PRODUCT.PRODUCT_ID')
        .select(
            'VACCINATION_PLAN.VACCINATION_PLAN_ID as id',
            'PRODUCT.PRODUCT_NAME as name',
            'VACCINATION_PLAN.VACCINATION_PLAN_DURATION as duration',
            'VACCINATION_PLAN.VACCINATION_PLAN_PRICE as price'
        )
        .where('VACCINATION_PLAN.VACCINATION_PLAN_ID', id)
        .first();

    if (!plan) return null;

    const vaccines = await db('VACCINATION_PLAN_DETAIL')
        .join('VACCINE', 'VACCINATION_PLAN_DETAIL.VACCINE_ID', 'VACCINE.VACCINE_ID')
        .join('PRODUCT', 'VACCINE.VACCINE_ID', 'PRODUCT.PRODUCT_ID')
        .select('VACCINE.VACCINE_ID as id', 'PRODUCT.PRODUCT_NAME as name', 'VACCINATION_PLAN_DETAIL.VACCINE_DOSAGE as dosage')
        .where('VACCINATION_PLAN_DETAIL.VACCINATION_PLAN_ID', id);

    return { ...plan, vaccines };
}

// Purchase vaccination plan using stored procedure - Use Case 3
// SP: uspReceiptCreateForVaccinationPlan(@CustomerId, @BranchId, @ReceptionistId, @PaymentMethod, @VaccinationPlanId, @PetId, @ReceiptId OUTPUT)
export async function purchase({ planId, petId, customerId, branchId, employeeId, paymentMethod = 'Cash' }) {
    const result = await db.raw(`
        DECLARE @NewReceiptId INT;
        EXEC dbo.uspReceiptCreateForVaccinationPlan
            @CustomerId = ?,
            @BranchId = ?,
            @ReceptionistId = ?,
            @PaymentMethod = ?,
            @VaccinationPlanId = ?,
            @PetId = ?,
            @ReceiptId = @NewReceiptId OUTPUT;
        SELECT @NewReceiptId AS id;
    `, [customerId, branchId, employeeId, paymentMethod, planId, petId]);

    return result[0]?.id || null;
}
