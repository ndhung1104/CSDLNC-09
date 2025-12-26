import { Router } from 'express';
import { requireRole, requireAnyEmployee } from '../middleware/auth.middleware.js';
import * as receiptModel from '../models/receipt.model.js';
import * as customerModel from '../models/customer.model.js';
import * as petModel from '../models/pet.model.js';
import * as checkupModel from '../models/checkup.model.js';

const router = Router();

// List receipts with sorting (drafts first by default)
router.get('/', requireAnyEmployee(), async (req, res) => {
    const emp = req.session.employee;
    const { status = '', page = 1, sort = 'status', fromDate = '', toDate = '', q = '' } = req.query;
    try {
        const { receipts, total, limit } = await receiptModel.getAll({ status, fromDate: fromDate || null, toDate: toDate || null, q: q || '', page: parseInt(page), sort });
        const totalPages = Math.ceil(total / limit);
        res.render('receipts/list', {
            title: 'Hóa đơn',
            receipts,
            status,
            fromDate,
            toDate,
            q,
            sort,
            page: parseInt(page),
            totalPages,
            error: null,
            employee: emp
        });
    } catch (err) {
        console.error(err);
        res.render('receipts/list', {
            title: 'Hóa đơn',
            receipts: [],
            status: status || '',
            fromDate,
            toDate,
            q,
            sort: 'status',
            page: 1,
            totalPages: 0,
            error: err.message,
            employee: emp
        });
    }
});

// Create receipt form - with customer dropdown
router.get('/create', requireAnyEmployee(), async (req, res) => {
    res.render('receipts/create', {
        title: 'Tạo hóa đơn',
        customerId: req.query.customerId || '',
        employee: req.session.employee, error: null
    });
});

// Create draft receipt
router.post('/create', requireAnyEmployee(), async (req, res) => {
    const { customerId } = req.body;
    const emp = req.session.employee;
    try {
        const id = await receiptModel.createDraft({ customerId, branchId: emp.branchId, employeeId: emp.id });
        res.redirect(`/receipts/${id}`);
    } catch (err) {
        console.error(err);
        res.render('receipts/create', { title: 'Tạo hóa đơn', customerId, error: err.message, employee: emp });
    }
});

// View receipt detail with products/services for add modal
router.get('/:id', requireAnyEmployee(), async (req, res) => {
    try {
        const receipt = await receiptModel.getById(req.params.id);
        if (!receipt) return res.redirect('/receipts');

        // Get available items for the add modal
        const products = await receiptModel.getProducts();
        const services = await receiptModel.getServices();
        const plans = await receiptModel.getVaccinationPlans();
        const pets = receipt.CUSTOMER_ID ? await petModel.getByCustomerId(receipt.CUSTOMER_ID) : [];

        res.render('receipts/detail', {
            title: `Hóa đơn #${receipt.RECEIPT_ID}`,
            receipt,
            products,
            services,
            plans,
            pets,
            error: req.query.error || null,
            success: req.query.success || null,
            employee: req.session.employee
        });
    } catch (err) {
        console.error(err);
        res.redirect('/receipts');
    }
});

