from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import SQLModel, Field, Session, create_engine, select
from typing import Optional, List
from datetime import datetime
from pathlib import Path
import smtplib
from email.mime.text import MIMEText
import os

# ---------------------- Database setup ----------------------
DB_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_URL = f"sqlite:///{os.path.join(DB_DIR, 'ogr.db')}"
engine = create_engine(DB_URL, echo=False)
UPLOAD_DIR = Path(DB_DIR) / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------- Models ----------------------
class Grievance(SQLModel, table=True):
    id: str = Field(primary_key=True)
    created_at: datetime
    updated_at: datetime

    status: str = Field(default="Submitted", index=True)
    notes: str = Field(default="")

    student_name: str
    student_email: str
    department: str = Field(index=True)
    category: str = Field(index=True)
    subject: str
    description: str


# ---------------------- Schemas ----------------------
class GrievanceCreate(BaseModel):
    student_name: str
    student_email: str
    department: str
    category: str
    subject: str
    description: str

class GrievanceUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None

"""
Using the SQLModel model `Grievance` as the response model to keep compatibility
with Pydantic v2 without extra response schemas.
"""


# ---------------------- App Init ----------------------
app = FastAPI(title="Online Grievance Redressal API", version="0.1.0")

origins = [
    "http://localhost",
    "http://localhost:8080",
    "http://127.0.0.1",
    "http://127.0.0.1:8080",
    "*"  # dev-only; tighten for prod
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------- Meta ----------------------
DEFAULT_DEPARTMENTS = [
    "Computer Science", "Electronics", "Mechanical", "Civil", "Management", "Humanities",
    "MCA", "MBA", "AI&DS", "CSBS", "AI&ML"
]
DEFAULT_CATEGORIES = [
    "Academic", "Examination", "Infrastructure", "Hostel", "Transportation", "Finance", "Other"
]


def init_db():
    SQLModel.metadata.create_all(engine)


def generate_ticket_id(session: Session) -> str:
    # Count existing records for the day to generate a sequence
    today = datetime.now()
    y, m, d = today.year, today.month, today.day
    start = datetime(y, m, d)
    end = datetime(y, m, d, 23, 59, 59)
    stmt = select(Grievance).where(Grievance.created_at >= start, Grievance.created_at <= end)
    todays_count = len(session.exec(stmt).all()) + 1
    return f"GRV-{y}{m:02d}{d:02d}-{todays_count:04d}"


@app.on_event("startup")
def on_startup():
    init_db()


# ---------------------- Routes ----------------------
@app.get("/meta")
def read_meta():
    return {"departments": DEFAULT_DEPARTMENTS, "categories": DEFAULT_CATEGORIES}


@app.post("/grievances", response_model=Grievance)
def create_grievance(payload: GrievanceCreate):
    now = datetime.utcnow()
    with Session(engine) as session:
        gid = generate_ticket_id(session)
        g = Grievance(
            id=gid,
            created_at=now,
            updated_at=now,
            status="Submitted",
            notes="",
            student_name=payload.student_name,
            student_email=payload.student_email,
            department=payload.department,
            category=payload.category,
            subject=payload.subject,
            description=payload.description,
        )
        session.add(g)
        session.commit()
        session.refresh(g)
        # send email notification (best-effort)
        try:
            send_email(
                to_addr=g.student_email,
                subject=f"Grievance Submitted: {g.id}",
                body=(
                    f"Dear {g.student_name},\n\nYour grievance has been submitted successfully.\n"
                    f"Ticket ID: {g.id}\nSubject: {g.subject}\nStatus: {g.status}\n\n"
                    f"We will keep you updated on progress.\n\nRegards,\nOGR Team"
                ),
            )
            admin_rcpt = os.getenv("OGR_ADMIN_EMAIL")
            if admin_rcpt:
                send_email(
                    to_addr=admin_rcpt,
                    subject=f"New Grievance: {g.id}",
                    body=(
                        f"New grievance submitted.\n\nID: {g.id}\nStudent: {g.student_name} <{g.student_email}>\n"
                        f"Dept: {g.department}\nCategory: {g.category}\nSubject: {g.subject}\n"
                        f"Description:\n{g.description}\n"
                    ),
                )
        except Exception:
            # ignore email errors in demo
            pass
        return g


@app.put("/grievances/{gid}", response_model=Grievance)
def upsert_grievance(gid: str, payload: GrievanceCreate):
    """Create the grievance with a specific ID if it doesn't exist, or update core
    fields if it exists. Useful for syncing local-only tickets to the backend."""
    now = datetime.utcnow()
    with Session(engine) as session:
        existing = session.get(Grievance, gid)
        if existing:
            # update core fields only
            existing.student_name = payload.student_name
            existing.student_email = payload.student_email
            existing.department = payload.department
            existing.category = payload.category
            existing.subject = payload.subject
            existing.description = payload.description
            existing.updated_at = now
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing
        # create new with provided id
        g = Grievance(
            id=gid,
            created_at=now,
            updated_at=now,
            status="Submitted",
            notes="",
            student_name=payload.student_name,
            student_email=payload.student_email,
            department=payload.department,
            category=payload.category,
            subject=payload.subject,
            description=payload.description,
        )
        session.add(g)
        session.commit()
        session.refresh(g)
        return g


@app.get("/grievances/{gid}", response_model=Grievance)
def get_grievance(gid: str):
    with Session(engine) as session:
        g = session.get(Grievance, gid)
        if not g:
            raise HTTPException(status_code=404, detail="Grievance not found")
        return g


@app.get("/grievances", response_model=List[Grievance])
def list_grievances(
    status: Optional[str] = None,
    department: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
):
    with Session(engine) as session:
        stmt = select(Grievance)
        if status:
            stmt = stmt.where(Grievance.status == status)
        if department:
            stmt = stmt.where(Grievance.department == department)
        if category:
            stmt = stmt.where(Grievance.category == category)
        results = session.exec(stmt).all()
        if q:
            low = q.lower()
            results = [
                r for r in results
                if low in (r.subject or '').lower() or low in (r.description or '').lower()
            ]
        # order by updated_at desc
        results.sort(key=lambda r: r.updated_at, reverse=True)
        return results


@app.patch("/grievances/{gid}", response_model=Grievance)
def update_grievance(gid: str, patch: GrievanceUpdate):
    with Session(engine) as session:
        g = session.get(Grievance, gid)
        if not g:
            raise HTTPException(status_code=404, detail="Grievance not found")
        data = patch.dict(exclude_unset=True)
        for k, v in data.items():
            setattr(g, k, v)
        g.updated_at = datetime.utcnow()
        session.add(g)
        session.commit()
        session.refresh(g)
        # send email notification (best-effort)
        try:
            send_email(
                to_addr=g.student_email,
                subject=f"Grievance Updated: {g.id}",
                body=(
                    f"Dear {g.student_name},\n\nYour grievance status has been updated.\n"
                    f"Ticket ID: {g.id}\nStatus: {g.status}\nNotes: {g.notes or '-'}\n\nRegards,\nOGR Team"
                ),
            )
        except Exception:
            pass
        return g


@app.get("/export")
def export_data():
    with Session(engine) as session:
        results = session.exec(select(Grievance)).all()
        return {
            "meta": {
                "departments": DEFAULT_DEPARTMENTS,
                "categories": DEFAULT_CATEGORIES,
            },
            "grievances": results,
        }


# Health
@app.get("/")
def root():
    return {"ok": True, "name": "OGR API", "version": "0.1.0"}


# ---------------------- Attachments ----------------------
def grievance_upload_dir(gid: str) -> Path:
    d = UPLOAD_DIR / gid
    d.mkdir(parents=True, exist_ok=True)
    return d


@app.post("/grievances/{gid}/attachments")
def upload_attachment(gid: str, file: UploadFile = File(...)):
    with Session(engine) as session:
        g = session.get(Grievance, gid)
        if not g:
            raise HTTPException(status_code=404, detail="Grievance not found")
    safe_name = Path(file.filename).name
    # ensure unique name
    target_dir = grievance_upload_dir(gid)
    target_path = target_dir / safe_name
    i = 1
    while target_path.exists():
        stem = Path(safe_name).stem
        ext = Path(safe_name).suffix
        target_path = target_dir / f"{stem}({i}){ext}"
        i += 1
    with target_path.open("wb") as f:
        f.write(file.file.read())
    return {"filename": target_path.name, "size": target_path.stat().st_size}


@app.get("/grievances/{gid}/attachments")
def list_attachments(gid: str):
    with Session(engine) as session:
        g = session.get(Grievance, gid)
        if not g:
            raise HTTPException(status_code=404, detail="Grievance not found")
    d = grievance_upload_dir(gid)
    files = []
    for p in sorted(d.glob("*")):
        if p.is_file():
            files.append({
                "filename": p.name,
                "size": p.stat().st_size,
                "modified_at": datetime.fromtimestamp(p.stat().st_mtime).isoformat()
            })
    return files


@app.get("/grievances/{gid}/attachments/{filename}")
def download_attachment(gid: str, filename: str):
    path = grievance_upload_dir(gid) / Path(filename).name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


# ---------------------- Email helper ----------------------
def send_email(to_addr: str, subject: str, body: str) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT" , "587"))
    user = os.getenv("SMTP_USER")
    pwd  = os.getenv("SMTP_PASS")
    sender = os.getenv("SMTP_FROM", user or "noreply@example.com")
    use_tls = os.getenv("SMTP_TLS", "true").lower() in ("1","true","yes","on")
    if not host or not to_addr:
        return
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_addr
    if use_tls:
        server = smtplib.SMTP(host, port)
        server.starttls()
    else:
        server = smtplib.SMTP(host, port)
    if user and pwd:
        server.login(user, pwd)
    server.sendmail(sender, [to_addr], msg.as_string())
    server.quit()
