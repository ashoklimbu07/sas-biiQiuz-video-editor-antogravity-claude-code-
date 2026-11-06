"""ui_cards.py — premium biiQuiz UI cards (PNG, transparent, 2x supersampled) for kinetic `image` / `tiles` items.

    python engine/ui_cards.py <out_dir> [name ...]      # no names = render all

Style follows the biiQuiz institute-admin dashboard (white rounded cards, hairline border, soft shadow,
navy/indigo active pill, Inter-like Segoe UI type). Latin text only: Pillow on this PC can't shape Devanagari,
so Nepali words stay native CapCut text in the plan.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 2  # supersample
F = "C:/Windows/Fonts/"
NAVY, INK, MUTED, LINE = (17, 19, 57), (17, 19, 57), (100, 106, 130), (226, 229, 240)
PRIMARY, ELECTRIC, LAV = (53, 37, 205), (40, 46, 254), (143, 123, 255)
GREEN, WARM, GOLD, SILVER, BRONZE = (34, 197, 94), (255, 122, 69), (245, 184, 40), (170, 178, 196), (205, 127, 70)


def font(w, size):
    name = {"r": "segoeui.ttf", "sb": "seguisb.ttf", "b": "segoeuib.ttf", "bl": "seguibl.ttf"}[w]
    return ImageFont.truetype(F + name, int(size * S))


class Card:
    def __init__(self, w, h, pad=26, radius=34, shadow=True):
        self.w, self.h, self.pad = w, h, pad
        W, H = (w + 2 * pad) * S, (h + 2 * pad) * S
        self.im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        if shadow:
            sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(sh).rounded_rectangle(self.box(0, 10, w, h + 10), radius * S, fill=(40, 40, 120, 60))
            self.im = Image.alpha_composite(self.im, sh.filter(ImageFilter.GaussianBlur(16 * S)))
        self.d = ImageDraw.Draw(self.im)
        self.d.rounded_rectangle(self.box(0, 0, w, h), radius * S, fill=(255, 255, 255, 255), outline=LINE, width=2 * S)

    def box(self, x0, y0, x1, y1):
        p = self.pad
        return [(x0 + p) * S, (y0 + p) * S, (x1 + p) * S, (y1 + p) * S]

    def xy(self, x, y):
        return ((x + self.pad) * S, (y + self.pad) * S)

    def rrect(self, x0, y0, x1, y1, r, **kw):
        if "width" in kw: kw["width"] *= S
        self.d.rounded_rectangle(self.box(x0, y0, x1, y1), r * S, **kw)

    def ell(self, x0, y0, x1, y1, **kw):
        if "width" in kw: kw["width"] *= S
        self.d.ellipse(self.box(x0, y0, x1, y1), **kw)

    def line(self, pts, fill, width):
        self.d.line([self.xy(x, y) for x, y in pts], fill=fill, width=width * S, joint="curve")

    def text(self, x, y, s, f, fill=INK, anchor="la"):
        self.d.text(self.xy(x, y), s, font=f, fill=fill, anchor=anchor)

    def grad_rrect(self, x0, y0, x1, y1, r, c0=ELECTRIC, c1=LAV):
        bx = self.box(x0, y0, x1, y1)
        gw, gh = int(bx[2] - bx[0]), int(bx[3] - bx[1])
        g = Image.new("RGBA", (gw, gh))
        gd = ImageDraw.Draw(g)
        for i in range(gw):
            t = i / max(1, gw - 1)
            gd.line([(i, 0), (i, gh)], fill=tuple(int(c0[j] + (c1[j] - c0[j]) * t) for j in range(3)) + (255,))
        m = Image.new("L", (gw, gh), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, gw - 1, gh - 1], r * S, fill=255)
        self.im.paste(g, (int(bx[0]), int(bx[1])), m)
        self.d = ImageDraw.Draw(self.im)

    def check(self, cx, cy, r, col=GREEN):
        self.ell(cx - r, cy - r, cx + r, cy + r, fill=col)
        self.line([(cx - r * .45, cy + r * .02), (cx - r * .1, cy + r * .38), (cx + r * .5, cy - r * .35)], (255, 255, 255), max(3, int(r * .28)))

    def save(self, path):
        self.im.resize((self.im.width // S, self.im.height // S), Image.LANCZOS).save(path)


def tile(kind):
    """240x240 glossy app tile with an emblem."""
    c = Card(200, 200, pad=20, radius=46)
    if kind == "excel":
        c.rrect(42, 36, 158, 164, 14, fill=(232, 247, 238), outline=(33, 163, 102), width=4)
        for i in range(1, 4): c.line([(42, 36 + i * 32), (158, 36 + i * 32)], (33, 163, 102), 2)
        c.line([(84, 36), (84, 164)], (33, 163, 102), 2)
        c.rrect(22, 60, 92, 130, 12, fill=(33, 163, 102))
        c.text(57, 95, "X", font("bl", 46), (255, 255, 255), "mm")
    elif kind == "paper":
        c.rrect(52, 28, 148, 172, 10, fill=(255, 255, 255), outline=(190, 196, 215), width=3)
        for i in range(5): c.line([(66, 62 + i * 18), (134 - (i % 2) * 22, 62 + i * 18)], (200, 205, 222), 5)
        c.text(66, 38, "TEST", font("b", 14), MUTED)
        c.ell(112, 120, 172, 180, fill=(239, 68, 68))
        c.text(142, 150, "32", font("bl", 24), (255, 255, 255), "mm")
    elif kind == "calc":
        c.rrect(56, 26, 144, 174, 16, fill=(41, 43, 77))
        c.rrect(66, 38, 134, 70, 6, fill=(198, 240, 226))
        c.text(128, 54, "1,240", font("b", 16), NAVY, "rm")
        for r in range(3):
            for q in range(3):
                col = WARM if (q == 2 and r == 2) else (90, 94, 140)
                c.rrect(68 + q * 23, 82 + r * 28, 86 + q * 23, 102 + r * 28, 5, fill=col)
    elif kind == "notebook":
        c.rrect(50, 28, 150, 172, 12, fill=(255, 216, 200), outline=(230, 150, 110), width=3)
        for i in range(7): c.ell(42, 40 + i * 19, 58, 52 + i * 19, outline=(120, 120, 140), width=3)
        c.text(100, 72, "FEES", font("bl", 18), (190, 80, 40), "mm")
        for i in range(3): c.line([(70, 104 + i * 20), (134, 104 + i * 20)], (220, 140, 100), 4)
    return c


def upload_students():
    c = Card(860, 330)
    c.grad_rrect(30, 30, 104, 104, 22)
    c.line([(67, 84), (67, 50)], (255, 255, 255), 6); c.line([(52, 64), (67, 49), (82, 64)], (255, 255, 255), 6)
    c.text(126, 40, "Import Students", font("b", 30))
    c.text(126, 80, "Upload Excel / CSV — add everyone at once", font("r", 20), MUTED)
    c.rrect(30, 132, 830, 300, 22, fill=(246, 247, 255), outline=(190, 186, 255), width=3)
    c.rrect(56, 160, 128, 232, 14, fill=(33, 163, 102)); c.text(92, 196, "X", font("bl", 40), (255, 255, 255), "mm")
    c.text(150, 166, "students_2083.xlsx", font("sb", 26))
    c.text(150, 204, "312 rows  ·  Name, Phone, Batch, Class", font("r", 19), MUTED)
    c.rrect(56, 252, 804, 270, 9, fill=(225, 227, 245))
    c.grad_rrect(56, 252, 804, 270, 9)
    c.check(790, 192, 22)
    return c


def batch_chips():
    labels = [("Batch A", PRIMARY), ("Batch B", ELECTRIC), ("IOE Entrance", LAV), ("LLM Entrance", WARM)]
    f = font("b", 24)
    ws = [int(f.getlength(t) / S) + 56 for t, _ in labels]
    total = sum(ws) + 18 * (len(ws) - 1)
    c = Card(total + 40, 92, radius=46)
    x = 20
    for (t, col), w in zip(labels, ws):
        light = tuple(int(255 - (255 - v) * .14) for v in col)
        c.rrect(x, 18, x + w, 74, 28, fill=light, outline=col, width=2)
        c.text(x + w / 2, 46, t, f, col, "mm")
        x += w + 18
    return c


def question_card():
    c = Card(860, 470)
    c.rrect(30, 28, 196, 70, 21, fill=(237, 235, 255)); c.text(113, 49, "Question 12", font("b", 20), PRIMARY, "mm")
    c.rrect(700, 28, 830, 70, 21, fill=(232, 247, 238)); c.text(765, 49, "+1 mark", font("b", 19), (22, 140, 70), "mm")
    c.text(30, 92, "What is  12 + 3 × 4 ?", font("b", 34))
    opts = [("A", "60"), ("B", "24"), ("C", "48"), ("D", "19")]
    for i, (k, v) in enumerate(opts):
        y = 158 + i * 74
        ok = k == "B"
        c.rrect(30, y, 830, y + 60, 18, fill=(236, 252, 243) if ok else (248, 249, 252), outline=GREEN if ok else LINE, width=3 if ok else 2)
        c.ell(46, y + 12, 82, y + 48, fill=GREEN if ok else (255, 255, 255), outline=GREEN if ok else (200, 204, 220), width=2)
        c.text(64, y + 30, k, font("b", 18), (255, 255, 255) if ok else MUTED, "mm")
        c.text(102, y + 30, v, font("sb", 24), INK, "lm")
        if ok: c.check(800, y + 30, 16)
    return c


def import_file():
    c = Card(860, 230)
    c.rrect(26, 24, 834, 206, 24, fill=(246, 247, 255), outline=(190, 186, 255), width=3)
    c.grad_rrect(56, 60, 140, 144, 26)
    c.line([(98, 128), (98, 80)], (255, 255, 255), 7); c.line([(78, 98), (98, 78), (118, 98)], (255, 255, 255), 7)
    c.text(166, 62, "Import questions from file", font("b", 28))
    x = 166
    for t, col in [("XLSX", (33, 163, 102)), ("DOCX", (43, 87, 214)), ("PDF", (220, 53, 69)), ("CSV", (100, 106, 130))]:
        w = int(font("b", 18).getlength(t) / S) + 34
        c.rrect(x, 116, x + w, 156, 12, fill=col); c.text(x + w / 2, 136, t, font("b", 18), (255, 255, 255), "mm")
        x += w + 14
    c.text(x + 10, 136, "120 questions", font("sb", 20), MUTED, "lm")
    return c


def calendar():
    c = Card(560, 470)
    c.text(30, 30, "December 2026", font("b", 28))
    c.rrect(410, 26, 530, 66, 20, fill=(237, 235, 255)); c.text(470, 46, "Exam", font("b", 19), PRIMARY, "mm")
    days = "SMTWTFS"
    for i, ch in enumerate(days): c.text(56 + i * 74, 104, ch, font("sb", 18), MUTED, "mm")
    start, n = 2, 31  # Dec 1 2026 = Tuesday
    for d in range(1, n + 1):
        p = start + d - 1
        r, q = divmod(p, 7)
        cx, cy = 56 + q * 74, 150 + r * 52
        if d == 20:
            c.grad_rrect(cx - 26, cy - 22, cx + 26, cy + 22, 16)
            c.text(cx, cy, str(d), font("b", 20), (255, 255, 255), "mm")
        else:
            c.text(cx, cy, str(d), font("sb", 19), INK if q else (200, 80, 80), "mm")
    c.rrect(30, 420, 530, 456, 14, fill=(246, 247, 255)); c.text(280, 438, "Sun, 20 Dec  ·  10:00 AM  ·  60 min", font("sb", 18), NAVY, "mm")
    return c


def leaderboard():
    c = Card(860, 400)
    c.text(30, 28, "Leaderboard", font("b", 30))
    c.rrect(700, 28, 830, 68, 20, fill=(232, 247, 238)); c.text(765, 48, "LIVE", font("b", 18), (22, 140, 70), "mm")
    rows = [("Aarav Shrestha", "98%", GOLD), ("Sita Karki", "95%", SILVER), ("Rohan Thapa", "92%", BRONZE)]
    for i, (nm, sc, col) in enumerate(rows):
        y = 92 + i * 98
        c.rrect(30, y, 830, y + 82, 22, fill=(250, 250, 255) if i else (255, 248, 230), outline=LINE, width=2)
        c.ell(48, y + 15, 100, y + 67, fill=col); c.text(74, y + 41, str(i + 1), font("bl", 24), (255, 255, 255), "mm")
        c.ell(118, y + 17, 166, y + 65, fill=(222, 220, 255)); c.text(142, y + 41, nm[0], font("b", 22), PRIMARY, "mm")
        c.text(186, y + 41, nm, font("sb", 25), INK, "lm")
        c.rrect(600, y + 33, 730, y + 49, 8, fill=(232, 233, 245))
        c.grad_rrect(600, y + 33, 600 + int(130 * (0.98 - i * .04)), y + 49, 8)
        c.text(806, y + 41, sc, font("b", 25), PRIMARY, "rm")
    return c


def billing():
    """After the user's Billing & Payments screen: tab pills + 4 stat cards (with real-looking numbers)."""
    c = Card(880, 420)
    x = 26
    for i, t in enumerate(["Overview", "Fee Setup", "Bills", "Receipts"]):
        f = font("sb", 20); w = int(f.getlength(t) / S) + 40
        if i == 0: c.rrect(x, 24, x + w, 68, 14, fill=(27, 38, 120))
        c.text(x + w / 2, 46, t, f, (255, 255, 255) if i == 0 else MUTED, "mm")
        x += w + 10
    stats = [("Outstanding", "NPR 1,24,500", INK), ("Collected today", "NPR 38,200", (22, 140, 70)),
             ("Posted receipts", "126", INK), ("Overdue", "9", (220, 53, 69))]
    for i, (lab, val, col) in enumerate(stats):
        r, q = divmod(i, 2)
        x0, y0 = 26 + q * 422, 96 + r * 156
        c.rrect(x0, y0, x0 + 406, y0 + 140, 20, fill=(255, 255, 255), outline=LINE, width=2)
        c.text(x0 + 24, y0 + 26, lab, font("sb", 20), MUTED)
        c.text(x0 + 24, y0 + 64, val, font("bl", 36), col)
    return c


