import pyodbc
from faker import Faker
import random
from datetime import datetime, timedelta
from collections import defaultdict

# pip install faker pyodbc

# ==============================
# CẤU HÌNH
# ==============================
N_CUSTOMERS = 70000
MAX_PETS_PER_CUSTOMER = 2
N_CHECKUPS = 70000
N_RECEIPTS = 70000
MAX_ITEMS_PER_RECEIPT = 5
REVIEW_RATIO = 0.35  # 35% hoá đơn có review

# ==============================
# KẾT NỐI SQL SERVER
# ==============================
conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=LAPTOP-1OTLC941\SQLEXPRESS;"
    "DATABASE=PETCAREX;"
    "Trusted_Connection=yes;"
)

conn = pyodbc.connect(conn_str)
cursor = conn.cursor()
fake = Faker("vi_VN")

# ==============================
# HÀM HỖ TRỢ
# ==============================
def fetch_ids(query):
    cursor.execute(query)
    return [row[0] for row in cursor.fetchall()]

def random_date_between(start_date, end_date):
    """
    Random datetime giữa start_date và end_date (datetime hoặc date).
    """
    if isinstance(start_date, datetime):
        start = start_date
    else:
        start = datetime.combine(start_date, datetime.min.time())
    if isinstance(end_date, datetime):
        end = end_date
    else:
        end = datetime.combine(end_date, datetime.min.time())

    delta = end - start
    if delta.days <= 0:
        return start
    rand_days = random.randint(0, delta.days)
    rand_seconds = random.randint(0, 86400 - 1)
    return start + timedelta(days=rand_days, seconds=rand_seconds)


# ==============================
# LẤY MASTER ID
# ==============================
print("Đang load master IDs...")

membership_ids = fetch_ids("SELECT MEMBERSHIP_RANK_ID FROM MEMBERSHIP_RANK")
breed_ids = fetch_ids("SELECT BREED_ID FROM PET_BREED")
branch_ids = fetch_ids("SELECT BRANCH_ID FROM BRANCH")
sales_product_ids = fetch_ids("SELECT SALES_PRODUCT_ID FROM SALES_PRODUCT")
medical_service_ids = fetch_ids("SELECT MEDICAL_SERVICE_ID FROM MEDICAL_SERVICE")

# Lấy employee theo vai trò
cursor.execute("SELECT EMPLOYEE_ID, EMPLOYEE_POSITION FROM EMPLOYEE")
rows = cursor.fetchall()
receptionist_ids = [r[0] for r in rows if r[1].strip() in ("RECEP", "SALES")]
vet_ids = [r[0] for r in rows if r[1].strip() == "VET"]

if not membership_ids or not breed_ids or not branch_ids or not sales_product_ids or not medical_service_ids:
    raise RuntimeError("Thiếu dữ liệu master. Hãy chạy seed_master.sql trước.")

print("Master IDs loaded.")
print(f"- MEMBERSHIP_RANK: {len(membership_ids)}")
print(f"- PET_BREED: {len(breed_ids)}")
print(f"- BRANCH: {len(branch_ids)}")
print(f"- SALES_PRODUCT: {len(sales_product_ids)}")
print(f"- MEDICAL_SERVICE: {len(medical_service_ids)}")
print(f"- RECEPTIONIST/SALES: {len(receptionist_ids)}")
print(f"- VET: {len(vet_ids)}")

# ==============================
# 1. INSERT CUSTOMER
# ==============================
def insert_customers(n=N_CUSTOMERS):
    print(f"Đang sinh {n} khách hàng...")
    batch_size = 1000
    for i in range(1, n + 1):
        name = fake.name()
        phone = "0" + str(random.randint(100000000, 999999999))  # 10 số
        email = f"user{i}@example.com"
        gender = random.choice(["Nam", "Nữ"])
        birthdate = fake.date_between(start_date="-50y", end_date="-18y")
        rank_id = random.choice(membership_ids)

        cursor.execute(
            """
            INSERT INTO CUSTOMER (
                MEMBERSHIP_RANK_ID,
                CUSTOMER_NAME,
                CUSTOMER_PHONE,
                CUSTOMER_EMAIL,
                CUSTOMER_GENDER,
                CUSTOMER_BIRTHDATE,
                CUSTOMER_LOYALTY
            ) VALUES (?, ?, ?, ?, ?, ?, 0)
            """,
            (rank_id, name, phone, email, gender, birthdate),
        )

        if i % batch_size == 0:
            conn.commit()
            print(f"  > Đã insert {i} khách hàng...")

    conn.commit()
    print("Hoàn thành sinh CUSTOMER.")


