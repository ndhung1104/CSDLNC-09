import db from '../utils/db.js';

// Get all receipts
export async function getAll({ branchId = null, status = null, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    let query = db('RECEIPT')
        .leftJoin('CUSTOMER', 'RECEIPT.CUSTOMER_ID', 'CUSTOMER.CUSTOMER_ID')
        .join('BRANCH', 'RECEIPT.BRANCH_ID', 'BRANCH.BRANCH_ID')
        .leftJoin('EMPLOYEE', 'RECEIPT.RECEPTIONIST_ID', 'EMPLOYEE.EMPLOYEE_ID')
        .select(
            'RECEIPT.RECEIPT_ID as id',
            'RECEIPT.RECEIPT_STATUS as status',
            'RECEIPT.RECEIPT_TOTAL_PRICE as total',
            'RECEIPT.RECEIPT_CREATED_DATE as date',
            'CUSTOMER.CUSTOMER_NAME as customerName',
            'CUSTOMER.CUSTOMER_ID as customerId',
            'BRANCH.BRANCH_NAME as branchName',
            'EMPLOYEE.EMPLOYEE_NAME as employeeName'
        )
        .orderBy('RECEIPT.RECEIPT_CREATED_DATE', 'desc');

    if (branchId) query = query.where('RECEIPT.BRANCH_ID', branchId);
    if (status) query = query.where('RECEIPT.RECEIPT_STATUS', status);

    const total = (await query.clone().clearSelect().clearOrder().count('* as count').first())?.count || 0;
    const receipts = await query.offset(offset).limit(limit);
    return { receipts, total, page, limit };
}

// Get receipt by ID with details
export async function getById(id) {
    const receipt = await db('RECEIPT')
        .leftJoin('CUSTOMER', 'RECEIPT.CUSTOMER_ID', 'CUSTOMER.CUSTOMER_ID')
        .join('BRANCH', 'RECEIPT.BRANCH_ID', 'BRANCH.BRANCH_ID')
        .leftJoin('EMPLOYEE', 'RECEIPT.RECEPTIONIST_ID', 'EMPLOYEE.EMPLOYEE_ID')
        .select('RECEIPT.*', 'CUSTOMER.CUSTOMER_NAME as customerName',
            'BRANCH.BRANCH_NAME as branchName', 'EMPLOYEE.EMPLOYEE_NAME as employeeName')
        .where('RECEIPT.RECEIPT_ID', id)
        .first();

    if (!receipt) return null;

    const details = await db('RECEIPT_DETAIL')
        .join('PRODUCT', 'RECEIPT_DETAIL.PRODUCT_ID', 'PRODUCT.PRODUCT_ID')
        .select('RECEIPT_DETAIL.*', 'PRODUCT.PRODUCT_NAME as productName')
        .where('RECEIPT_DETAIL.RECEIPT_ID', id);

    return { ...receipt, details };
}

// Create draft receipt using stored procedure
// SP: uspReceiptCreateDraft(@BranchId, @CustomerId, @ReceptionistId, @PaymentMethod, @ReceiptId OUTPUT)
export async function createDraft({ customerId, branchId, employeeId, paymentMethod = 'Cash' }) {
    const result = await db.raw(`
    DECLARE @NewId INT;
    EXEC dbo.uspReceiptCreateDraft
      @BranchId = ?,
      @CustomerId = ?,
      @ReceptionistId = ?,
      @PaymentMethod = ?,
      @ReceiptId = @NewId OUTPUT;
    SELECT @NewId AS id;
  `, [branchId, customerId, employeeId, paymentMethod]);
    return result[0]?.id || null;
}

// Complete receipt and accumulate points using stored procedure
export async function complete(receiptId) {
    await db.raw(`EXEC dbo.uspReceiptMarkCompletedAndAccumulate @ReceiptId = ?`, [receiptId]);
}

// Get branches for dropdown
export async function getBranches() {
    return db('BRANCH').select('BRANCH_ID as id', 'BRANCH_NAME as name');
}