def coming_soon():
    c = Card(860, 250)
    c.text(30, 28, "Take Attendance", font("b", 30))
    c.rrect(640, 26, 830, 70, 22, fill=WARM); c.text(735, 48, "COMING SOON", font("b", 18), (255, 255, 255), "mm")
    for i, (nm, st) in enumerate([("Aarav", "P"), ("Sita", "P"), ("Rohan", "A")]):
        x0 = 30 + i * 270
        c.rrect(x0, 104, x0 + 250, 214, 20, fill=(248, 249, 252), outline=LINE, width=2)
        c.ell(x0 + 20, 132, x0 + 74, 186, fill=(222, 220, 255)); c.text(x0 + 47, 159, nm[0], font("b", 22), PRIMARY, "mm")
        c.text(x0 + 90, 159, nm, font("sb", 23), INK, "lm")
        col = GREEN if st == "P" else (239, 68, 68)
        c.ell(x0 + 190, 139, x0 + 230, 179, fill=col); c.text(x0 + 210, 159, st, font("b", 18), (255, 255, 255), "mm")
    return c


def comment():
    c = Card(780, 170, radius=40)
    c.grad_rrect(30, 40, 120, 130, 45)
    c.text(75, 85, "You", font("b", 22), (255, 255, 255), "mm")
    c.text(146, 44, "@institute_nepal  ·  now", font("sb", 20), MUTED)
    c.text(146, 76, "DEMO", font("bl", 46), PRIMARY)
    c.text(740, 85, "\u2665", ImageFont.truetype(F + "seguisym.ttf", 40 * S), (239, 68, 68), "mm")
    return c