# ==============================
# 2. INSERT PET
# ==============================
def insert_pets():
    print("Đang lấy CUSTOMER_ID để sinh PET...")
    customer_ids = fetch_ids("SELECT CUSTOMER_ID FROM CUSTOMER")
    print(f"Tổng khách hàng: {len(customer_ids)}")

    pet_names = ["Bông", "Đốm", "Miu", "Cún", "Na", "Xoài", "Lu", "Mực", "Bé", "Bon", "Susu"]

    batch_size = 1000
    count = 0

    print("Đang sinh thú cưng cho khách hàng...")
    for customer_id in customer_ids:
        num_pets = random.randint(1, MAX_PETS_PER_CUSTOMER)
        for _ in range(num_pets):
            pet_name = random.choice(pet_names) + " " + str(random.randint(1, 99))
            breed_id = random.choice(breed_ids)
            gender = random.choice(["Nam", "Nữ"])
            birthdate = fake.date_between(start_date="-15y", end_date="today")
            health_status = random.choice(
                ["Khỏe", "Béo phì nhẹ", "Viêm da nhẹ", "Dị ứng nhẹ", "Viêm tai nhẹ"]
            )

            cursor.execute(
                """
                INSERT INTO PET (
                    CUSTOMER_ID,
                    PET_NAME,
                    PET_BREED_ID,
                    PET_GENDER,
                    PET_BIRTHDATE,
                    PET_HEALTH_STATUS
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (customer_id, pet_name, breed_id, gender, birthdate, health_status),
            )
            count += 1

            if count % batch_size == 0:
                conn.commit()
                print(f"  > Đã insert {count} PET...")

    conn.commit()
    print(f"Hoàn thành sinh PET. Tổng PET: ~{count}")


# ==============================
# 3. INSERT CHECK_UP
# ==============================
def insert_checkups(n=N_CHECKUPS):
    print(f"Đang lấy PET_ID để sinh {n} CHECK_UP...")
    pet_ids = fetch_ids("SELECT PET_ID FROM PET")
    if not pet_ids:
        raise RuntimeError("Không có PET nào để tạo CHECK_UP.")

    if not vet_ids:
        raise RuntimeError("Không có VET nào trong EMPLOYEE để gán vào CHECK_UP.")

    batch_size = 1000
    start_date = datetime.now() - timedelta(days=365 * 3)
    end_date = datetime.now()

    symptoms_list = [
        "Bỏ ăn, nôn nhẹ",
        "Tiêu chảy 2 ngày",
        "Ngứa nhiều, gãi liên tục",
        "Ho khan, sổ mũi",
        "Mắt đỏ, chảy ghèn",
        "Lười vận động, mệt mỏi",
    ]
    diagnosis_list = [
        "Viêm da dị ứng nhẹ",
        "Rối loạn tiêu hóa",
        "Nhiễm khuẩn đường hô hấp trên",
        "Viêm tai ngoài",
        "Viêm kết mạc",
        "Thừa cân, cần giảm khẩu phần",
    ]

    print("Đang sinh CHECK_UP...")
    for i in range(1, n + 1):
        pet_id = random.choice(pet_ids)
        med_service_id = random.choice(medical_service_ids)
        vet_id = random.choice(vet_ids)
        symptoms = random.choice(symptoms_list)
        diagnosis = random.choice(diagnosis_list)
        status = random.choice(["Chờ", "Hoàn tất"])

        visit_date = random_date_between(start_date, end_date)
        follow_up = None
        if random.random() < 0.3:
            follow_up = visit_date + timedelta(days=random.randint(7, 30))

        cursor.execute(
            """
            INSERT INTO CHECK_UP (
                MEDICAL_SERVICE,
                PET_ID,
                VET_ID,
                SYMPTOMS,
                DIAGNOSIS,
                PRESCRIPTION_AVAILABLE,
                FOLLOW_UP_VISIT,
                STATUS
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                med_service_id,
                pet_id,
                vet_id,
                symptoms,
                diagnosis,
                1 if random.random() < 0.7 else 0,
                follow_up,
                status,
            ),
        )

        if i % batch_size == 0:
            conn.commit()
            print(f"  > Đã insert {i} CHECK_UP...")

    conn.commit()
    print("Hoàn thành sinh CHECK_UP.")


