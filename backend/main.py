import os
from dotenv import load_dotenv

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.database import get_db

from backend.schemas import (
    TransportCreate,
    StopCreate,
    RouteCreate,
    RouteStopCreate,
    UserCreate,
    UserUpdate,
    LoginRequest,
    StudentVerificationCreate,
    FareCreate,
    FareLogCreate,
    ForumPostCreate,
    ForumReplyCreate,
    RatingCreate,
    ComplaintCreate,
    ComplaintStatusUpdate
)

import bcrypt

from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone

load_dotenv()


# =========================================================
# APP SETUP
# =========================================================

app = FastAPI(title="NogorGoti API")


# =========================================================
# JWT SETTINGS
# =========================================================

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is not set")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# JWT HELPERS
# =========================================================

def create_access_token(data: dict):

    token_data = data.copy()

    expire_time = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    token_data.update({
        "exp": expire_time
    })

    access_token = jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return access_token


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")
        email = payload.get("email")
        role = payload.get("role")

        if user_id is None or email is None or role is None:

            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

        return {
            "user_id": user_id,
            "email": email,
            "role": role
        }

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


def require_admin(
    current_user=Depends(get_current_user)
):

    if current_user["role"] != "ADMIN":

        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user


# =========================================================
# ROOT
# PUBLIC
# =========================================================

@app.get("/")
def root(db=Depends(get_db)):

    cursor = db.cursor()

    cursor.execute("SELECT 1")

    result = cursor.fetchone()

    cursor.close()

    return {
        "message": "NogorGoti API is running",
        "database": result[0] == 1
    }


# =========================================================
# AUTHENTICATION
# =========================================================

@app.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    user: UserCreate,
    db=Depends(get_db)
):

    cursor = db.cursor()

    # Check whether email already exists
    cursor.execute(
        """
        SELECT user_id
        FROM users
        WHERE email = %s
        """,
        (user.email,)
    )

    existing_user = cursor.fetchone()

    if existing_user is not None:

        cursor.close()

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    # Check whether phone number already exists
    if user.phone is not None:

     cursor.execute(
        """
        SELECT user_id
        FROM users
        WHERE phone = %s
        """,
        (user.phone,)
    )

    existing_phone = cursor.fetchone()

    if existing_phone is not None:

        cursor.close()

        raise HTTPException(
            status_code=400,
            detail="Phone number already registered"
        )

    # Convert password string into bytes
    password_bytes = user.password.encode("utf-8")

    # bcrypt supports passwords up to 72 bytes
    if len(password_bytes) > 72:

        cursor.close()

        raise HTTPException(
            status_code=400,
            detail="Password is too long"
        )

    # Hash password using bcrypt
    hashed_password = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    ).decode("utf-8")

    # Public registration always creates PASSENGER
    role = "PASSENGER"

    sql = """
        INSERT INTO users
        (
            name,
            email,
            phone,
            password_hash,
            role
        )
        VALUES (%s, %s, %s, %s, %s)
    """

    values = (
        user.name,
        user.email,
        user.phone,
        hashed_password,
        role
    )

    cursor.execute(sql, values)

    db.commit()

    user_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "User registered successfully",
        "user_id": user_id,
        "name": user.name,
        "email": user.email,
        "role": role
    }


