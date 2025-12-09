import db from '../utils/db.js';

// Get branch daily report - Use Case 5
// Filter by branch AND date
export async function getBranchDailyReport({ branchId, reportDate }) {
    try {
        // 1) Total Revenue for branch on specific date
        const revenueResult = await db.raw(`
            SELECT 
                ISNULL(SUM(RECEIPT_TOTAL_PRICE), 0) as TotalRevenue,
                COUNT(*) as ReceiptCount
            FROM RECEIPT
            WHERE BRANCH_ID = ?
              AND CONVERT(DATE, RECEIPT_CREATED_DATE) = CONVERT(DATE, ?)
        `, [branchId, reportDate]);

        // 2) Employee performance for that date
        const employeeResult = await db.raw(`
            SELECT TOP 10
                e.EMPLOYEE_ID,
                e.EMPLOYEE_NAME,
                (SELECT COUNT(*) FROM RECEIPT r 
                 WHERE r.RECEPTIONIST_ID = e.EMPLOYEE_ID 
                   AND CONVERT(DATE, r.RECEIPT_CREATED_DATE) = CONVERT(DATE, ?)) as ReceiptCount
            FROM EMPLOYEE e
            WHERE e.BRANCH_ID = ?
        `, [reportDate, branchId]);

        // 3) Customer count for that date
        const customerResult = await db.raw(`
            SELECT 
                COUNT(DISTINCT CUSTOMER_ID) as TotalCustomers
            FROM RECEIPT
            WHERE BRANCH_ID = ?
              AND CONVERT(DATE, RECEIPT_CREATED_DATE) = CONVERT(DATE, ?)
        `, [branchId, reportDate]);

        return {
            revenue: revenueResult[0] || { TotalRevenue: 0, ReceiptCount: 0 },
            employeeStats: employeeResult || [],
            customerStats: {
                NewCustomers: customerResult[0]?.TotalCustomers || 0,
                ReturningCustomers: 0
            }
        };
    } catch (err) {
        console.error('DAILY REPORT ERROR:', err);
        return {
            revenue: { TotalRevenue: 0, ReceiptCount: 0 },
            employeeStats: [],
            customerStats: { NewCustomers: 0, ReturningCustomers: 0 }
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

        const [upgrades, downgrades, maintained] = result;
        return {
            upgrades: upgrades || [],
            downgrades: downgrades || [],
            maintained: maintained || [],
            summary: {
                totalUpgrades: upgrades?.length || 0,
                totalDowngrades: downgrades?.length || 0,
                totalMaintained: maintained?.length || 0
            }
        };
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
