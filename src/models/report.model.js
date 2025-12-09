import db from '../utils/db.js';

// Get branch daily report - Use Case 5
// Returns multiple result sets: revenue, employee performance, customer stats
export async function getBranchDailyReport({ branchId, reportDate }) {
    const result = await db.raw(`
        EXEC dbo.uspGetBranchDailyReport @BranchId = ?, @ReportDate = ?
    `, [branchId, reportDate]);

    // MSSQL returns multiple result sets as array
    const [revenue, employeeStats, customerStats] = result;
    return {
        revenue: revenue?.[0] || { TotalRevenue: 0, ReceiptCount: 0 },
        employeeStats: employeeStats || [],
        customerStats: customerStats?.[0] || { NewCustomers: 0, ReturningCustomers: 0 }
    };
}

// Run yearly membership review - Use Case 6
// Returns customers who upgraded, downgraded, or maintained their rank
export async function runYearlyMembershipReview({ year }) {
    const result = await db.raw(`
        EXEC dbo.uspRunYearlyMembershipReview @Year = ?
    `, [year]);

    // Returns result sets for upgrades, downgrades, maintained
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
}

// Get branches for report selector
export async function getBranches() {
    return db('BRANCH').select('BRANCH_ID as id', 'BRANCH_NAME as name');
}