@app.post("/login")
def login(
    login_data: LoginRequest,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    # Find user by email
    cursor.execute(
        """
        SELECT
            user_id,
            name,
            email,
            password_hash,
            role
        FROM users
        WHERE email = %s
        """,
        (login_data.email,)
    )

    user = cursor.fetchone()

    if user is None:

        cursor.close()

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Check entered password against stored bcrypt hash
    try:

        password_correct = bcrypt.checkpw(
            login_data.password.encode("utf-8"),
            user["password_hash"].encode("utf-8")
        )

    except ValueError:

        password_correct = False

    if not password_correct:

        cursor.close()

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Create JWT after password is correct
    access_token = create_access_token({

        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"]

    })

    cursor.close()

    return {

        "message": "Login successful",

        "access_token": access_token,

        "token_type": "bearer",

        "user": {

            "user_id": user["user_id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]

        }
    }


# =========================================================
# USERS
# =========================================================

# ADMIN ONLY
@app.get("/users")
def get_users(
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT
            user_id,
            name,
            email,
            phone,
            role,
            created_at
        FROM users
        ORDER BY user_id
    """

    cursor.execute(sql)

    users = cursor.fetchall()

    cursor.close()

    return users


# USER CAN VIEW OWN PROFILE
# ADMIN CAN VIEW ANY PROFILE
@app.get("/users/{user_id}")
def get_user(
    user_id: int,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):

    if (
        current_user["user_id"] != user_id
        and current_user["role"] != "ADMIN"
    ):

        raise HTTPException(
            status_code=403,
            detail="You cannot view another user's profile"
        )

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            user_id,
            name,
            email,
            phone,
            role,
            created_at
        FROM users
        WHERE user_id = %s
        """,
        (user_id,)
    )

    user = cursor.fetchone()

    cursor.close()

    if user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return user


@app.put("/users/{user_id}")
def update_user(
    user_id: int,
    user: UserUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):

    if (
        current_user["user_id"] != user_id
        and current_user["role"] != "ADMIN"
    ):

        raise HTTPException(
            status_code=403,
            detail="You cannot update another user's profile"
        )

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT user_id
        FROM users
        WHERE user_id = %s
        """,
        (user_id,)
    )

    existing_user = cursor.fetchone()

    if existing_user is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Check whether another user already uses the email
    cursor.execute(
        """
        SELECT user_id
        FROM users
        WHERE email = %s
        AND user_id != %s
        """,
        (
            user.email,
            user_id
        )
    )

    duplicate_email = cursor.fetchone()

    if duplicate_email is not None:

        cursor.close()

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    sql = """
        UPDATE users
        SET
            name = %s,
            email = %s,
            phone = %s
        WHERE user_id = %s
    """

    values = (
        user.name,
        user.email,
        user.phone,
        user_id
    )

    cursor.execute(sql, values)

    db.commit()

    cursor.close()

    return {
        "message": "User updated successfully",
        "user_id": user_id
    }


# =========================================================
# TRANSPORT MANAGEMENT
# =========================================================

# ADMIN ONLY
@app.post("/transports", status_code=status.HTTP_201_CREATED)
def create_transport(
    transport: TransportCreate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    sql = """
        INSERT INTO transport
        (
            transport_type,
            transport_number,
            capacity,
            company_id
        )
        VALUES (%s, %s, %s, %s)
    """

    values = (
        transport.transport_type,
        transport.transport_number,
        transport.capacity,
        transport.company_id
    )

    cursor.execute(sql, values)

    db.commit()

    transport_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "Transport created successfully",
        "transport_id": transport_id
    }


# PUBLIC
@app.get("/transports")
def get_transports(
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            transport_id,
            transport_type,
            transport_number,
            capacity,
            company_id
        FROM transport
        ORDER BY transport_id
        """
    )

    transports = cursor.fetchall()

    cursor.close()

    return transports


# PUBLIC
@app.get("/transports/{transport_id}")
def get_transport(
    transport_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            transport_id,
            transport_type,
            transport_number,
            capacity,
            company_id
        FROM transport
        WHERE transport_id = %s
        """,
        (transport_id,)
    )

    transport = cursor.fetchone()

    cursor.close()

    if transport is None:

        raise HTTPException(
            status_code=404,
            detail="Transport not found"
        )

    return transport


# ADMIN ONLY
@app.put("/transports/{transport_id}")
def update_transport(
    transport_id: int,
    transport: TransportCreate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT transport_id
        FROM transport
        WHERE transport_id = %s
        """,
        (transport_id,)
    )

    existing_transport = cursor.fetchone()

    if existing_transport is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Transport not found"
        )

    sql = """
        UPDATE transport
        SET
            transport_type = %s,
            transport_number = %s,
            capacity = %s,
            company_id = %s
        WHERE transport_id = %s
    """

    values = (
        transport.transport_type,
        transport.transport_number,
        transport.capacity,
        transport.company_id,
        transport_id
    )

    cursor.execute(sql, values)

    db.commit()

    cursor.close()

    return {
        "message": "Transport updated successfully",
        "transport_id": transport_id
    }


# ADMIN ONLY
@app.delete("/transports/{transport_id}")
def delete_transport(
    transport_id: int,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT transport_id
        FROM transport
        WHERE transport_id = %s
        """,
        (transport_id,)
    )

    existing_transport = cursor.fetchone()

    if existing_transport is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Transport not found"
        )

    cursor.execute(
        """
        DELETE FROM transport
        WHERE transport_id = %s
        """,
        (transport_id,)
    )

    db.commit()

    cursor.close()

    return {
        "message": "Transport deleted successfully",
        "transport_id": transport_id
    }


# =========================================================
# STOP MANAGEMENT
# =========================================================

# ADMIN ONLY
@app.post("/stops", status_code=status.HTTP_201_CREATED)
def create_stop(
    stop: StopCreate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    sql = """
        INSERT INTO stops
        (
            stop_name,
            location,
            latitude,
            longitude
        )
        VALUES (%s, %s, %s, %s)
    """

    values = (
        stop.stop_name,
        stop.location,
        stop.latitude,
        stop.longitude
    )

    cursor.execute(sql, values)

    db.commit()

    stop_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "Stop created successfully",
        "stop_id": stop_id
    }


# PUBLIC
@app.get("/stops")
def get_stops(
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            stop_id,
            stop_name,
            location,
            latitude,
            longitude
        FROM stops
        ORDER BY stop_id
        """
    )

    stops = cursor.fetchall()

    cursor.close()

    return stops