# ==============================
# 4. INSERT RECEIPT
# ==============================
def insert_receipts(n=N_RECEIPTS):
    print("Đang lấy CUSTOMER_ID và BRANCH_ID để sinh RECEIPT...")
    customer_ids = fetch_ids("SELECT CUSTOMER_ID FROM CUSTOMER")
    if not receptionist_ids:
        raise RuntimeError("Không có RECEPTIONIST/SALES trong EMPLOYEE để gán vào RECEIPT.")

    batch_size = 1000
    start_date = datetime.now() - timedelta(days=365 * 3)
    end_date = datetime.now()

    payment_methods = ["Tiền mặt", "Thẻ", "Chuyển khoản"]
    statuses = ["Đã hoàn thành", "Chờ thanh toán", "Hủy"]

    print(f"Đang sinh {n} RECEIPT...")
    for i in range(1, n + 1):
        branch_id = random.choice(branch_ids)
        customer_id = random.choice(customer_ids)
        receptionist_id = random.choice(receptionist_ids)
        created_at = random_date_between(start_date, end_date)

        # Tổng tiền random, có thể không khớp 100% detail nhưng đủ realistic
        total_price = random.randint(50000, 5000000)
        payment_method = random.choice(payment_methods)
        status_prob = random.random()
        if status_prob < 0.8:
            status = "Đã hoàn thành"
        elif status_prob < 0.95:
            status = "Chờ thanh toán"
        else:
            status = "Hủy"

        cursor.execute(
            """
            INSERT INTO RECEIPT (
                BRANCH_ID,
                CUSTOMER_ID,
                RECEPTIONIST_ID,
                RECEIPT_CREATED_DATE,
                RECEIPT_TOTAL_PRICE,
                RECEIPT_PAYMENT_METHOD,
                RECEIPT_STATUS
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                branch_id,
                customer_id,
                receptionist_id,
                created_at,
                total_price,
                payment_method,
                status,
            ),
        )

        if i % batch_size == 0:
            conn.commit()
            print(f"  > Đã insert {i} RECEIPT...")

    conn.commit()
    print("Hoàn thành sinh RECEIPT.")


# ==============================
# 5. INSERT RECEIPT_DETAIL
# ==============================
def insert_receipt_details():
    print("Đang lấy RECEIPT_ID để sinh RECEIPT_DETAIL...")
    cursor.execute("SELECT RECEIPT_ID FROM RECEIPT")
    receipt_ids = [row[0] for row in cursor.fetchall()]

    if not receipt_ids:
        raise RuntimeError("Không có RECEIPT nào để tạo RECEIPT_DETAIL.")

    # Map SALES_PRODUCT -> PRODUCT_ID cho tiện chọn
    cursor.execute(
        """
        SELECT S.SALES_PRODUCT_ID, P.PRODUCT_ID, S.SALES_PRODUCT_PRICE
        FROM SALES_PRODUCT S
        JOIN PRODUCT P ON P.PRODUCT_ID = S.SALES_PRODUCT_ID
        """
    )
    sales_rows = cursor.fetchall()
    if not sales_rows:
        raise RuntimeError("Không có SALES_PRODUCT/PRODUCT để tạo RECEIPT_DETAIL.")

    sale_items = [
        (row[0], row[1], row[2])  # (SALES_PRODUCT_ID, PRODUCT_ID, PRICE)
        for row in sales_rows
    ]

    cursor.execute("SELECT PET_ID FROM PET")
    pet_ids = [row[0] for row in cursor.fetchall()]
    pet_ids_or_null = pet_ids + [None] * 5  # tăng tỷ lệ NULL

    batch_size = 2000
    count = 0

    print("Đang sinh RECEIPT_DETAIL...")
    for receipt_id in receipt_ids:
        num_items = random.randint(1, MAX_ITEMS_PER_RECEIPT)
        for item_index in range(1, num_items + 1):
            sale_product_id, product_id, price = random.choice(sale_items)
            qty = random.randint(1, 5)
            pet_id = random.choice(pet_ids_or_null)

            cursor.execute(
                """
                INSERT INTO RECEIPT_DETAIL (
                    RECEIPT_ITEM_ID,
                    RECEIPT_ID,
                    PRODUCT_ID,
                    PET_ID,
                    RECEIPT_ITEM_AMOUNT,
                    RECEIPT_ITEM_PRICE
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    item_index,  # item id per receipt
                    receipt_id,
                    product_id,
                    pet_id,
                    qty,
                    price,
                ),
            )
            count += 1

            if count % batch_size == 0:
                conn.commit()
                print(f"  > Đã insert {count} RECEIPT_DETAIL...")

    conn.commit()
    print(f"Hoàn thành sinh RECEIPT_DETAIL. Tổng dòng ~{count}")