// Add item to receipt
router.post('/:id/items', requireAnyEmployee(), async (req, res) => {
    const { productId, quantity, petId, vaccinationId } = req.body;
    try {
        const receiptId = parseInt(req.params.id);
        const vaccinationIdValue = parseInt(vaccinationId);

        if (vaccinationIdValue) {
            const vaccination = await receiptModel.getVaccinationById(vaccinationIdValue);
            if (!vaccination) {
                throw new Error('Vaccination not found.');
            }

            const receiptInfo = await receiptModel.getReceiptInfo(receiptId);
            if (!receiptInfo?.customerId) {
                throw new Error('Receipt customer is required for vaccination.');
            }
            if (vaccination.customerId !== receiptInfo.customerId) {
                throw new Error('Vaccination does not belong to this customer.');
            }
            if (vaccination.petVaccinationPlanId) {
                throw new Error('Vaccination belongs to a plan. Add the plan item instead.');
            }
            if (receiptInfo.branchId && vaccination.branchId && receiptInfo.branchId !== vaccination.branchId) {
                throw new Error('Vaccination branch does not match receipt branch.');
            }

            const unitPrice = (vaccination.vaccinePrice || 0) + (vaccination.medicalServiceFee || 0);
            await receiptModel.addItem({
                receiptId,
                productId: vaccination.vaccineId,
                quantity: 1,
                petId: vaccination.petId,
                price: unitPrice
            });
            res.redirect(`/receipts/${req.params.id}?success=Da+them+mui+tiem`);
            return;
        }

        const itemId = parseInt(productId);
        if (Number.isNaN(itemId)) {
            throw new Error('Invalid product.');
        }
        if (await receiptModel.isVaccineProduct(itemId)) {
            throw new Error('Vaccines must be added via lookup.');
        }
        const plan = await receiptModel.getVaccinationPlanById(itemId);

        if (plan) {
            const receiptInfo = await receiptModel.getReceiptInfo(receiptId);
            if (!receiptInfo?.customerId) {
                throw new Error('Receipt customer is required for vaccination plans.');
            }
            if (!petId) {
                throw new Error('Please select a pet for the vaccination plan.');
            }
            await receiptModel.addVaccinationPlanItem({
                receiptId,
                planId: itemId,
                petId: parseInt(petId),
                customerId: receiptInfo.customerId
            });
            res.redirect(`/receipts/${req.params.id}?success=Da+th?m+goi+ti?m`);
            return;
        }

        await receiptModel.addItem({
            receiptId,
            productId: itemId,
            quantity: parseInt(quantity) || 1,
            petId: petId ? parseInt(petId) : null
        });
        res.redirect(`/receipts/${req.params.id}?success=Da+th?m+s?n+ph?m`);
    } catch (err) {
        console.error(err);
        res.redirect(`/receipts/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
});

// Remove item from receipt
router.post('/:id/items/:itemId/delete', requireAnyEmployee(), async (req, res) => {
    try {
        await receiptModel.removeItem({
            receiptId: parseInt(req.params.id),
            itemId: parseInt(req.params.itemId)
        });
        res.redirect(`/receipts/${req.params.id}?success=Đã+xóa+sản+phẩm`);
    } catch (err) {
        console.error(err);
        res.redirect(`/receipts/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
});

// Add all items from a checkup to a receipt
router.post('/:id/items/from-checkup', requireAnyEmployee(), async (req, res) => {
    try {
        const receiptId = parseInt(req.params.id);
        const checkupId = parseInt(req.body.checkupId);
        if (!Number.isFinite(receiptId) || !Number.isFinite(checkupId)) {
            throw new Error('Invalid checkup ID.');
        }

        const receiptInfo = await receiptModel.getReceiptInfo(receiptId);
        if (!receiptInfo) {
            throw new Error('Receipt not found.');
        }
        const normalizedStatus = String(receiptInfo.status || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const isUnpaid = normalizedStatus.includes('chua') || normalizedStatus.includes('cho') || normalizedStatus.includes('pending');
        if (!isUnpaid) {
            throw new Error('Receipt is already paid.');
        }

        const checkup = await checkupModel.getById(checkupId);
        if (!checkup) {
            throw new Error('Checkup not found.');
        }

        const checkupCustomerId = checkup.CUSTOMER_ID || checkup.customerId;
        if (receiptInfo.customerId && checkupCustomerId && receiptInfo.customerId !== checkupCustomerId) {
            throw new Error('Checkup customer does not match receipt.');
        }

        const items = await checkupModel.getPrescriptionItems(checkupId);
        const petId = checkup.PET_ID || checkup.petId || null;

        const medicalServiceId = checkup.MEDICAL_SERVICE || checkup.medicalServiceId;
        if (medicalServiceId) {
            await receiptModel.addItem({
                receiptId,
                productId: medicalServiceId,
                quantity: 1,
                petId
            });
        }

        for (const item of items) {
            const plan = await receiptModel.getVaccinationPlanById(item.productId);
            if (plan) {
                if (!petId) {
                    throw new Error('Pet is required for vaccination plans.');
                }
                if (!receiptInfo.customerId) {
                    throw new Error('Receipt customer is required for vaccination plans.');
                }
                await receiptModel.addVaccinationPlanItem({
                    receiptId,
                    planId: item.productId,
                    petId,
                    customerId: receiptInfo.customerId
                });
                continue;
            }

            await receiptModel.addItem({
                receiptId,
                productId: item.productId,
                quantity: item.quantity || 1,
                petId
            });
        }

        res.redirect(`/receipts/${receiptId}?success=Da+them+tat+ca+tu+phieu+kham`);
    } catch (err) {
        console.error(err);
        res.redirect(`/receipts/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
});

// Complete receipt - payment and loyalty points
router.post('/:id/complete', requireAnyEmployee(), async (req, res) => {
    try {
        await receiptModel.complete(req.params.id);
        res.redirect(`/receipts/${req.params.id}?success=Thanh+toán+thành+công`);
    } catch (err) {
        res.redirect(`/receipts/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
});

export default router;