# PUBLIC
@app.get("/stops/{stop_id}")
def get_stop(
    stop_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            stop_id,
            stop_name,
            location,
            latitude,
            longitude
        FROM stops
        WHERE stop_id = %s
        """,
        (stop_id,)
    )

    stop = cursor.fetchone()

    cursor.close()

    if stop is None:

        raise HTTPException(
            status_code=404,
            detail="Stop not found"
        )

    return stop


# ADMIN ONLY
@app.put("/stops/{stop_id}")
def update_stop(
    stop_id: int,
    stop: StopCreate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT stop_id
        FROM stops
        WHERE stop_id = %s
        """,
        (stop_id,)
    )

    existing_stop = cursor.fetchone()

    if existing_stop is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Stop not found"
        )

    sql = """
        UPDATE stops
        SET
            stop_name = %s,
            location = %s,
            latitude = %s,
            longitude = %s
        WHERE stop_id = %s
    """

    values = (
        stop.stop_name,
        stop.location,
        stop.latitude,
        stop.longitude,
        stop_id
    )

    cursor.execute(sql, values)

    db.commit()

    cursor.close()

    return {
        "message": "Stop updated successfully",
        "stop_id": stop_id
    }


# ADMIN ONLY
@app.delete("/stops/{stop_id}")
def delete_stop(
    stop_id: int,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT stop_id
        FROM stops
        WHERE stop_id = %s
        """,
        (stop_id,)
    )

    existing_stop = cursor.fetchone()

    if existing_stop is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Stop not found"
        )

    cursor.execute(
        """
        DELETE FROM stops
        WHERE stop_id = %s
        """,
        (stop_id,)
    )

    db.commit()

    cursor.close()

    return {
        "message": "Stop deleted successfully",
        "stop_id": stop_id
    }


# =========================================================
# ROUTE MANAGEMENT
# =========================================================

# ADMIN ONLY
@app.post("/routes", status_code=status.HTTP_201_CREATED)
def create_route(
    route: RouteCreate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    sql = """
        INSERT INTO routes
        (
            route_name,
            route_number
        )
        VALUES (%s, %s)
    """

    values = (
        route.route_name,
        route.route_number
    )

    cursor.execute(sql, values)

    db.commit()

    route_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "Route created successfully",
        "route_id": route_id
    }


# PUBLIC
@app.get("/routes")
def get_routes(
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            route_id,
            route_name,
            route_number
        FROM routes
        ORDER BY route_id
        """
    )

    routes = cursor.fetchall()

    cursor.close()

    return routes


# PUBLIC
@app.get("/routes/{route_id}")
def get_route(
    route_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            route_id,
            route_name,
            route_number
        FROM routes
        WHERE route_id = %s
        """,
        (route_id,)
    )

    route = cursor.fetchone()

    cursor.close()

    if route is None:

        raise HTTPException(
            status_code=404,
            detail="Route not found"
        )

    return route


# ADMIN ONLY
@app.put("/routes/{route_id}")
def update_route(
    route_id: int,
    route: RouteCreate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT route_id
        FROM routes
        WHERE route_id = %s
        """,
        (route_id,)
    )

    existing_route = cursor.fetchone()

    if existing_route is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Route not found"
        )

    sql = """
        UPDATE routes
        SET
            route_name = %s,
            route_number = %s
        WHERE route_id = %s
    """

    values = (
        route.route_name,
        route.route_number,
        route_id
    )

    cursor.execute(sql, values)

    db.commit()

    cursor.close()

    return {
        "message": "Route updated successfully",
        "route_id": route_id
    }


