"""
Run: python seed_test_zones_branches.py
Seeds test Zones, Branches, and associates test Staff and Rider accounts to them.
"""
from app.database import SessionLocal
from app.models.zone import Zone
from app.models.branch import Branch
from app.models.user import User
from app.models.role import Role
from app.models.staff import StaffProfile
from app.models.rider import RiderProfile, RiderStatus
from app.core.security import hash_password

def seed():
    db = SessionLocal()
    try:
        # 1. Seed Zones
        rwp_zone = db.query(Zone).filter(Zone.name == "Rawalpindi").first()
        if not rwp_zone:
            rwp_zone = Zone(name="Rawalpindi", description="Rawalpindi Operational Zone")
            db.add(rwp_zone)
            db.flush()

        lhr_zone = db.query(Zone).filter(Zone.name == "Lahore").first()
        if not lhr_zone:
            lhr_zone = Zone(name="Lahore", description="Lahore Operational Zone")
            db.add(lhr_zone)
            db.flush()

        # 2. Seed Branches
        rwp_branch = db.query(Branch).filter(Branch.name == "Rawalpindi HQ").first()
        if not rwp_branch:
            rwp_branch = Branch(name="Rawalpindi HQ", address="Saddar, Rawalpindi", zone_id=rwp_zone.id)
            db.add(rwp_branch)
            db.flush()

        lhr_branch = db.query(Branch).filter(Branch.name == "Lahore Central").first()
        if not lhr_branch:
            lhr_branch = Branch(name="Lahore Central", address="Gulberg, Lahore", zone_id=lhr_zone.id)
            db.add(lhr_branch)
            db.flush()

        # Get Roles
        staff_role = db.query(Role).filter(Role.name == "staff").first()
        rider_role = db.query(Role).filter(Role.name == "rider").first()

        if not staff_role or not rider_role:
            print("Roles (staff, rider) not found. Run seed_roles.py first.")
            return

        # 3. Seed Rawalpindi Staff
        staff_email = "rwp_staff@fastex.com"
        staff_user = db.query(User).filter(User.email == staff_email).first()
        if not staff_user:
            staff_user = User(
                full_name="Rwp Staff Member",
                email=staff_email,
                phone="03001111111",
                cnic="3740512345671",
                hashed_password=hash_password("Password123"),
                role_id=staff_role.id,
                is_active=True,
                is_verified=True,
            )
            db.add(staff_user)
            db.flush()

            staff_profile = StaffProfile(
                user_id=staff_user.id,
                branch_id=rwp_branch.id,
                employee_code="STF-RWP-01",
                branch_name=rwp_branch.name,
                branch_location=rwp_branch.address
            )
            db.add(staff_profile)

        # 4. Seed Rawalpindi Rider (Online)
        rwp_rider_email = "rwp_rider@fastex.com"
        rwp_rider_user = db.query(User).filter(User.email == rwp_rider_email).first()
        if not rwp_rider_user:
            rwp_rider_user = User(
                full_name="Rwp Rider Partner",
                email=rwp_rider_email,
                phone="03002222222",
                cnic="3740512345672",
                hashed_password=hash_password("Password123"),
                role_id=rider_role.id,
                is_active=True,
                is_verified=True,
            )
            db.add(rwp_rider_user)
            db.flush()

            rwp_rider_profile = RiderProfile(
                user_id=rwp_rider_user.id,
                branch_id=rwp_branch.id,
                status=RiderStatus.active,
                is_available=True,
                vehicle_type="bike",
                license_number="LIC-RWP-99",
                rating=5.0
            )
            db.add(rwp_rider_profile)

        # 5. Seed Lahore Rider (Online)
        lhr_rider_email = "lhr_rider@fastex.com"
        lhr_rider_user = db.query(User).filter(User.email == lhr_rider_email).first()
        if not lhr_rider_user:
            lhr_rider_user = User(
                full_name="Lhr Rider Partner",
                email=lhr_rider_email,
                phone="03003333333",
                cnic="3740512345673",
                hashed_password=hash_password("Password123"),
                role_id=rider_role.id,
                is_active=True,
                is_verified=True,
            )
            db.add(lhr_rider_user)
            db.flush()

            lhr_rider_profile = RiderProfile(
                user_id=lhr_rider_user.id,
                branch_id=lhr_branch.id,
                status=RiderStatus.active,
                is_available=True,
                vehicle_type="bike",
                license_number="LIC-LHR-99",
                rating=5.0
            )
            db.add(lhr_rider_profile)

        db.commit()
        print("Zones, branches, and test users seeded successfully.")
        print(f"Rwp Staff: {staff_email} / Password123")
        print(f"Rwp Rider: {rwp_rider_email} / Password123")
        print(f"Lhr Rider: {lhr_rider_email} / Password123")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
