from app.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password
from app.database import SessionLocal

USERS = [
    ("Malik Rayyan", "malikrayyan@fastex.com", "03488845311", "1620206789321", hash_password("Password1."), 5, True, True),
    ("Customer 1", "customer1@fastex.com", "03488845312", "1620206789322", hash_password("Password1."), 1, True, True),
    ("Customer 2", "customer2@fastex.com", "03488845313", "1620206789323", hash_password("Password1."), 1, True, True),
    ("Customer 3", "customer3@fastex.com", "03488845314", "1620206789324", hash_password("Password1."), 1, True, True),
    ("Customer 4", "customer4@fastex.com", "03488845315", "1620206789325", hash_password("Password1."), 1, True, True),
    ("Customer 5", "customer5@fastex.com", "03488845378", "1620206789326", hash_password("Password1."), 1, True, True),
    ("Staff 1", "staff1@fastex.com", "03488845317", "1620206789336", hash_password("Password1."), 1, True, True),
    ("Staff 2", "staff2@fastex.com", "03488845318", "1620206789346", hash_password("Password1."), 1, True, True),
    ("Staff 3", "staff3@fastex.com", "03488845319", "1620206789356", hash_password("Password1."), 1, True, True),
    ("Staff 4", "staff4@fastex.com", "03488845310", "1620206789366", hash_password("Password1."), 1, True, True),
    ("Staff 5", "staff5@fastex.com", "03488845321", "1620206789376", hash_password("Password1."), 1, True, True),
    ("Staff 6", "staff6@fastex.com", "03488845331", "1620206789386", hash_password("Password1."), 1, True, True),
    ("Rider 1", "rider1@fastex.com", "03488845341", "1620206789326", hash_password("Password1."), 1, True, True),
    ("Rider 2", "rider2@fastex.com", "03488845351", "1620206789966", hash_password("Password1."), 1, True, True),
    ("Rider 3", "rider3@fastex.com", "03488845361", "1620206781026", hash_password("Password1."), 1, True, True),
    ("Rider 4", "rider4@fastex.com", "03488845371", "1620206789327", hash_password("Password1."), 1, True, True),
    ("Rider 5", "rider5@fastex.com", "03488845381", "1620206789328", hash_password("Password1."), 1, True, True),
    ("Rider 6", "rider6@fastex.com", "03488845391", "1620206789329", hash_password("Password1."), 1, True, True),

]

def seed():

    db = SessionLocal()
    try:

        for full_name, email, phone, cnic, password, roll_id, is_active, is_verified in USERS:

            user = db.query(User).filter(User.email == email).filter(User.cnic == cnic).filter(User.phone == phone).first()

            if not user:
                user = User(full_name=full_name, email=email, phone=phone, cnic=cnic, hashed_password=password,role_id=roll_id, is_active=is_active, is_verified=is_verified)
                db.add(user)

        db.commit()
        # db.flush()
        print("Users data sucessfully seeded")

    finally:
        db.close()

if __name__ == "__main__":
    seed()