# ADMIN ONLY
@app.delete("/routes/{route_id}")
def delete_route(
    route_id: int,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT route_id
        FROM routes
        WHERE route_id = %s
        """,
        (route_id,)
    )

    existing_route = cursor.fetchone()

    if existing_route is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Route not found"
        )

    cursor.execute(
        """
        DELETE FROM routes
        WHERE route_id = %s
        """,
        (route_id,)
    )

    db.commit()

    cursor.close()

    return {
        "message": "Route deleted successfully",
        "route_id": route_id
    }


# =========================================================
# ROUTE STOPS
# =========================================================

# ADMIN ONLY
@app.post(
    "/routes/{route_id}/stops",
    status_code=status.HTTP_201_CREATED
)
def add_stop_to_route(
    route_id: int,
    route_stop: RouteStopCreate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT route_id
        FROM routes
        WHERE route_id = %s
        """,
        (route_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Route not found"
        )

    cursor.execute(
        """
        SELECT stop_id
        FROM stops
        WHERE stop_id = %s
        """,
        (route_stop.stop_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Stop not found"
        )

    sql = """
        INSERT INTO route_stops
        (
            route_id,
            stop_id,
            stop_sequence,
            distance_from_previous
        )
        VALUES (%s, %s, %s, %s)
    """

    values = (
        route_id,
        route_stop.stop_id,
        route_stop.stop_sequence,
        route_stop.distance_from_previous
    )

    cursor.execute(sql, values)

    db.commit()

    cursor.close()

    return {
        "message": "Stop added to route successfully",
        "route_id": route_id,
        "stop_id": route_stop.stop_id
    }


# PUBLIC
@app.get("/routes/{route_id}/stops")
def get_route_stops(
    route_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT route_id
        FROM routes
        WHERE route_id = %s
        """,
        (route_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Route not found"
        )

    sql = """
        SELECT
            rs.route_id,
            rs.stop_id,
            s.stop_name,
            s.location,
            s.latitude,
            s.longitude,
            rs.stop_sequence,
            rs.distance_from_previous

        FROM route_stops rs

        JOIN stops s
            ON rs.stop_id = s.stop_id

        WHERE rs.route_id = %s

        ORDER BY rs.stop_sequence
    """

    cursor.execute(
        sql,
        (route_id,)
    )

    route_stops = cursor.fetchall()

    cursor.close()

    return route_stops


# ADMIN ONLY
@app.put("/routes/{route_id}/stops/{stop_id}")
def update_route_stop(
    route_id: int,
    stop_id: int,
    route_stop: RouteStopCreate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT route_id, stop_id
        FROM route_stops
        WHERE route_id = %s
        AND stop_id = %s
        """,
        (
            route_id,
            stop_id
        )
    )

    existing_route_stop = cursor.fetchone()

    if existing_route_stop is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Stop is not assigned to this route"
        )

    sql = """
        UPDATE route_stops
        SET
            stop_sequence = %s,
            distance_from_previous = %s
        WHERE route_id = %s
        AND stop_id = %s
    """

    values = (
        route_stop.stop_sequence,
        route_stop.distance_from_previous,
        route_id,
        stop_id
    )

    cursor.execute(sql, values)

    db.commit()

    cursor.close()

    return {
        "message": "Route stop updated successfully",
        "route_id": route_id,
        "stop_id": stop_id
    }


# ADMIN ONLY
@app.delete("/routes/{route_id}/stops/{stop_id}")
def remove_stop_from_route(
    route_id: int,
    stop_id: int,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT route_id, stop_id
        FROM route_stops
        WHERE route_id = %s
        AND stop_id = %s
        """,
        (
            route_id,
            stop_id
        )
    )

    existing_route_stop = cursor.fetchone()

    if existing_route_stop is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Stop is not assigned to this route"
        )

    cursor.execute(
        """
        DELETE FROM route_stops
        WHERE route_id = %s
        AND stop_id = %s
        """,
        (
            route_id,
            stop_id
        )
    )

    db.commit()

    cursor.close()

    return {
        "message": "Stop removed from route successfully",
        "route_id": route_id,
        "stop_id": stop_id
    }


# =========================================================
# STUDENT VERIFICATION
# =========================================================

# LOGGED-IN USER
@app.post(
    "/student-verifications",
    status_code=status.HTTP_201_CREATED
)
def create_student_verification(
    verification: StudentVerificationCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    cursor = db.cursor(dictionary=True)

    user_id = current_user["user_id"]

    # Check whether this user already submitted verification
    cursor.execute(
        """
        SELECT verification_id
        FROM student_verifications
        WHERE user_id = %s
        """,
        (user_id,)
    )

    existing_verification = cursor.fetchone()

    if existing_verification is not None:
        cursor.close()

        raise HTTPException(
            status_code=400,
            detail="Student verification already submitted"
        )

    sql = """
        INSERT INTO student_verifications
        (
            student_id_number,
            institution_name,
            id_card_url,
            user_id
        )
        VALUES (%s, %s, %s, %s)
    """

    values = (
        verification.student_id_number,
        verification.institution_name,
        verification.id_card_url,
        user_id
    )

    cursor.execute(sql, values)

    db.commit()

    verification_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "Student verification submitted successfully",
        "verification_id": verification_id,
        "status": "PENDING"
    }

# ADMIN ONLY
@app.get("/student-verifications")
def get_student_verifications(
    current_user=Depends(require_admin),
    db=Depends(get_db)
):
    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT
            sv.verification_id,
            sv.student_id_number,
            sv.institution_name,
            sv.id_card_url,
            sv.verification_status,
            sv.user_id,

            u.name AS user_name,
            u.email

        FROM student_verifications AS sv

        JOIN users AS u
            ON sv.user_id = u.user_id

        ORDER BY sv.verification_id DESC
    """

    cursor.execute(sql)

    verifications = cursor.fetchall()

    cursor.close()

    return verifications

# ADMIN ONLY
@app.put("/student-verifications/{verification_id}/approve")
def approve_student_verification(
    verification_id: int,
    current_user=Depends(require_admin),
    db=Depends(get_db)
):
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            verification_id,
            verification_status
        FROM student_verifications
        WHERE verification_id = %s
        """,
        (verification_id,)
    )

    verification = cursor.fetchone()

    if verification is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Student verification not found"
        )

    cursor.execute(
        """
        UPDATE student_verifications
        SET verification_status = 'VERIFIED'
        WHERE verification_id = %s
        """,
        (verification_id,)
    )

    db.commit()

    cursor.close()

    return {
        "message": "Student verification approved successfully",
        "verification_id": verification_id,
        "verification_status": "VERIFIED"
    }
# =========================================================
# FARE MANAGEMENT
# =========================================================

# ADMIN ONLY
@app.post("/fares", status_code=status.HTTP_201_CREATED)
def create_fare(
    fare: FareCreate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    # Check origin stop
    cursor.execute(
        """
        SELECT stop_id
        FROM stops
        WHERE stop_id = %s
        """,
        (fare.origin_stop_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Origin stop not found"
        )

    # Check destination stop
    cursor.execute(
        """
        SELECT stop_id
        FROM stops
        WHERE stop_id = %s
        """,
        (fare.destination_stop_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Destination stop not found"
        )

    # Student fare is only allowed for BUS
    if (
        fare.transport_type != "BUS"
        and fare.student_fare is not None
    ):

        cursor.close()

        raise HTTPException(
            status_code=400,
            detail="Student fare is only allowed for BUS"
        )

    sql = """
        INSERT INTO fares
        (
            transport_type,
            standard_fare,
            student_fare,
            origin_stop_id,
            destination_stop_id
        )
        VALUES (%s, %s, %s, %s, %s)
    """

    values = (
        fare.transport_type,
        fare.standard_fare,
        fare.student_fare,
        fare.origin_stop_id,
        fare.destination_stop_id
    )

    cursor.execute(sql, values)

    db.commit()

    fare_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "Fare created successfully",
        "fare_id": fare_id
    }


# PUBLIC
@app.get("/fares")
def get_fares(
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT
            fares.fare_id,
            fares.transport_type,
            fares.standard_fare,
            fares.student_fare,

            fares.origin_stop_id,
            origin.stop_name AS origin_stop_name,

            fares.destination_stop_id,
            destination.stop_name AS destination_stop_name

        FROM fares

        JOIN stops AS origin
            ON fares.origin_stop_id = origin.stop_id

        JOIN stops AS destination
            ON fares.destination_stop_id = destination.stop_id

        ORDER BY fares.fare_id
    """

    cursor.execute(sql)

    fares = cursor.fetchall()

    cursor.close()

    return fares


# ADMIN ONLY
@app.put("/fares/{fare_id}")
def update_fare(
    fare_id: int,
    fare: FareCreate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT fare_id
        FROM fares
        WHERE fare_id = %s
        """,
        (fare_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Fare not found"
        )

    cursor.execute(
        """
        SELECT stop_id
        FROM stops
        WHERE stop_id = %s
        """,
        (fare.origin_stop_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Origin stop not found"
        )

    cursor.execute(
        """
        SELECT stop_id
        FROM stops
        WHERE stop_id = %s
        """,
        (fare.destination_stop_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Destination stop not found"
        )

    if (
        fare.transport_type != "BUS"
        and fare.student_fare is not None
    ):

        cursor.close()

        raise HTTPException(
            status_code=400,
            detail="Student fare is only allowed for BUS"
        )

    sql = """
        UPDATE fares
        SET
            transport_type = %s,
            standard_fare = %s,
            student_fare = %s,
            origin_stop_id = %s,
            destination_stop_id = %s
        WHERE fare_id = %s
    """

    values = (
        fare.transport_type,
        fare.standard_fare,
        fare.student_fare,
        fare.origin_stop_id,
        fare.destination_stop_id,
        fare_id
    )

    cursor.execute(sql, values)

    db.commit()

    cursor.close()

    return {
        "message": "Fare updated successfully",
        "fare_id": fare_id
    }


# ADMIN ONLY
@app.delete("/fares/{fare_id}")
def delete_fare(
    fare_id: int,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT fare_id
        FROM fares
        WHERE fare_id = %s
        """,
        (fare_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Fare not found"
        )

    cursor.execute(
        """
        DELETE FROM fares
        WHERE fare_id = %s
        """,
        (fare_id,)
    )

    db.commit()

    cursor.close()

    return {
        "message": "Fare deleted successfully",
        "fare_id": fare_id
    }


# =========================================================
# FARE LOOKUP
# =========================================================

# PUBLIC
@app.get("/fare-lookup")
def fare_lookup(
    origin_stop_id: int,
    destination_stop_id: int,
    transport_type: str,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT
            fares.fare_id,
            fares.transport_type,
            fares.standard_fare,
            fares.student_fare,

            fares.origin_stop_id,
            origin.stop_name AS origin_stop_name,

            fares.destination_stop_id,
            destination.stop_name AS destination_stop_name

        FROM fares

        JOIN stops AS origin
            ON fares.origin_stop_id = origin.stop_id

        JOIN stops AS destination
            ON fares.destination_stop_id = destination.stop_id

        WHERE fares.origin_stop_id = %s
        AND fares.destination_stop_id = %s
        AND fares.transport_type = %s
    """

    values = (
        origin_stop_id,
        destination_stop_id,
        transport_type
    )

    cursor.execute(sql, values)

    fare = cursor.fetchone()

    cursor.close()

    if fare is None:

        raise HTTPException(
            status_code=404,
            detail="Fare not found"
        )

    return fare


# LOGGED-IN USER
@app.get("/fare-lookup/student")
def student_fare_lookup(
    origin_stop_id: int,
    destination_stop_id: int,
    transport_type: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    # user_id comes from the JWT
    user_id = current_user["user_id"]


    # =====================================================
    # 1. FIND THE FARE FOR THE SELECTED JOURNEY
    # =====================================================

    fare_sql = """
        SELECT
            fares.fare_id,
            fares.transport_type,
            fares.standard_fare,
            fares.student_fare,

            fares.origin_stop_id,
            origin.stop_name AS origin_stop_name,

            fares.destination_stop_id,
            destination.stop_name AS destination_stop_name

        FROM fares

        JOIN stops AS origin
            ON fares.origin_stop_id = origin.stop_id

        JOIN stops AS destination
            ON fares.destination_stop_id = destination.stop_id

        WHERE fares.origin_stop_id = %s
        AND fares.destination_stop_id = %s
        AND fares.transport_type = %s
    """

    cursor.execute(
        fare_sql,
        (
            origin_stop_id,
            destination_stop_id,
            transport_type
        )
    )

    fare_record = cursor.fetchone()


    # If no fare exists for this journey
    if fare_record is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Fare not found"
        )


    # =====================================================
    # 2. CHECK THE LOGGED-IN USER'S STUDENT VERIFICATION
    # =====================================================

    verification_sql = """
        SELECT verification_status
        FROM student_verifications
        WHERE user_id = %s
    """

    cursor.execute(
        verification_sql,
        (user_id,)
    )

    verification_record = cursor.fetchone()


    # User is considered a verified student only if:
    #
    # 1. A verification record exists
    # 2. verification_status is VERIFIED

    is_student_verified = (
        verification_record is not None
        and verification_record["verification_status"] == "VERIFIED"
    )


    # =====================================================
    # 3. DECIDE WHICH FARE APPLIES
    # =====================================================

    if (
        fare_record["transport_type"] == "BUS"
        and is_student_verified
        and fare_record["student_fare"] is not None
    ):

        applicable_fare = fare_record["student_fare"]
        fare_type = "STUDENT"

    else:

        applicable_fare = fare_record["standard_fare"]
        fare_type = "STANDARD"


    cursor.close()


    # =====================================================
    # 4. RETURN THE RESULT
    # =====================================================

    return {
        "fare_id": fare_record["fare_id"],
        "transport_type": fare_record["transport_type"],

        "origin_stop_id": fare_record["origin_stop_id"],
        "origin_stop_name": fare_record["origin_stop_name"],

        "destination_stop_id": fare_record["destination_stop_id"],
        "destination_stop_name": fare_record["destination_stop_name"],

        "standard_fare": fare_record["standard_fare"],
        "student_fare": fare_record["student_fare"],

        "applicable_fare": applicable_fare,
        "fare_type": fare_type
    }

# =========================================================
# CROWDSOURCED FARE TRACKER
# =========================================================

# LOGGED-IN USER
@app.post(
    "/fare-logs",
    status_code=status.HTTP_201_CREATED
)
def create_fare_log(
    fare_log: FareLogCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):

    cursor = db.cursor()

    # Check origin stop
    cursor.execute(
        """
        SELECT stop_id
        FROM stops
        WHERE stop_id = %s
        """,
        (fare_log.origin_stop_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Origin stop not found"
        )

    # Check destination stop
    cursor.execute(
        """
        SELECT stop_id
        FROM stops
        WHERE stop_id = %s
        """,
        (fare_log.destination_stop_id,)
    )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Destination stop not found"
        )

    user_id = current_user["user_id"]

    sql = """
        INSERT INTO fare_logs
        (
            amount_paid,
            transport_type,
            origin_stop_id,
            destination_stop_id,
            user_id
        )
        VALUES (%s, %s, %s, %s, %s)
    """

    values = (
        fare_log.amount_paid,
        fare_log.transport_type,
        fare_log.origin_stop_id,
        fare_log.destination_stop_id,
        user_id
    )

    cursor.execute(sql, values)

    db.commit()

    fare_log_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "Fare report added successfully",
        "fare_log_id": fare_log_id
    }


# PUBLIC
@app.get("/fare-logs")
def get_fare_logs(
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT
            fl.fare_log_id,
            fl.amount_paid,
            fl.transport_type,

            fl.origin_stop_id,
            origin.stop_name AS origin_stop_name,

            fl.destination_stop_id,
            destination.stop_name AS destination_stop_name,

            fl.user_id,
            u.name AS user_name,

            fl.created_at

        FROM fare_logs fl

        JOIN stops AS origin
            ON fl.origin_stop_id = origin.stop_id

        JOIN stops AS destination
            ON fl.destination_stop_id = destination.stop_id

        JOIN users AS u
            ON fl.user_id = u.user_id

        ORDER BY fl.created_at DESC
    """

    cursor.execute(sql)

    fare_logs = cursor.fetchall()

    cursor.close()

    return fare_logs


# PUBLIC
@app.get("/fare-logs/stats")
def get_fare_log_stats(
    origin_stop_id: int,
    destination_stop_id: int,
    transport_type: str,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT
            COUNT(*) AS report_count,
            MIN(amount_paid) AS minimum_fare,
            MAX(amount_paid) AS maximum_fare,
            AVG(amount_paid) AS average_fare

        FROM fare_logs

        WHERE origin_stop_id = %s
        AND destination_stop_id = %s
        AND transport_type = %s
    """

    values = (
        origin_stop_id,
        destination_stop_id,
        transport_type
    )

    cursor.execute(sql, values)

    stats = cursor.fetchone()

    cursor.close()

    if stats["report_count"] == 0:

        raise HTTPException(
            status_code=404,
            detail="No fare reports found for this journey"
        )

    return stats


# =========================================================
# FORUM
# =========================================================

# LOGGED-IN USER
@app.post(
    "/forum/posts",
    status_code=status.HTTP_201_CREATED
)
def create_forum_post(
    post: ForumPostCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):

    cursor = db.cursor()

    user_id = current_user["user_id"]

    sql = """
        INSERT INTO forum_posts
        (
            title,
            description,
            user_id
        )
        VALUES (%s, %s, %s)
    """

    values = (
        post.title,
        post.description,
        user_id
    )

    cursor.execute(sql, values)

    db.commit()

    post_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "Forum post created successfully",
        "post_id": post_id
    }


# PUBLIC
@app.get("/forum/posts")
def get_forum_posts(
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT
            fp.post_id,
            fp.title,
            fp.description,
            fp.created_at,
            fp.user_id,

            u.name AS user_name

        FROM forum_posts fp

        JOIN users u
            ON fp.user_id = u.user_id

        ORDER BY fp.created_at DESC
    """

    cursor.execute(sql)

    posts = cursor.fetchall()

    cursor.close()

    return posts


# LOGGED-IN USER
@app.post(
    "/forum/posts/{post_id}/replies",
    status_code=status.HTTP_201_CREATED
)
def create_forum_reply(
    post_id: int,
    reply: ForumReplyCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):

    cursor = db.cursor()

    cursor.execute(
        """
        SELECT post_id
        FROM forum_posts
        WHERE post_id = %s
        """,
        (post_id,)
    )

    existing_post = cursor.fetchone()

    if existing_post is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Forum post not found"
        )

    user_id = current_user["user_id"]

    sql = """
        INSERT INTO forum_replies
        (
            reply_text,
            post_id,
            user_id
        )
        VALUES (%s, %s, %s)
    """

    values = (
        reply.reply_text,
        post_id,
        user_id
    )

    cursor.execute(sql, values)

    db.commit()

    reply_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "Reply added successfully",
        "reply_id": reply_id,
        "post_id": post_id
    }


# PUBLIC
@app.get("/forum/posts/{post_id}/replies")
def get_forum_replies(
    post_id: int,
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT post_id
        FROM forum_posts
        WHERE post_id = %s
        """,
        (post_id,)
    )

    existing_post = cursor.fetchone()

    if existing_post is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Forum post not found"
        )

    sql = """
        SELECT
            fr.reply_id,
            fr.reply_text,
            fr.created_at,
            fr.post_id,
            fr.user_id,

            u.name AS user_name

        FROM forum_replies fr

        JOIN users u
            ON fr.user_id = u.user_id

        WHERE fr.post_id = %s

        ORDER BY fr.created_at
    """

    cursor.execute(
        sql,
        (post_id,)
    )

    replies = cursor.fetchall()

    cursor.close()

    return replies


# =========================================================
# RATINGS
# =========================================================

# LOGGED-IN USER
@app.post(
    "/feedback/ratings",
    status_code=status.HTTP_201_CREATED
)
def create_rating(
    rating: RatingCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):

    cursor = db.cursor()

    # Exactly one target
    selected_targets = sum([
        rating.transport_id is not None,
        rating.company_id is not None,
        rating.route_id is not None
    ])

    if selected_targets != 1:

        cursor.close()

        raise HTTPException(
            status_code=400,
            detail=(
                "Select exactly one target: "
                "transport, company, or route"
            )
        )

    # Rating must be 1-5
    if (
        rating.rating_value < 1
        or rating.rating_value > 5
    ):

        cursor.close()

        raise HTTPException(
            status_code=400,
            detail="Rating must be between 1 and 5"
        )

    # Check selected target
    if rating.transport_id is not None:

        cursor.execute(
            """
            SELECT transport_id
            FROM transport
            WHERE transport_id = %s
            """,
            (rating.transport_id,)
        )

    elif rating.company_id is not None:

        cursor.execute(
            """
            SELECT company_id
            FROM companies
            WHERE company_id = %s
            """,
            (rating.company_id,)
        )

    else:

        cursor.execute(
            """
            SELECT route_id
            FROM routes
            WHERE route_id = %s
            """,
            (rating.route_id,)
        )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Feedback target not found"
        )

    user_id = current_user["user_id"]

    sql = """
        INSERT INTO feedback
        (
            comment,
            feedback_type,
            rating_value,
            complaint_category,
            status,
            user_id,
            transport_id,
            company_id,
            route_id
        )
        VALUES (
            %s,
            'RATING',
            %s,
            NULL,
            NULL,
            %s,
            %s,
            %s,
            %s
        )
    """

    values = (
        rating.comment,
        rating.rating_value,
        user_id,
        rating.transport_id,
        rating.company_id,
        rating.route_id
    )

    cursor.execute(sql, values)

    db.commit()

    feedback_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "Rating submitted successfully",
        "feedback_id": feedback_id
    }


# PUBLIC
@app.get("/feedback/ratings")
def get_ratings(
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT
            f.feedback_id,
            f.comment,
            f.rating_value,
            f.created_at,
            f.user_id,

            u.name AS user_name,

            f.transport_id,
            f.company_id,
            f.route_id

        FROM feedback f

        JOIN users u
            ON f.user_id = u.user_id

        WHERE f.feedback_type = 'RATING'

        ORDER BY f.created_at DESC
    """

    cursor.execute(sql)

    ratings = cursor.fetchall()

    cursor.close()

    return ratings


# =========================================================
# COMPLAINTS
# =========================================================

# LOGGED-IN USER
@app.post(
    "/feedback/complaints",
    status_code=status.HTTP_201_CREATED
)
def create_complaint(
    complaint: ComplaintCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):

    cursor = db.cursor()

    selected_targets = sum([
        complaint.transport_id is not None,
        complaint.company_id is not None,
        complaint.route_id is not None
    ])

    if selected_targets != 1:

        cursor.close()

        raise HTTPException(
            status_code=400,
            detail=(
                "Select exactly one target: "
                "transport, company, or route"
            )
        )

    # Check selected target
    if complaint.transport_id is not None:

        cursor.execute(
            """
            SELECT transport_id
            FROM transport
            WHERE transport_id = %s
            """,
            (complaint.transport_id,)
        )

    elif complaint.company_id is not None:

        cursor.execute(
            """
            SELECT company_id
            FROM companies
            WHERE company_id = %s
            """,
            (complaint.company_id,)
        )

    else:

        cursor.execute(
            """
            SELECT route_id
            FROM routes
            WHERE route_id = %s
            """,
            (complaint.route_id,)
        )

    if cursor.fetchone() is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Feedback target not found"
        )

    user_id = current_user["user_id"]

    sql = """
        INSERT INTO feedback
        (
            comment,
            feedback_type,
            rating_value,
            complaint_category,
            status,
            user_id,
            transport_id,
            company_id,
            route_id
        )
        VALUES (
            %s,
            'COMPLAINT',
            NULL,
            %s,
            'SUBMITTED',
            %s,
            %s,
            %s,
            %s
        )
    """

    values = (
        complaint.comment,
        complaint.complaint_category,
        user_id,
        complaint.transport_id,
        complaint.company_id,
        complaint.route_id
    )

    cursor.execute(sql, values)

    db.commit()

    feedback_id = cursor.lastrowid

    cursor.close()

    return {
        "message": "Complaint submitted successfully",
        "feedback_id": feedback_id,
        "status": "SUBMITTED"
    }


# ADMIN ONLY
@app.get("/feedback")
def get_feedback(
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT
            f.feedback_id,
            f.comment,
            f.feedback_type,
            f.rating_value,
            f.complaint_category,
            f.status,
            f.created_at,
            f.user_id,

            u.name AS user_name,

            f.transport_id,
            f.company_id,
            f.route_id

        FROM feedback f

        JOIN users u
            ON f.user_id = u.user_id

        ORDER BY f.created_at DESC
    """

    cursor.execute(sql)

    feedback = cursor.fetchall()

    cursor.close()

    return feedback


# ADMIN ONLY
@app.get("/feedback/complaints")
def get_complaints(
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor(dictionary=True)

    sql = """
        SELECT
            f.feedback_id,
            f.comment,
            f.complaint_category,
            f.status,
            f.created_at,
            f.user_id,

            u.name AS user_name,

            f.transport_id,
            f.company_id,
            f.route_id

        FROM feedback f

        JOIN users u
            ON f.user_id = u.user_id

        WHERE f.feedback_type = 'COMPLAINT'

        ORDER BY f.created_at DESC
    """

    cursor.execute(sql)

    complaints = cursor.fetchall()

    cursor.close()

    return complaints


# ADMIN ONLY
@app.patch("/feedback/complaints/{feedback_id}/status")
def update_complaint_status(
    feedback_id: int,
    status_update: ComplaintStatusUpdate,
    admin_user=Depends(require_admin),
    db=Depends(get_db)
):

    cursor = db.cursor()

    allowed_statuses = [
        "SUBMITTED",
        "IN_PROGRESS",
        "VERIFIED"
    ]

    if status_update.status not in allowed_statuses:

        cursor.close()

        raise HTTPException(
            status_code=400,
            detail=(
                "Status must be SUBMITTED, "
                "IN_PROGRESS, or VERIFIED"
            )
        )

    cursor.execute(
        """
        SELECT feedback_id
        FROM feedback
        WHERE feedback_id = %s
        AND feedback_type = 'COMPLAINT'
        """,
        (feedback_id,)
    )

    complaint = cursor.fetchone()

    if complaint is None:

        cursor.close()

        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    cursor.execute(
        """
        UPDATE feedback
        SET status = %s
        WHERE feedback_id = %s
        """,
        (
            status_update.status,
            feedback_id
        )
    )

    db.commit()

    cursor.close()

    return {
        "message": "Complaint status updated successfully",
        "feedback_id": feedback_id,
        "status": status_update.status
    }