def _brand_contact():
    import json
    p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "brand", "biiquiz.json")
    return json.load(open(p, encoding="utf-8")).get("contact", {})


def _icon_facebook(c, x, y, r):
    c.ell(x - r, y - r, x + r, y + r, fill=(24, 119, 242))
    c.text(x + r * 0.08, y + r * 0.12, "f", font("bl", r * 1.45), (255, 255, 255), "mm")


def _icon_instagram(c, x, y, r):
    c.grad_rrect(x - r, y - r, x + r, y + r, r * 0.55, c0=(254, 160, 50), c1=(214, 41, 118))
    c.rrect(x - r * .58, y - r * .58, x + r * .58, y + r * .58, r * .32, outline=(255, 255, 255), width=max(2, int(r * .13)))
    c.ell(x - r * .26, y - r * .26, x + r * .26, y + r * .26, outline=(255, 255, 255), width=max(2, int(r * .13)))
    c.ell(x + r * .3, y - r * .44, x + r * .44, y - r * .3, fill=(255, 255, 255))


def _icon_tiktok(c, x, y, r):
    c.ell(x - r, y - r, x + r, y + r, fill=(17, 17, 17))
    f = ImageFont.truetype(F + "seguisym.ttf", int(r * 1.5 * S))
    c.text(x - r * .06, y + r * .02, "♪", f, (37, 244, 238), "mm")
    c.text(x + r * .06, y + r * .1, "♪", f, (254, 44, 85), "mm")
    c.text(x, y + r * .06, "♪", f, (255, 255, 255), "mm")


