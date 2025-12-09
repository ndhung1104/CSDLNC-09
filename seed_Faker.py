import pyodbc
from faker import Faker
import random
from datetime import datetime, timedelta
from pathlib import Path

# pip install faker pyodbc

# ==============================
# CẤU HÌNH
# ==============================
N_CUSTOMERS = 100000
MAX_PETS_PER_CUSTOMER = 2
N_CHECKUPS = 100000
N_RECEIPTS = 100000
MAX_ITEMS_PER_RECEIPT = 5
REVIEW_RATIO = 0.35  # 35% hoá đơn có review
BATCH_SIZE = 2000  # Smaller batch size to avoid memory issues

# ==============================
# KẾT NỐI SQL SERVER
# ==============================

# Docker Container SQL Server
conn_str = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost,1433;"
    "DATABASE=PETCAREX;"
    "UID=sa;"
    "PWD=PetCareX@2024;"
    "TrustServerCertificate=yes;"
)

conn = pyodbc.connect(conn_str)
cursor = conn.cursor()
cursor.fast_executemany = True  # Enable fast bulk inserts
fake = Faker("vi_VN")

# ==============================
# HÀM HỖ TRỢ
# ==============================
def fetch_ids(query):
    cursor.execute(query)
    return [row[0] for row in cursor.fetchall()]

def random_date_between(start_date, end_date):
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

def bulk_insert(sql, data, table_name):
    """Execute bulk insert with progress reporting (fast with Driver 18)"""
    total = len(data)
    for i in range(0, total, BATCH_SIZE):
        batch = data[i:i+BATCH_SIZE]
        cursor.executemany(sql, batch)
        conn.commit()
        print(f"  > {table_name}: {min(i+BATCH_SIZE, total):,}/{total:,} inserted...")

# ==============================
# SEED MASTER (seed_master.sql)
# ==============================
def execute_sql_batches(sql_text):
    batches = []
    current = []
    for line in sql_text.splitlines():
        if line.strip().upper() == "GO":
            batch = "\n".join(current).strip()
            if batch:
                batches.append(batch)
            current = []
        else:
            current.append(line)

    tail = "\n".join(current).strip()
    if tail:
        batches.append(tail)

    for batch in batches:
        cursor.execute(batch)
    conn.commit()


def run_seed_master_file():
    sql_path = Path(__file__).resolve().parent / "seed_master.sql"
    if not sql_path.exists():
        raise FileNotFoundError(f"seed_master.sql not found at {sql_path}")

    print(f"Running master seed from {sql_path.name} ...")
    sql_text = sql_path.read_text(encoding="utf-8", errors="ignore")
    execute_sql_batches(sql_text)
    print("Master seed finished.")


def ensure_master_seeded():
    cursor.execute("SELECT COUNT(*) FROM MEMBERSHIP_RANK")
    membership_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM PET_BREED")
    breed_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM SERVICE")
    service_count = cursor.fetchone()[0]

    if membership_count == 0 and breed_count == 0 and service_count == 0:
        run_seed_master_file()
        return

    if membership_count == 0 or breed_count == 0 or service_count == 0:
        raise RuntimeError(
            "Master data is partially present. Please reseed or clean the master tables before rerunning."
        )

    print("Master data detected, skip seed_master.sql.")


# ==============================
# LẤY MASTER ID
# ==============================
ensure_master_seeded()
print("Loading master IDs...")

membership_ids = fetch_ids("SELECT MEMBERSHIP_RANK_ID FROM MEMBERSHIP_RANK")
breed_ids = fetch_ids("SELECT BREED_ID FROM PET_BREED")
branch_ids = fetch_ids("SELECT BRANCH_ID FROM BRANCH")
sales_product_ids = fetch_ids("SELECT SALES_PRODUCT_ID FROM SALES_PRODUCT")
medical_service_ids = fetch_ids("SELECT MEDICAL_SERVICE_ID FROM MEDICAL_SERVICE")

cursor.execute("SELECT EMPLOYEE_ID, EMPLOYEE_POSITION FROM EMPLOYEE")
rows = cursor.fetchall()
receptionist_ids = [r[0] for r in rows if r[1].strip() in ("RECEP", "SALES")]
vet_ids = [r[0] for r in rows if r[1].strip() == "VET"]

if not membership_ids or not breed_ids or not branch_ids or not sales_product_ids or not medical_service_ids:
    raise RuntimeError("Missing master data. Run seed_master.sql first.")

print("Master IDs loaded.")
print(f"- MEMBERSHIP_RANK: {len(membership_ids)}")
print(f"- PET_BREED: {len(breed_ids)}")
print(f"- BRANCH: {len(branch_ids)}")
print(f"- SALES_PRODUCT: {len(sales_product_ids)}")
print(f"- MEDICAL_SERVICE: {len(medical_service_ids)}")
print(f"- RECEPTIONIST/SALES: {len(receptionist_ids)}")
print(f"- VET: {len(vet_ids)}")