# ==============================
# 6. INSERT CUSTOMER_SPENDING (tính từ RECEIPT)
# ==============================
def rebuild_customer_spending():
    print("Đang tái tạo CUSTOMER_SPENDING từ RECEIPT...")

    # Xoá cũ (nếu có)
    cursor.execute("DELETE FROM CUSTOMER_SPENDING")
    conn.commit()

    # Gom doanh thu theo CUSTOMER_ID + YEAR
    cursor.execute(
        """
            SELECT
                CUSTOMER_ID,
                YEAR(RECEIPT_CREATED_DATE) AS Y,
                SUM(RECEIPT_TOTAL_PRICE) AS TOTAL_SPENT
            FROM RECEIPT
            WHERE RECEIPT_STATUS = ?
            GROUP BY CUSTOMER_ID, YEAR(RECEIPT_CREATED_DATE)
            """,
        ("Đã hoàn thành",)   # pyodbc truyền Unicode param, không bị lỗi code page
    )

    rows = cursor.fetchall()
    batch_size = 1000
    count = 0

    for row in rows:
        customer_id, year, total_spent = row
        cursor.execute(
            """
            INSERT INTO CUSTOMER_SPENDING (CUSTOMER_ID, YEAR, MONEY_SPENT)
            VALUES (?, ?, ?)
            """,
            (customer_id, int(year), int(total_spent)),
        )
        count += 1
        if count % batch_size == 0:
            conn.commit()
            print(f"  > Đã insert {count} CUSTOMER_SPENDING...")

    conn.commit()
    print(f"Hoàn thành CUSTOMER_SPENDING với {count} dòng.")