def _icon_globe(c, x, y, r):
    c.grad_rrect(x - r, y - r, x + r, y + r, r)
    w = max(2, int(r * .11))
    c.ell(x - r * .55, y - r * .55, x + r * .55, y + r * .55, outline=(255, 255, 255), width=w)
    c.ell(x - r * .24, y - r * .55, x + r * .24, y + r * .55, outline=(255, 255, 255), width=w)
    c.line([(x - r * .55, y), (x + r * .55, y)], (255, 255, 255), w)


def _icon_mail(c, x, y, r):
    c.ell(x - r, y - r, x + r, y + r, fill=WARM)
    w = max(2, int(r * .11))
    c.rrect(x - r * .55, y - r * .38, x + r * .55, y + r * .38, r * .1, outline=(255, 255, 255), width=w)
    c.line([(x - r * .52, y - r * .32), (x, y + r * .08), (x + r * .52, y - r * .32)], (255, 255, 255), w)


def _icon_whatsapp(c, x, y, r):
    c.ell(x - r, y - r, x + r, y + r, fill=(37, 211, 102))
    w = max(2, int(r * .12))
    c.ell(x - r * .55, y - r * .55, x + r * .55, y + r * .55, outline=(255, 255, 255), width=w)
    c.line([(x - r * .45, y + r * .35), (x - r * .62, y + r * .66), (x - r * .25, y + r * .52)], (255, 255, 255), w)
    f = ImageFont.truetype(F + "seguisym.ttf", int(r * .62 * S))
    c.text(x, y + r * .02, "☎", f, (255, 255, 255), "mm")