# ==============================
# 1. INSERT CUSTOMER (BULK)
# ==============================
def insert_customers(n=N_CUSTOMERS):
    print(f"Generating {n:,} customers...")
    cursor.execute("SELECT COUNT(*) FROM CUSTOMER")
    existing = cursor.fetchone()[0]
    start_index = existing + 1

    data = []
    for i in range(n):
        seq = start_index + i
        name = fake.name()
        phone = "0" + str(random.randint(100000000, 999999999))
        email = f"user{seq}@example.com"
        password = f"cust_pwd_{seq:010d}"
        gender = random.choice(["Nam", "Nữ"])
        birthdate = fake.date_between(start_date="-50y", end_date="-18y")
        rank_id = random.choice(membership_ids)
        
        data.append((rank_id, name, phone, email, password, gender, birthdate, 0))

    sql = """
        INSERT INTO CUSTOMER (
            MEMBERSHIP_RANK_ID, CUSTOMER_NAME, CUSTOMER_PHONE, CUSTOMER_EMAIL,
            EMPLOYEE_PASSWORD, CUSTOMER_GENDER, CUSTOMER_BIRTHDATE, CUSTOMER_LOYALTY
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    bulk_insert(sql, data, "CUSTOMER")
    print(f"Completed: {n:,} customers inserted.")


# ==============================
# 2. INSERT PET (BULK)
# ==============================
def insert_pets():
    print("Generating pets for all customers...")
    customer_ids = fetch_ids("SELECT CUSTOMER_ID FROM CUSTOMER")
    print(f"Total customers: {len(customer_ids):,}")

    pet_names = ["Bông", "Đốm", "Miu", "Cún", "Na", "Xoài", "Lu", "Mực", "Bé", "Bon", "Susu", "Lucky", "Max", "Milo"]
    health_statuses = ["Khỏe", "Béo phì nhẹ", "Viêm da nhẹ", "Dị ứng nhẹ", "Viêm tai nhẹ"]

    data = []
    for customer_id in customer_ids:
        num_pets = random.randint(1, MAX_PETS_PER_CUSTOMER)
        for _ in range(num_pets):
            pet_name = random.choice(pet_names) + " " + str(random.randint(1, 99))
            breed_id = random.choice(breed_ids)
            gender = random.choice(["Nam", "Nữ"])
            birthdate = fake.date_between(start_date="-15y", end_date="today")
            health_status = random.choice(health_statuses)
            
            data.append((customer_id, pet_name, breed_id, gender, birthdate, health_status))

    sql = """
        INSERT INTO PET (
            CUSTOMER_ID, PET_NAME, PET_BREED_ID, PET_GENDER, PET_BIRTHDATE, PET_HEALTH_STATUS
        ) VALUES (?, ?, ?, ?, ?, ?)
    """
    bulk_insert(sql, data, "PET")
    print(f"Completed: {len(data):,} pets inserted.")


# ==============================
# 3. INSERT CHECK_UP (BULK with small batches)
# ==============================
def insert_checkups(n=N_CHECKUPS):
    print(f"Generating {n:,} checkups...")
    pet_ids = fetch_ids("SELECT PET_ID FROM PET")
    if not pet_ids:
        raise RuntimeError("No PET found for CHECK_UP.")
    if not vet_ids:
        raise RuntimeError("No VET found in EMPLOYEE.")

    start_date = datetime.now() - timedelta(days=365 * 3)
    end_date = datetime.now()

    symptoms_list = [
        "Bỏ ăn, nôn nhẹ", "Tiêu chảy 2 ngày", "Ngứa nhiều, gãi liên tục",
        "Ho khan, sổ mũi", "Mắt đỏ, chảy ghèn", "Lười vận động, mệt mỏi",
    ]
    diagnosis_list = [
        "Viêm da dị ứng nhẹ", "Rối loạn tiêu hóa", "Nhiễm khuẩn đường hô hấp trên",
        "Viêm tai ngoài", "Viêm kết mạc", "Thừa cân, cần giảm khẩu phần",
    ]

    sql = """
        INSERT INTO CHECK_UP (
            MEDICAL_SERVICE, PET_ID, VET_ID, SYMPTOMS, DIAGNOSIS,
            PRESCRIPTION_AVAILABLE, FOLLOW_UP_VISIT, STATUS
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    count = 0
    batch = []
    for _ in range(n):
        pet_id = random.choice(pet_ids)
        med_service_id = random.choice(medical_service_ids)
        vet_id = random.choice(vet_ids)
        symptoms = random.choice(symptoms_list)
        diagnosis = random.choice(diagnosis_list)
        status = random.choice(["Chờ", "Hoàn tất"])
        visit_date = random_date_between(start_date, end_date)
        follow_up = visit_date + timedelta(days=random.randint(7, 30)) if random.random() < 0.3 else None
        has_prescription = 1 if random.random() < 0.7 else 0

        batch.append((med_service_id, pet_id, vet_id, symptoms, diagnosis, has_prescription, follow_up, status))
        
        if len(batch) >= 1000:  # Smaller batch to be safe
            cursor.executemany(sql, batch)
            conn.commit()
            count += len(batch)
            print(f"  > CHECK_UP: {count:,}/{n:,} inserted...")
            batch = []
    
    if batch:
        cursor.executemany(sql, batch)
        conn.commit()
        count += len(batch)
    
    print(f"Completed: {count:,} checkups inserted.")


# ==============================
# 4. INSERT RECEIPT (BULK with small batches)
# ==============================
def insert_receipts(n=N_RECEIPTS):
    print(f"Generating {n:,} receipts...")
    customer_ids = fetch_ids("SELECT CUSTOMER_ID FROM CUSTOMER")
    if not receptionist_ids:
        raise RuntimeError("No RECEPTIONIST/SALES found in EMPLOYEE.")

    start_date = datetime.now() - timedelta(days=365 * 3)
    end_date = datetime.now()
    payment_methods = ["Tiền mặt", "Thẻ", "Chuyển khoản"]

    sql = """
        INSERT INTO RECEIPT (
            BRANCH_ID, CUSTOMER_ID, RECEPTIONIST_ID, RECEIPT_CREATED_DATE,
            RECEIPT_TOTAL_PRICE, RECEIPT_PAYMENT_METHOD, RECEIPT_STATUS
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    
    count = 0
    batch = []
    for _ in range(n):
        branch_id = random.choice(branch_ids)
        customer_id = random.choice(customer_ids)
        receptionist_id = random.choice(receptionist_ids)
        created_at = random_date_between(start_date, end_date)
        total_price = random.randint(50000, 5000000)
        payment_method = random.choice(payment_methods)
        
        status_prob = random.random()
        if status_prob < 0.8:
            status = "Đã hoàn thành"
        elif status_prob < 0.95:
            status = "Chờ thanh toán"
        else:
            status = "Hủy"

        batch.append((branch_id, customer_id, receptionist_id, created_at, total_price, payment_method, status))
        
        if len(batch) >= 1000:
            cursor.executemany(sql, batch)
            conn.commit()
            count += len(batch)
            print(f"  > RECEIPT: {count:,}/{n:,} inserted...")
            batch = []
    
    if batch:
        cursor.executemany(sql, batch)
        conn.commit()
        count += len(batch)
    
    print(f"Completed: {count:,} receipts inserted.")


# ==============================
# 5. INSERT RECEIPT_DETAIL (BULK with small batches)
# ==============================
def insert_receipt_details():
    print("Generating receipt details...")
    receipt_ids = fetch_ids("SELECT RECEIPT_ID FROM RECEIPT")
    if not receipt_ids:
        raise RuntimeError("No RECEIPT found for RECEIPT_DETAIL.")

    cursor.execute("""
        SELECT S.SALES_PRODUCT_ID, P.PRODUCT_ID, S.SALES_PRODUCT_PRICE
        FROM SALES_PRODUCT S
        JOIN PRODUCT P ON P.PRODUCT_ID = S.SALES_PRODUCT_ID
    """)
    sale_items = [(row[0], row[1], row[2]) for row in cursor.fetchall()]
    if not sale_items:
        raise RuntimeError("No SALES_PRODUCT found.")

    pet_ids = fetch_ids("SELECT PET_ID FROM PET")
    pet_ids_or_null = pet_ids + [None] * 5

    sql = """
        INSERT INTO RECEIPT_DETAIL (
            RECEIPT_ITEM_ID, RECEIPT_ID, PRODUCT_ID, PET_ID, RECEIPT_ITEM_AMOUNT, RECEIPT_ITEM_PRICE
        ) VALUES (?, ?, ?, ?, ?, ?)
    """
    
    count = 0
    batch = []
    total_receipts = len(receipt_ids)
    
    for idx, receipt_id in enumerate(receipt_ids):
        num_items = random.randint(1, MAX_ITEMS_PER_RECEIPT)
        for item_index in range(1, num_items + 1):
            sale_product_id, product_id, price = random.choice(sale_items)
            qty = random.randint(1, 5)
            pet_id = random.choice(pet_ids_or_null)
            batch.append((item_index, receipt_id, product_id, pet_id, qty, price))
            
            if len(batch) >= 1000:
                cursor.executemany(sql, batch)
                conn.commit()
                count += len(batch)
                print(f"  > RECEIPT_DETAIL: {count:,} inserted...")
                batch = []
    
    if batch:
        cursor.executemany(sql, batch)
        conn.commit()
        count += len(batch)
    
    print(f"Completed: {count:,} receipt details inserted.")


# ==============================
# 6. REBUILD CUSTOMER_SPENDING
# ==============================
def rebuild_customer_spending():
    print("Rebuilding CUSTOMER_SPENDING from RECEIPT...")
    cursor.execute("DELETE FROM CUSTOMER_SPENDING")
    conn.commit()

    cursor.execute("""
        SELECT CUSTOMER_ID, YEAR(RECEIPT_CREATED_DATE), SUM(RECEIPT_TOTAL_PRICE)
        FROM RECEIPT
        WHERE RECEIPT_STATUS = N'Đã hoàn thành'
        GROUP BY CUSTOMER_ID, YEAR(RECEIPT_CREATED_DATE)
    """)
    rows = cursor.fetchall()

    data = [(row[0], int(row[1]), int(row[2])) for row in rows]

    sql = "INSERT INTO CUSTOMER_SPENDING (CUSTOMER_ID, YEAR, MONEY_SPENT) VALUES (?, ?, ?)"
    bulk_insert(sql, data, "CUSTOMER_SPENDING")
    print(f"Completed: {len(data):,} customer spending records.")


# ==============================
# 7. INSERT REVIEW (BULK)
# ==============================
def insert_reviews():
    print("Generating reviews...")
    cursor.execute("SELECT RECEIPT_ID FROM RECEIPT WHERE RECEIPT_STATUS = N'Đã hoàn thành'")
    receipt_ids = [row[0] for row in cursor.fetchall()]
    if not receipt_ids:
        print("No completed receipts for REVIEW.")
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

    data = []
    for rid in chosen_ids:
        service_score = random.randint(6, 10)
        staff_score = random.randint(6, 10)
        overall_score = max(0, min(10, int(round((service_score + staff_score) / 2 + random.randint(-1, 1)))))
        comment = random.choice(comments_good) if overall_score >= 7 else random.choice(comments_bad)
        data.append((rid, service_score, staff_score, overall_score, comment))

    sql = """
        INSERT INTO REVIEW (
            RECEIPT_ID, SERVICE_SCORE, STAFF_SCORE, OVERALL_SCORE, COMMENT
        ) VALUES (?, ?, ?, ?, ?)
    """
    bulk_insert(sql, data, "REVIEW")
    print(f"Completed: {len(data):,} reviews inserted.")


# ==============================
# MAIN
# ==============================
if __name__ == "__main__":
    import time
    start_time = time.time()
    
    try:
        print("=" * 60)
        print("PETCAREX BULK DATA SEEDING (Optimized)")
        print(f"Target: {N_CUSTOMERS:,} customers, ~{N_CUSTOMERS*1.5:,.0f} pets")
        print("=" * 60)

        # 1. CUSTOMER
        cursor.execute("SELECT COUNT(*) FROM CUSTOMER")
        existing = cursor.fetchone()[0]
        if existing < N_CUSTOMERS:
            insert_customers(N_CUSTOMERS - existing)
        else:
            print(f"Already have {existing:,} customers, skipping.")

        # 2. PET
        cursor.execute("SELECT COUNT(*) FROM PET")
        existing = cursor.fetchone()[0]
        if existing == 0:
            insert_pets()
        else:
            print(f"Already have {existing:,} pets, skipping.")

        # 3. CHECK_UP
        cursor.execute("SELECT COUNT(*) FROM CHECK_UP")
        existing = cursor.fetchone()[0]
        if existing < N_CHECKUPS:
            insert_checkups(N_CHECKUPS - existing)
        else:
            print(f"Already have {existing:,} checkups, skipping.")

        # 4. RECEIPT
        cursor.execute("SELECT COUNT(*) FROM RECEIPT")
        existing = cursor.fetchone()[0]
        if existing < N_RECEIPTS:
            insert_receipts(N_RECEIPTS - existing)
        else:
            print(f"Already have {existing:,} receipts, skipping.")

        # 5. RECEIPT_DETAIL
        cursor.execute("SELECT COUNT(*) FROM RECEIPT_DETAIL")
        existing = cursor.fetchone()[0]
        if existing == 0:
            insert_receipt_details()
        else:
            print(f"Already have {existing:,} receipt details, skipping.")

        # 6. CUSTOMER_SPENDING
        rebuild_customer_spending()

        # 7. REVIEW
        cursor.execute("SELECT COUNT(*) FROM REVIEW")
        existing = cursor.fetchone()[0]
        if existing == 0:
            insert_reviews()
        else:
            print(f"Already have {existing:,} reviews, skipping.")

        elapsed = time.time() - start_time
        print("=" * 60)
        print(f"COMPLETED in {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
        print("=" * 60)

    finally:
        cursor.close()
        conn.close()