# ==============================
# 7. INSERT REVIEW
# ==============================
def insert_reviews():
    print("Đang sinh REVIEW cho một phần RECEIPT...")

    cursor.execute(
        """
            SELECT RECEIPT_ID
            FROM RECEIPT
            WHERE RECEIPT_STATUS = ?
            """,
        ("Đã hoàn thành",)
    )

    receipt_ids = [row[0] for row in cursor.fetchall()]
    if not receipt_ids:
        print("Không có hoá đơn 'Đã hoàn thành' để tạo REVIEW.")
        return

    random.shuffle(receipt_ids)
    n_reviews = int(len(receipt_ids) * REVIEW_RATIO)
    chosen_ids = receipt_ids[:n_reviews]

    comments_good = [
        "Dịch vụ rất tốt, nhân viên thân thiện.",
        "Bác sĩ khám kỹ, tư vấn rõ ràng.",
        "Không gian sạch sẽ, thú cưng thoải mái.",
        "Giá cả hợp lý, sẽ quay lại.",
    ]
    comments_bad = [
        "Thời gian chờ hơi lâu.",
        "Giá hơi cao so với kỳ vọng.",
        "Nhân viên thu ngân chưa nhiệt tình lắm.",
    ]

    batch_size = 1000
    count = 0

    for rid in chosen_ids:
        # điểm 0-10
        service_score = random.randint(6, 10)
        staff_score = random.randint(6, 10)
        overall_score = int(round((service_score + staff_score) / 2 + random.randint(-1, 1)))
        overall_score = max(0, min(10, overall_score))

        if overall_score >= 7:
            comment = random.choice(comments_good)
        else:
            comment = random.choice(comments_bad)

        cursor.execute(
            """
            INSERT INTO REVIEW (
                RECEIPT_ID,
                SERVICE_SCORE,
                STAFF_SCORE,
                OVERALL_SCORE,
                COMMENT
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (rid, service_score, staff_score, overall_score, comment),
        )
        count += 1

        if count % batch_size == 0:
            conn.commit()
            print(f"  > Đã insert {count} REVIEW...")

    conn.commit()
    print(f"Hoàn thành sinh REVIEW: {count} dòng.")


# ==============================
# MAIN
# ==============================
if __name__ == "__main__":
    try:
        print("=== BẮT ĐẦU SINH DỮ LIỆU LỚN CHO PETCAREX ===")

        # 1. CUSTOMER
        cursor.execute("SELECT COUNT(*) FROM CUSTOMER")
        existing_customers = cursor.fetchone()[0]
        if existing_customers < N_CUSTOMERS:
            insert_customers(N_CUSTOMERS - existing_customers)
        else:
            print(f"Đã có {existing_customers} CUSTOMER, bỏ qua bước tạo thêm.")

        # 2. PET
        cursor.execute("SELECT COUNT(*) FROM PET")
        existing_pets = cursor.fetchone()[0]
        if existing_pets == 0:
            insert_pets()
        else:
            print(f"Đã có {existing_pets} PET, bỏ qua bước tạo thêm.")

        # 3. CHECK_UP
        cursor.execute("SELECT COUNT(*) FROM CHECK_UP")
        existing_checkups = cursor.fetchone()[0]
        if existing_checkups < N_CHECKUPS:
            insert_checkups(N_CHECKUPS - existing_checkups)
        else:
            print(f"Đã có {existing_checkups} CHECK_UP, bỏ qua bước tạo thêm.")

        # 4. RECEIPT
        cursor.execute("SELECT COUNT(*) FROM RECEIPT")
        existing_receipts = cursor.fetchone()[0]
        if existing_receipts < N_RECEIPTS:
            insert_receipts(N_RECEIPTS - existing_receipts)
        else:
            print(f"Đã có {existing_receipts} RECEIPT, bỏ qua bước tạo thêm.")

        # 5. RECEIPT_DETAIL
        cursor.execute("SELECT COUNT(*) FROM RECEIPT_DETAIL")
        existing_details = cursor.fetchone()[0]
        if existing_details == 0:
            insert_receipt_details()
        else:
            print(f"Đã có {existing_details} RECEIPT_DETAIL, bỏ qua bước tạo thêm.")

        # 6. CUSTOMER_SPENDING
        rebuild_customer_spending()

        # 7. REVIEW
        cursor.execute("SELECT COUNT(*) FROM REVIEW")
        existing_reviews = cursor.fetchone()[0]
        if existing_reviews == 0:
            insert_reviews()
        else:
            print(f"Đã có {existing_reviews} REVIEW, bỏ qua bước tạo thêm.")

        print("=== HOÀN TẤT SINH DỮ LIỆU LỚN CHO PETCAREX ===")
    finally:
        cursor.close()
        conn.close()
