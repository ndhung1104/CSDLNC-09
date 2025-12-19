import db from '../utils/db.js';

// Get branch daily report - Use Case 5
// Filter by branch AND date
export async function getBranchDailyReport({ branchId, reportDate }) {
    try {
        const useBranch = branchId != null;
        const receiptDateFilter = 'CONVERT(DATE, r.RECEIPT_CREATED_DATE) = CONVERT(DATE, ?)';
        const receiptBranchFilter = useBranch ? 'AND r.BRANCH_ID = ?' : '';
        const receiptParams = useBranch ? [reportDate, branchId] : [reportDate];

        // 1) Total Revenue for branch on specific date (or all branches)
        const revenueResult = await db.raw(`
            SELECT 
                ISNULL(SUM(r.RECEIPT_TOTAL_PRICE), 0) as TotalRevenue,
                COUNT(*) as ReceiptCount
            FROM RECEIPT r
            WHERE ${receiptDateFilter}
            ${receiptBranchFilter}
        `, receiptParams);

        // 2) Employee performance for that date (receptionist receipts)
        const employeeParams = useBranch ? [reportDate, branchId, branchId] : [reportDate];
        const employeeResult = await db.raw(`
            SELECT
                e.EMPLOYEE_ID,
                e.EMPLOYEE_NAME,
                COUNT(r.RECEIPT_ID) as ReceiptCount
            FROM EMPLOYEE e
            LEFT JOIN RECEIPT r 
                ON r.RECEPTIONIST_ID = e.EMPLOYEE_ID
                AND CONVERT(DATE, r.RECEIPT_CREATED_DATE) = CONVERT(DATE, ?)
                ${useBranch ? 'AND r.BRANCH_ID = ?' : ''}
            WHERE 1 = 1
                ${useBranch ? 'AND e.BRANCH_ID = ?' : ''}
            GROUP BY e.EMPLOYEE_ID, e.EMPLOYEE_NAME
            ORDER BY ReceiptCount DESC
        `, employeeParams);

        // 3) Customer count for that date
        const customerResult = await db.raw(`
            SELECT 
                COUNT(DISTINCT r.CUSTOMER_ID) as TotalCustomers
            FROM RECEIPT r
            WHERE ${receiptDateFilter}
            ${receiptBranchFilter}
        `, receiptParams);

        // 4) Visits count from appointments
        const appointmentParams = useBranch ? [reportDate, branchId] : [reportDate];
        const visitResult = await db.raw(`
            SELECT COUNT(*) as TotalVisits
            FROM APPOINTMENT a
            WHERE CONVERT(DATE, a.APPOINTMENT_DATE) = CONVERT(DATE, ?)
            ${useBranch ? 'AND a.BRANCH_ID = ?' : ''}
        `, appointmentParams);

        // 5) Product revenue (sales products only)
        const productRevenueResult = await db.raw(`
            SELECT 
                ISNULL(SUM(rd.RECEIPT_ITEM_AMOUNT * rd.RECEIPT_ITEM_PRICE), 0) as TotalProductRevenue
            FROM RECEIPT_DETAIL rd
            JOIN RECEIPT r ON rd.RECEIPT_ID = r.RECEIPT_ID
            JOIN SALES_PRODUCT sp ON rd.PRODUCT_ID = sp.SALES_PRODUCT_ID
            WHERE ${receiptDateFilter}
            ${receiptBranchFilter}
        `, receiptParams);

        const topProducts = await db.raw(`
            SELECT TOP 5
                p.PRODUCT_NAME as ProductName,
                SUM(rd.RECEIPT_ITEM_AMOUNT) as Quantity,
                SUM(rd.RECEIPT_ITEM_AMOUNT * rd.RECEIPT_ITEM_PRICE) as Revenue
            FROM RECEIPT_DETAIL rd
            JOIN RECEIPT r ON rd.RECEIPT_ID = r.RECEIPT_ID
            JOIN SALES_PRODUCT sp ON rd.PRODUCT_ID = sp.SALES_PRODUCT_ID
            JOIN PRODUCT p ON sp.SALES_PRODUCT_ID = p.PRODUCT_ID
            WHERE ${receiptDateFilter}
            ${receiptBranchFilter}
            GROUP BY p.PRODUCT_NAME
            ORDER BY Revenue DESC
        `, receiptParams);

        // 6) Doctor revenue (all-time, based on medical service fees)
        const doctorParams = useBranch ? [branchId] : [];
        const doctorRevenue = await db.raw(`
            SELECT
                e.EMPLOYEE_ID as VetId,
                e.EMPLOYEE_NAME as VetName,
                ISNULL(SUM(ms.MEDICAL_SERVICE_FEE), 0) as TotalRevenue,
                COUNT(c.CHECK_UP_ID) as VisitCount
            FROM EMPLOYEE e
            LEFT JOIN CHECK_UP c ON c.VET_ID = e.EMPLOYEE_ID
            LEFT JOIN MEDICAL_SERVICE ms ON c.MEDICAL_SERVICE = ms.MEDICAL_SERVICE_ID
            WHERE e.EMPLOYEE_POSITION = 'VET'
            ${useBranch ? 'AND e.BRANCH_ID = ?' : ''}
            GROUP BY e.EMPLOYEE_ID, e.EMPLOYEE_NAME
            ORDER BY TotalRevenue DESC
        `, doctorParams);

        // 7) Revenue all branches (only when not filtering by branch)
        let branchRevenue = [];
        if (!useBranch) {
            branchRevenue = await db.raw(`
                SELECT
                    b.BRANCH_ID as BranchId,
                    b.BRANCH_NAME as BranchName,
                    ISNULL(SUM(r.RECEIPT_TOTAL_PRICE), 0) as TotalRevenue,
                    COUNT(r.RECEIPT_ID) as ReceiptCount
                FROM BRANCH b
                LEFT JOIN RECEIPT r
                    ON r.BRANCH_ID = b.BRANCH_ID
                    AND CONVERT(DATE, r.RECEIPT_CREATED_DATE) = CONVERT(DATE, ?)
                GROUP BY b.BRANCH_ID, b.BRANCH_NAME
                ORDER BY b.BRANCH_ID
            `, [reportDate]);
        }

        return {
            revenue: revenueResult[0] || { TotalRevenue: 0, ReceiptCount: 0 },
            employeeStats: employeeResult || [],
            customerStats: {
                NewCustomers: customerResult[0]?.TotalCustomers || 0,
                ReturningCustomers: 0
            },
            visitStats: {
                TotalVisits: visitResult[0]?.TotalVisits || 0
            },
            productRevenue: {
                TotalProductRevenue: productRevenueResult[0]?.TotalProductRevenue || 0,
                TopProducts: topProducts || []
            },
            doctorRevenue: doctorRevenue || [],
            branchRevenue
        };
    } catch (err) {
        console.error('DAILY REPORT ERROR:', err);
        return {
            revenue: { TotalRevenue: 0, ReceiptCount: 0 },
            employeeStats: [],
            customerStats: { NewCustomers: 0, ReturningCustomers: 0 },
            visitStats: { TotalVisits: 0 },
            productRevenue: { TotalProductRevenue: 0, TopProducts: [] },
            doctorRevenue: [],
            branchRevenue: []
        };
    }
}

