from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Book, BookWord, Unit, User, Word
from ..schemas import BookIn, UnitIn, WordIn
from ..serialize import word_dict

router = APIRouter(prefix="/api/admin/content", tags=["content"])


def _word_counts_by_unit(db: Session, book_id: int) -> dict[int, int]:
    counts: dict[int, int] = {}
    for bw in db.query(BookWord).filter(BookWord.book_id == book_id):
        counts[bw.unit_id] = counts.get(bw.unit_id, 0) + 1
    return counts


def _book_dict(db: Session, b: Book) -> dict:
    units = db.query(Unit).filter(Unit.book_id == b.id).order_by(Unit.order_no, Unit.id).all()
    counts = _word_counts_by_unit(db, b.id)
    return {
        "id": b.id,
        "name": b.name,
        "subtitle": b.subtitle,
        "stage": b.stage,
        "word_count": sum(counts.values()),
        "units": [
            {"id": u.id, "name": u.name, "word_count": counts.get(u.id, 0)}
            for u in units
        ],
    }


@router.get("")
def list_content(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    books = db.query(Book).order_by(Book.id).all()
    db.commit()
    return [_book_dict(db, b) for b in books]


@router.post("/books")
def create_book(body: BookIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    book = Book(name=body.name, subtitle=body.subtitle, stage=body.stage)
    db.add(book)
    db.commit()
    db.refresh(book)
    return _book_dict(db, book)


@router.patch("/books/{book_id}")
def update_book(book_id: int, body: BookIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="书不存在")
    book.name = body.name
    book.subtitle = body.subtitle
    book.stage = body.stage
    db.commit()
    return _book_dict(db, book)


@router.delete("/books/{book_id}")
def delete_book(book_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="书不存在")
    db.query(BookWord).filter(BookWord.book_id == book_id).delete()
    db.query(Unit).filter(Unit.book_id == book_id).delete()
    db.query(User).filter(User.current_book_id == book_id).update({"current_book_id": None})
    db.delete(book)
    db.commit()
    return {"ok": True}


@router.post("/books/{book_id}/units")
def create_unit(book_id: int, body: UnitIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="书不存在")
    last = db.query(Unit).filter(Unit.book_id == book_id).order_by(Unit.order_no.desc()).first()
    unit = Unit(book_id=book_id, name=body.name, order_no=(last.order_no + 1) if last else 1)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return {"id": unit.id, "name": unit.name, "word_count": 0}


@router.patch("/units/{unit_id}")
def update_unit(unit_id: int, body: UnitIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="单元不存在")
    unit.name = body.name
    db.commit()
    return {"ok": True}


@router.delete("/units/{unit_id}")
def delete_unit(unit_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="单元不存在")
    db.query(BookWord).filter(BookWord.unit_id == unit_id).delete()
    db.delete(unit)
    db.commit()
    return {"ok": True}


@router.get("/units/{unit_id}/words")
def unit_words(unit_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="单元不存在")
    bws = (
        db.query(BookWord, Word)
        .join(Word, Word.id == BookWord.word_id)
        .filter(BookWord.unit_id == unit_id)
        .order_by(BookWord.order_no, BookWord.id)
        .all()
    )
    db.commit()
    return [word_dict(w) for _, w in bws]


def _upsert_word(db: Session, body: WordIn, word: Word | None) -> Word:
    data = body.model_dump()
    if word is None:
        word = Word()
        db.add(word)
    word.text = data["text"].strip().lower()
    for k in ("phonetic", "pos", "meaning", "example", "example_cn", "tip"):
        setattr(word, k, data.get(k) or "")
    db.flush()
    return word


@router.post("/units/{unit_id}/words")
def add_word(unit_id: int, body: WordIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="单元不存在")
    text = body.text.strip().lower()
    word = db.query(Word).filter(Word.text == text).first()
    exists = (
        db.query(BookWord)
        .filter(BookWord.unit_id == unit_id, BookWord.word_id == (word.id if word else -1))
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail=f"{text} 已经在这个单元里了")
    word = _upsert_word(db, body, word)
    last = (
        db.query(BookWord)
        .filter(BookWord.unit_id == unit_id)
        .order_by(BookWord.order_no.desc())
        .first()
    )
    db.add(
        BookWord(
            book_id=unit.book_id,
            unit_id=unit_id,
            word_id=word.id,
            order_no=(last.order_no + 1) if last else 1,
        )
    )
    db.commit()
    return word_dict(word)


@router.patch("/words/{word_id}")
def update_word(word_id: int, body: WordIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    word = db.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")
    _upsert_word(db, body, word)
    db.commit()
    return word_dict(word)


@router.delete("/units/{unit_id}/words/{word_id}")
def remove_word(unit_id: int, word_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    bw = (
        db.query(BookWord)
        .filter(BookWord.unit_id == unit_id, BookWord.word_id == word_id)
        .first()
    )
    if not bw:
        raise HTTPException(status_code=404, detail="这个单元里没有该单词")
    db.delete(bw)
    db.commit()
    return {"ok": True}
