from pydantic import BaseModel


# =========================
# TRANSPORT
# =========================

class TransportCreate(BaseModel):
    transport_type: str
    transport_number: str
    capacity: int | None = None
    company_id: int | None = None


# =========================
# STOPS
# =========================

class StopCreate(BaseModel):
    stop_name: str
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None


# =========================
# ROUTES
# =========================

class RouteCreate(BaseModel):
    route_name: str
    route_number: str | None = None


class RouteStopCreate(BaseModel):
    stop_id: int
    stop_sequence: int
    distance_from_previous: float | None = None


# =========================
# USERS / AUTH
# =========================

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    phone: str | None = None


class UserUpdate(BaseModel):
    name: str
    email: str
    phone: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


# =========================
# STUDENT VERIFICATION
# =========================

class StudentVerificationCreate(BaseModel):
    student_id_number: str
    institution_name: str
    id_card_url: str | None = None


# =========================
# FARES
# =========================

class FareCreate(BaseModel):
    transport_type: str
    standard_fare: float
    student_fare: float | None = None
    origin_stop_id: int
    destination_stop_id: int


# =========================
# FARE TRACKER
# =========================

class FareLogCreate(BaseModel):
    amount_paid: float
    transport_type: str
    origin_stop_id: int
    destination_stop_id: int


# =========================
# FORUM
# =========================

class ForumPostCreate(BaseModel):
    title: str
    description: str


class ForumReplyCreate(BaseModel):
    reply_text: str


# =========================
# FEEDBACK
# =========================

class RatingCreate(BaseModel):
    comment: str
    rating_value: int
    transport_id: int | None = None
    company_id: int | None = None
    route_id: int | None = None


class ComplaintCreate(BaseModel):
    comment: str
    complaint_category: str
    transport_id: int | None = None
    company_id: int | None = None
    route_id: int | None = None


class ComplaintStatusUpdate(BaseModel):
    status: str