// Get available dates (simplified)
export async function getAvailableDates({ branchId }) {
    return [];
}

// Run yearly membership review - Use Case 6
export async function runYearlyMembershipReview({ year }) {
    try {
        const result = await db.raw(`
            EXEC dbo.uspRunYearlyMembershipReview @Year = ?
        `, [year]);

        console.log('=== MEMBERSHIP REVIEW DEBUG ===');
        console.log('Result type:', typeof result);
        console.log('Is Array:', Array.isArray(result));
        console.log('Result length:', result?.length);
        console.log('First few items:', JSON.stringify(result?.slice?.(0, 3)));
        console.log('=== END DEBUG ===');

        // The stored procedure returns 2 result sets but mssql driver flattens them
        let summary = { totalUpgrades: 0, totalDowngrades: 0, totalMaintained: 0 };
        let upgrades = [];
        let downgrades = [];
        let maintained = [];

        // Handle as flat array - look for rows with CaseType property (detail rows)
        if (Array.isArray(result)) {
            result.forEach(row => {
                // Summary rows have CaseType and CustomerCount
                if (row && row.CaseType && row.CustomerCount !== undefined) {
                    if (row.CaseType === 'UPGRADE') summary.totalUpgrades = row.CustomerCount;
                    else if (row.CaseType === 'DOWNGRADE') summary.totalDowngrades = row.CustomerCount;
                    else if (row.CaseType === 'KEEP') summary.totalMaintained = row.CustomerCount;
                }
                // Detail rows have CUSTOMER_ID and CaseType but no CustomerCount
                else if (row && row.CUSTOMER_ID && row.CaseType) {
                    const customer = {
                        CUSTOMER_ID: row.CUSTOMER_ID,
                        CUSTOMER_NAME: `Khách hàng #${row.CUSTOMER_ID}`,
                        MEMBERSHIP_RANK_NAME: row.CurrentRankName,
                        NewRank: row.NewRankName,
                        MONEY_SPENT: row.MONEY_SPENT
                    };
                    if (row.CaseType === 'UPGRADE') upgrades.push(customer);
                    else if (row.CaseType === 'DOWNGRADE') downgrades.push(customer);
                    else if (row.CaseType === 'KEEP') maintained.push(customer);
                }
            });
        }

        // If summary wasn't parsed from result, compute from arrays
        if (summary.totalUpgrades === 0 && summary.totalDowngrades === 0 && summary.totalMaintained === 0) {
            summary = {
                totalUpgrades: upgrades.length,
                totalDowngrades: downgrades.length,
                totalMaintained: maintained.length
            };
        }

        console.log('=== PARSED RESULT ===');
        console.log('Upgrades count:', upgrades.length);
        console.log('Downgrades count:', downgrades.length);
        console.log('Maintained count:', maintained.length);
        console.log('Summary:', summary);
        console.log('=== END ===');

        return { upgrades, downgrades, maintained, summary };
    } catch (err) {
        console.error('MEMBERSHIP REVIEW ERROR:', err);
        return {
            upgrades: [],
            downgrades: [],
            maintained: [],
            summary: { totalUpgrades: 0, totalDowngrades: 0, totalMaintained: 0 }
        };
    }
}

// Get branches for report selector
export async function getBranches() {
    const result = await db.raw('SELECT BRANCH_ID as id, BRANCH_NAME as name FROM BRANCH');
    return result;
}
