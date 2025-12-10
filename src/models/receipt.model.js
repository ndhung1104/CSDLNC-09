import db from '../utils/db.js';

// Get all receipts (using raw SQL with TOP for reliability)
export async function getAll({ branchId = null, status = null, page = 1, limit = 20 } = {}) {
    // Count query
    const countResult = await db.raw('SELECT COUNT(*) as count FROM RECEIPT');
    const total = countResult[0]?.count || 0;

    // Data query using raw SQL with TOP
    const receipts = await db.raw(`
        SELECT TOP (${limit})
            r.RECEIPT_ID as id,
            r.RECEIPT_STATUS as status,
            r.RECEIPT_TOTAL_PRICE as total,
            r.RECEIPT_CREATED_DATE as date,
            c.CUSTOMER_NAME as customerName,
            c.CUSTOMER_ID as customerId,
            b.BRANCH_NAME as branchName,
            e.EMPLOYEE_NAME as employeeName
        FROM RECEIPT r
        LEFT JOIN CUSTOMER c ON r.CUSTOMER_ID = c.CUSTOMER_ID
        LEFT JOIN BRANCH b ON r.BRANCH_ID = b.BRANCH_ID
        LEFT JOIN EMPLOYEE e ON r.RECEPTIONIST_ID = e.EMPLOYEE_ID
        ORDER BY r.RECEIPT_CREATED_DATE DESC
    `);

    return { receipts, total, page, limit };
}

// Get receipt by ID with details
export async function getById(id) {
    const result = await db.raw(`
        SELECT 
            r.*,
            c.CUSTOMER_NAME as customerName,
            b.BRANCH_NAME as branchName,
            e.EMPLOYEE_NAME as employeeName
        FROM RECEIPT r
        LEFT JOIN CUSTOMER c ON r.CUSTOMER_ID = c.CUSTOMER_ID
        LEFT JOIN BRANCH b ON r.BRANCH_ID = b.BRANCH_ID
        LEFT JOIN EMPLOYEE e ON r.RECEPTIONIST_ID = e.EMPLOYEE_ID
        WHERE r.RECEIPT_ID = ?
    `, [id]);

    const receipt = result[0];
    if (!receipt) return null;

    const details = await db.raw(`
        SELECT rd.*, p.PRODUCT_NAME as productName
        FROM RECEIPT_DETAIL rd
        JOIN PRODUCT p ON rd.PRODUCT_ID = p.PRODUCT_ID
        WHERE rd.RECEIPT_ID = ?
    `, [id]);

    return { ...receipt, details };
}

// Create draft receipt using stored procedure
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
    return db.raw('SELECT BRANCH_ID as id, BRANCH_NAME as name FROM BRANCH');
}

// Get receipts for a specific customer with details
export async function getByCustomerId(customerId) {
    const receipts = await db('RECEIPT as r')
        .leftJoin('BRANCH as b', 'r.BRANCH_ID', 'b.BRANCH_ID')
        .select(
            'r.RECEIPT_ID as id',
            'r.RECEIPT_STATUS as status',
            'r.RECEIPT_TOTAL_PRICE as total',
            'r.RECEIPT_CREATED_DATE as date',
            'b.BRANCH_NAME as branchName',
            'r.RECEIPT_PAYMENT_METHOD as paymentMethod'
        )
        .where('r.CUSTOMER_ID', customerId)
        .orderBy('r.RECEIPT_CREATED_DATE', 'desc');

    if (receipts.length === 0) return [];

    const receiptIds = receipts.map(r => r.id);
    const details = await db('RECEIPT_DETAIL as rd')
        .join('PRODUCT as p', 'rd.PRODUCT_ID', 'p.PRODUCT_ID')
        .select(
            'rd.RECEIPT_ID as receiptId',
            'p.PRODUCT_NAME as productName',
            'rd.RECEIPT_ITEM_AMOUNT as quantity',
            'rd.RECEIPT_ITEM_PRICE as price'
        )
        .whereIn('rd.RECEIPT_ID', receiptIds);

    const detailMap = {};
    details.forEach(d => {
        if (!detailMap[d.receiptId]) detailMap[d.receiptId] = [];
        detailMap[d.receiptId].push({
            itemName: d.productName,
            quantity: d.quantity,
            totalPrice: d.price * d.quantity
        });
    });

    receipts.forEach(r => {
        r.items = detailMap[r.id] || [];
    });

    return receipts;
}
