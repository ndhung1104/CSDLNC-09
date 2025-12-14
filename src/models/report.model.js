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