def social_bar():
    """White pill: FB / IG / TikTok icons + handles (brand/biiquiz.json -> contact.social)."""
    so = _brand_contact().get("social", {})
    items = [(_icon_facebook, so.get("facebook", "")), (_icon_instagram, so.get("instagram", "")), (_icon_tiktok, so.get("tiktok", ""))]
    f = font("sb", 29)
    r = 26
    ws = [2 * r + 12 + int(f.getlength(h) / S) for _, h in items]
    gap = 34
    W = sum(ws) + gap * (len(ws) - 1) + 56
    c = Card(W, 88, pad=22, radius=44)
    x = 28
    for (ic, h), w in zip(items, ws):
        ic(c, x + r, 44, r)
        c.text(x + 2 * r + 12, 44, h, f, NAVY, "lm")
        x += w + gap
    return c


def contact_card():
    """End card: website / email / WhatsApp rows (brand/biiquiz.json -> contact)."""
    ct = _brand_contact()
    rows = [(_icon_globe, ct.get("website", ""), "Website"), (_icon_mail, ct.get("email", ""), "Email"),
            (_icon_whatsapp, ct.get("whatsapp", ""), "WhatsApp")]
    c = Card(820, 330)
    for i, (ic, val, lab) in enumerate(rows):
        y0 = 22 + i * 102
        c.rrect(22, y0, 798, y0 + 88, 22, fill=(246, 247, 255) if i else (237, 235, 255), outline=LINE, width=2)
        ic(c, 74, y0 + 44, 28)
        c.text(124, y0 + 26, lab.upper(), font("b", 15), MUTED, "lm")
        c.text(124, y0 + 58, val, font("b", 30), PRIMARY if i == 0 else NAVY, "lm")
    return c


def contact_pill(kind):
    """One standalone contact element (no shared card): icon + small label + value."""
    ct = _brand_contact()
    ic, val, lab = {"web": (_icon_globe, ct.get("website", ""), "Website"),
                    "mail": (_icon_mail, ct.get("email", ""), "Email"),
                    "whatsapp": (_icon_whatsapp, ct.get("whatsapp", ""), "WhatsApp")}[kind]
    c = Card(740, 112, pad=24, radius=56)
    ic(c, 62, 56, 38)
    c.text(122, 34, lab.upper(), font("b", 17), MUTED, "lm")
    c.text(122, 72, val, font("bl", 36), PRIMARY if kind == "web" else NAVY, "lm")
    return c


ALL = {
    "tile_excel": lambda: tile("excel"), "tile_paper": lambda: tile("paper"),
    "tile_calc": lambda: tile("calc"), "tile_notebook": lambda: tile("notebook"),
    "upload_students": upload_students, "batch_chips": batch_chips, "question_card": question_card,
    "import_file": import_file, "calendar": calendar, "leaderboard": leaderboard, "billing": billing,
    "coming_soon": coming_soon, "comment": comment, "social_bar": social_bar, "contact_card": contact_card,
    "contact_web": lambda: contact_pill("web"), "contact_mail": lambda: contact_pill("mail"), "contact_whatsapp": lambda: contact_pill("whatsapp"),
}

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for n in (sys.argv[2:] or ALL):
        p = os.path.join(out, n + ".png")
        ALL[n]().save(p)
        print(p, Image.open(p).size)
