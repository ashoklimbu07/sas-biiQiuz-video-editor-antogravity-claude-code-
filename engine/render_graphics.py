"""
render_graphics.py — SaaS-style graphics (Pillow). NO TEXT is drawn on PNGs:
Nepali (Devanagari) needs complex shaping that Pillow here lacks (no raqm), so
all words are added as native, editable CapCut text on top of these boxes.

Commands
  palette    --logo <png/jpg>  [--out work/brand.json]
  background --style aurora|grid|spotlight|clean --w 1080 --h 1920 --primary #4F46E5 [--secondary #06B6D4] [--theme dark|light] --out x.png
  box        --kind glass|solid|outline|cta|chip|stat|step --w 900 --h 260 --primary #4F46E5
             [--icon check|arrow|bolt|star|plus|cross|chart|shield|clock|none] [--theme dark|light] --out x.png
             -> also writes x.png.json with the text_area (px) so the builder can place text inside.
  mesh       --w 1080 --h 1920 --tint #C9C4FF --primary #3525CD [--secondary #8F7BFF] [--theme light|dark] --out x.png
  widget     --kind card|input|progress|row|strike|bars|dots|button --w 760 --h 130 --primary .. --secondary ..
             [--accent #22C55E] [--pct 0.6] [--count 3] --out x.png      (biiQuiz kinetic widgets, + .json meta)
  icon       --name folder|lock|book|cap|trophy|medal|bulb|clock|stopwatch|target|check|question|star|phone|
                    chart|bell|calendar|rocket|paper [--color amber|indigo|blue|green|coral|navy|pink|white] [--size 360] --out x.png

All sizes are final pixel sizes (rendered at 2x then downsampled for crisp edges).
"""
import argparse, json, math, os, colorsys
from PIL import Image, ImageDraw, ImageFilter

SS = 2  # supersample


# ---------------------------------------------------------------- colours
def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(c):
    return "#%02X%02X%02X" % tuple(int(max(0, min(255, v))) for v in c[:3])


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def shade(c, l_target):
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in c])
    r, g, b = colorsys.hls_to_rgb(h, l_target, min(1, s))
    return (int(r * 255), int(g * 255), int(b * 255))


def palette(logo, out=None):
    im = Image.open(logo).convert("RGBA")
    im.thumbnail((200, 200))
    px = [p for p in im.getdata() if p[3] > 128]
    if not px:
        px = [(79, 70, 229, 255)]
    q = Image.new("RGB", (len(px), 1))
    q.putdata([p[:3] for p in px])
    q = q.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)
    cands = []
    for cnt, idx in counts:
        c = tuple(pal[idx * 3: idx * 3 + 3])
        h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in c])
        if l > 0.92 or l < 0.08:
            continue  # skip white / black
        cands.append((s * (0.4 + cnt / len(px)), c, h))
    cands.sort(reverse=True)
    primary = cands[0][1] if cands else (79, 70, 229)
    secondary = None
    for _, c, h in cands[1:]:
        if abs(h - colorsys.rgb_to_hls(*[v / 255 for v in primary])[0]) > 0.08:
            secondary = c
            break
    if secondary is None:  # analogous accent
        h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in primary])
        r, g, b = colorsys.hls_to_rgb((h + 0.12) % 1, max(0.45, l), max(0.6, s))
        secondary = (int(r * 255), int(g * 255), int(b * 255))
    res = {
        "primary": rgb2hex(primary), "secondary": rgb2hex(secondary),
        "dark": rgb2hex(shade(primary, 0.07)), "darker": rgb2hex(shade(primary, 0.04)),
        "light": rgb2hex(shade(primary, 0.96)), "highlight": rgb2hex(shade(secondary, 0.62)),
        "text_on_dark": "#FFFFFF", "text_on_light": rgb2hex(shade(primary, 0.12)),
    }
    if out:
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        json.dump(res, open(out, "w"), indent=1)
    print(json.dumps(res))
    return res


# ---------------------------------------------------------------- helpers
def glow(size, center, radius, color, alpha):
    # blur only the alpha: blurring colour against transparent-black pulls grey into the glow
    a = Image.new("L", size, 0)
    x, y = center
    ImageDraw.Draw(a).ellipse([x - radius, y - radius, x + radius, y + radius], fill=alpha)
    layer = Image.new("RGBA", size, tuple(color[:3]) + (0,))
    layer.putalpha(a.filter(ImageFilter.GaussianBlur(radius * 0.55)))
    return layer


def vgrad(w, h, top, bottom):
    g = Image.new("RGB", (1, h))
    for y in range(h):
        g.putpixel((0, y), mix(top, bottom, y / max(1, h - 1)))
    return g.resize((w, h))


# ---------------------------------------------------------------- backgrounds
def background(style, w, h, primary, secondary, theme, out):
    P, S = hex2rgb(primary), hex2rgb(secondary or primary)
    W, H = w * SS, h * SS
    if theme == "light":
        base = vgrad(W, H, shade(P, 0.97), shade(P, 0.92)).convert("RGBA")
        line_col = shade(P, 0.80) + (70,)
    else:
        base = vgrad(W, H, shade(P, 0.09), shade(P, 0.035)).convert("RGBA")
        line_col = (255, 255, 255, 22)

    if style in ("aurora", "spotlight", "grid"):
        a = 120 if theme != "light" else 70
        base.alpha_composite(glow((W, H), (int(W * 0.15), int(H * 0.12)), int(min(W, H) * 0.55), P, a))
        base.alpha_composite(glow((W, H), (int(W * 0.92), int(H * 0.78)), int(min(W, H) * 0.50), S, int(a * 0.8)))
        if style == "spotlight":
            base.alpha_composite(glow((W, H), (W // 2, int(H * 0.42)), int(min(W, H) * 0.45), (255, 255, 255), 28))
    if style in ("grid", "clean"):
        grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(grid)
        step = int(min(W, H) / 12)
        for x in range(0, W, step):
            d.line([(x, 0), (x, H)], fill=line_col, width=SS)
        for y in range(0, H, step):
            d.line([(0, y), (W, y)], fill=line_col, width=SS)
        # fade the grid out toward the bottom/edges (focus stays on the content)
        fade = Image.new("L", (W, H), 0)
        ImageDraw.Draw(fade).ellipse([-W * 0.2, -H * 0.35, W * 1.2, H * 0.75], fill=255)
        fade = fade.filter(ImageFilter.GaussianBlur(min(W, H) * 0.15))
        grid.putalpha(Image.composite(grid.getchannel("A"), Image.new("L", (W, H), 0), fade))
        base.alpha_composite(grid)
    # subtle noise-free film: tiny top highlight
    img = base.resize((w, h), Image.LANCZOS).convert("RGB")
    img.save(out)
    print(json.dumps({"out": out, "w": w, "h": h}))


# ---------------------------------------------------------------- icons
def draw_icon(d, kind, cx, cy, r, col, width):
    if kind == "check":
        d.line([(cx - r * .5, cy), (cx - r * .12, cy + r * .4), (cx + r * .55, cy - r * .42)], fill=col, width=width, joint="curve")
    elif kind == "cross":
        d.line([(cx - r * .42, cy - r * .42), (cx + r * .42, cy + r * .42)], fill=col, width=width)
        d.line([(cx + r * .42, cy - r * .42), (cx - r * .42, cy + r * .42)], fill=col, width=width)
    elif kind == "arrow":
        d.line([(cx - r * .5, cy), (cx + r * .45, cy)], fill=col, width=width)
        d.line([(cx + r * .05, cy - r * .4), (cx + r * .5, cy), (cx + r * .05, cy + r * .4)], fill=col, width=width, joint="curve")
    elif kind == "plus":
        d.line([(cx - r * .45, cy), (cx + r * .45, cy)], fill=col, width=width)
        d.line([(cx, cy - r * .45), (cx, cy + r * .45)], fill=col, width=width)
    elif kind == "bolt":
        pts = [(cx + r * .1, cy - r * .62), (cx - r * .38, cy + r * .08), (cx - r * .02, cy + r * .08),
               (cx - r * .12, cy + r * .62), (cx + r * .38, cy - r * .1), (cx + r * .02, cy - r * .1)]
        d.polygon(pts, fill=col)
    elif kind == "star":
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            rr = r * (.6 if i % 2 == 0 else .26)
            pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
        d.polygon(pts, fill=col)
    elif kind == "chart":
        bw = r * .22
        for i, hh in enumerate([.35, .6, .9]):
            x0 = cx - r * .5 + i * (bw + r * .12)
            d.rounded_rectangle([x0, cy + r * .45 - r * hh, x0 + bw, cy + r * .45], radius=bw * .3, fill=col)
    elif kind == "shield":
        pts = [(cx, cy - r * .6), (cx + r * .5, cy - r * .38), (cx + r * .42, cy + r * .2), (cx, cy + r * .62),
               (cx - r * .42, cy + r * .2), (cx - r * .5, cy - r * .38)]
        d.polygon(pts, outline=col, width=width)
        d.line([(cx - r * .2, cy), (cx - r * .03, cy + r * .2), (cx + r * .25, cy - r * .18)], fill=col, width=int(width * .8))
    elif kind == "clock":
        d.ellipse([cx - r * .55, cy - r * .55, cx + r * .55, cy + r * .55], outline=col, width=width)
        d.line([(cx, cy), (cx, cy - r * .33)], fill=col, width=width)
        d.line([(cx, cy), (cx + r * .25, cy + r * .1)], fill=col, width=width)


# ---------------------------------------------------------------- boxes
def box(kind, w, h, primary, secondary, icon, theme, out):
    P, S = hex2rgb(primary), hex2rgb(secondary or primary)
    pad = int(min(w, h) * 0.18) + 24          # room for shadow/glow
    W, H = (w + pad * 2) * SS, (h + pad * 2) * SS
    x0, y0, x1, y1 = pad * SS, pad * SS, (pad + w) * SS, (pad + h) * SS
    rad = int(min(h * 0.28, 48) * SS) if kind not in ("chip", "cta") else (h * SS) // 2
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # shadow
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x0, y0 + 14 * SS, x1, y1 + 14 * SS], radius=rad, fill=(0, 0, 0, 120 if theme != "light" else 60))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18 * SS)))
    # brand glow for cta/stat
    if kind in ("cta", "stat"):
        gl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(gl).rounded_rectangle([x0, y0, x1, y1], radius=rad, fill=P + (150,))
        img.alpha_composite(gl.filter(ImageFilter.GaussianBlur(22 * SS)))

    body = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    if kind in ("solid", "cta", "chip", "stat"):
        top, bot = mix(P, (255, 255, 255), 0.12), mix(P, (0, 0, 0), 0.18)
        if kind == "chip":
            top, bot = mix(P, (255, 255, 255), 0.05), P
        grad = vgrad(W, y1 - y0, top, bot).convert("RGBA")
        mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(mask).rounded_rectangle([x0, y0, x1, y1], radius=rad, fill=255)
        full = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        full.paste(grad, (0, y0))
        body = Image.composite(full, body, mask)
        bd = ImageDraw.Draw(body)
        bd.rounded_rectangle([x0, y0, x1, y1], radius=rad, outline=(255, 255, 255, 70), width=2 * SS)
    elif kind == "outline":
        fill = (255, 255, 255, 235) if theme == "light" else shade(P, 0.08) + (200,)
        bd.rounded_rectangle([x0, y0, x1, y1], radius=rad, fill=fill, outline=P + (255,), width=4 * SS)
    else:  # glass / step
        fill = (255, 255, 255, 228) if theme == "light" else shade(P, 0.10) + (215,)
        bd.rounded_rectangle([x0, y0, x1, y1], radius=rad, fill=fill)
        # top sheen
        sheen = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sheen)
        sd.rounded_rectangle([x0, y0, x1, y0 + (y1 - y0) * 0.5], radius=rad, fill=(255, 255, 255, 18 if theme != "light" else 0))
        body.alpha_composite(sheen)
        bd = ImageDraw.Draw(body)
        bd.rounded_rectangle([x0, y0, x1, y1], radius=rad, outline=mix(P, (255, 255, 255), 0.35) + (150,), width=2 * SS)
        # accent bar
        bd.rounded_rectangle([x0 + 12 * SS, y0 + (y1 - y0) * 0.26, x0 + 18 * SS, y1 - (y1 - y0) * 0.26], radius=3 * SS, fill=S + (255,))
    img.alpha_composite(body)

    d = ImageDraw.Draw(img)
    text_x0 = x0 + (44 if kind in ("glass", "step") else 32) * SS
    if icon and icon != "none":
        r = (y1 - y0) * (0.30 if kind != "chip" else 0.34)
        cx = x0 + (y1 - y0) * 0.5 + (20 * SS if kind in ("glass", "step") else 0)
        cy = (y0 + y1) / 2
        if kind in ("glass", "outline", "step"):
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=P + (255,))
            draw_icon(d, icon, cx, cy, r, (255, 255, 255, 255), int(r * 0.16))
        else:
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 235))
            draw_icon(d, icon, cx, cy, r, P + (255,), int(r * 0.16))
        text_x0 = cx + r + 26 * SS
    if kind == "cta" and (not icon or icon == "none"):
        # arrow pill on the right
        r = (y1 - y0) * 0.30
        cx, cy = x1 - (y1 - y0) * 0.5, (y0 + y1) / 2
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 240))
        draw_icon(d, "arrow", cx, cy, r, P + (255,), int(r * 0.16))

    final = img.resize((W // SS, H // SS), Image.LANCZOS)
    final.save(out)
    ta = {"x0": int(text_x0 / SS), "y0": pad, "x1": pad + w - 28, "y1": pad + h}
    meta = {"out": out, "png_w": W // SS, "png_h": H // SS, "box": {"x0": pad, "y0": pad, "x1": pad + w, "y1": pad + h},
            "text_area": ta, "kind": kind, "theme": theme,
            "text_color": "#FFFFFF" if (theme != "light" or kind in ("solid", "cta", "chip", "stat")) else None}
    json.dump(meta, open(out + ".json", "w"), indent=1)
    print(json.dumps(meta))


# ================================================================ KINETIC (biiQuiz reference style)
# Soft pastel mesh backgrounds, white UI cards with soft shadows, glossy "3D" icons.

def mesh(w, h, tint, primary, secondary, theme, out):
    """Pastel mesh gradient (light) or brand-navy glow (dark). tint = the per-scene colour."""
    T, P, S = hex2rgb(tint), hex2rgb(primary), hex2rgb(secondary or primary)
    W, H = w * SS // 2, h * SS // 2          # blobs are blurry: render at 1x and upscale
    if theme == "dark":
        base = vgrad(W, H, (25, 24, 56), (17, 19, 57)).convert("RGBA")
        base.alpha_composite(glow((W, H), (int(W * .2), int(H * .1)), int(W * .75), P, 140))
        base.alpha_composite(glow((W, H), (int(W * .95), int(H * .85)), int(W * .7), T, 90))
    else:
        base = vgrad(W, H, mix((255, 255, 255), T, .10), mix((255, 255, 255), shade(P, .90), .55)).convert("RGBA")
        base.alpha_composite(glow((W, H), (int(W * .12), int(H * .10)), int(W * .85), T, 200))
        base.alpha_composite(glow((W, H), (int(W * .95), int(H * .45)), int(W * .60), mix(T, (255, 255, 255), .35), 150))
        base.alpha_composite(glow((W, H), (int(W * .85), int(H * .92)), int(W * .80), shade(P, .86), 190))
        base.alpha_composite(glow((W, H), (int(W * .45), int(H * .55)), int(W * .55), (255, 255, 255), 120))
    base.resize((w, h), Image.BICUBIC).convert("RGB").save(out)
    print(json.dumps({"out": out, "w": w, "h": h}))


def _shadow_layer(size, mask, dy, blur, color, alpha):
    sh = Image.new("RGBA", size, color + (0,))
    a = mask.point(lambda v: v * alpha // 255)
    sh.putalpha(a)
    off = Image.new("RGBA", size, (0, 0, 0, 0))
    off.paste(sh, (0, int(dy)))
    return off.filter(ImageFilter.GaussianBlur(blur))


def _grad_fill(size, mask, top, bottom, x0=0, y0=0, horizontal=False):
    W, H = size
    if horizontal:
        g = Image.new("RGB", (W, 1))
        for x in range(W):
            g.putpixel((x, 0), mix(top, bottom, x / max(1, W - 1)))
        g = g.resize((W, H))
    else:
        g = vgrad(W, H, top, bottom)
    out = g.convert("RGBA")
    out.putalpha(mask)
    return out


def widget(kind, w, h, primary, secondary, accent, pct, count, out):
    """White UI cards. kinds: card | input | progress | row | strike | bars | dots | button"""
    P, S, A = hex2rgb(primary), hex2rgb(secondary or primary), hex2rgb(accent or "#22C55E")
    ink = (17, 19, 57)
    pad = 60
    W, H = (w + pad * 2) * SS, (h + pad * 2) * SS
    x0, y0, x1, y1 = pad * SS, pad * SS, (pad + w) * SS, (pad + h) * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ta = {"x0": pad + 36, "y0": pad, "x1": pad + w - 36, "y1": pad + h}

    def card(rad, fill=(255, 255, 255, 255)):
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).rounded_rectangle([x0, y0, x1, y1], radius=rad, fill=255)
        img.alpha_composite(_shadow_layer((W, H), m, 16 * SS, 22 * SS, ink, 46))
        body = Image.new("RGBA", (W, H), fill)
        body.putalpha(m.point(lambda v: v * fill[3] // 255))
        img.alpha_composite(body)
        return m

    if kind in ("card", "input", "row", "progress"):
        rad = int(min(34, h * 0.32) * SS) if kind != "row" else int(min(28, h * .3) * SS)
        card(rad)
    d = ImageDraw.Draw(img)

    if kind == "row":                       # checklist row: text left, green check badge right
        r = (y1 - y0) * 0.24
        cx, cy = x1 - (y1 - y0) * 0.45, (y0 + y1) / 2
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=A + (255,))
        draw_icon(d, "check", cx, cy, r, (255, 255, 255, 255), max(2, int(r * .2)))
        ta = {"x0": pad + 34, "y0": pad, "x1": int((cx - r) / SS) - 16, "y1": pad + h}
    elif kind == "progress":                # label on top half, bar on bottom
        bx0, bx1 = x0 + 44 * SS, x1 - 44 * SS
        by0, by1 = y0 + (y1 - y0) * .64, y0 + (y1 - y0) * .64 + 16 * SS
        d.rounded_rectangle([bx0, by0, bx1, by1], radius=8 * SS, fill=(236, 235, 245, 255))
        if pct > 0:
            fx1 = bx0 + (bx1 - bx0) * min(1, pct)
            m = Image.new("L", (W, H), 0)
            ImageDraw.Draw(m).rounded_rectangle([bx0, by0, max(fx1, bx0 + 16 * SS), by1], radius=8 * SS, fill=255)
            img.alpha_composite(_grad_fill((W, H), m, P, S, horizontal=True))
        ta = {"x0": pad + 30, "y0": pad + 6, "x1": pad + w - 30, "y1": pad + int(h * .58)}
    elif kind == "strike":                  # rounded bar to cross out a word
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).rounded_rectangle([x0, y0, x1, y1], radius=(y1 - y0) // 2, fill=255)
        img.alpha_composite(_grad_fill((W, H), m, P, S, horizontal=True))
    elif kind == "button":                  # brand pill button (text added natively)
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).rounded_rectangle([x0, y0, x1, y1], radius=(y1 - y0) // 2, fill=255)
        img.alpha_composite(_shadow_layer((W, H), m, 12 * SS, 18 * SS, P, 110))
        img.alpha_composite(_grad_fill((W, H), m, mix(P, (255, 255, 255), .10), shade(P, .38)))
    elif kind == "bars":                    # rising bar chart; count = bars shown (of 4)
        n, gap = 4, (x1 - x0) * 0.08
        bw = ((x1 - x0) - gap * (n - 1)) / n
        for i in range(min(count, n)):
            hh = (y1 - y0) * (0.30 + 0.70 * (i + 1) / n)
            bx = x0 + i * (bw + gap)
            m = Image.new("L", (W, H), 0)
            ImageDraw.Draw(m).rounded_rectangle([bx, y1 - hh, bx + bw, y1], radius=int(bw * .28), fill=255)
            img.alpha_composite(_shadow_layer((W, H), m, 10 * SS, 14 * SS, ink, 40))
            img.alpha_composite(_grad_fill((W, H), m, S, P))
    elif kind == "dots":                    # count dots in a row (of max(count) slots, centred)
        r = (y1 - y0) / 2
        tot = max(1, int(pct)) if pct >= 1 else count
        span = tot * 2 * r + (tot - 1) * r * .7
        sx = (x0 + x1) / 2 - span / 2
        for i in range(count):
            cx = sx + r + i * (2 * r + r * .7)
            d.ellipse([cx - r, y0, cx + r, y1], fill=P + (255,))

    final = img.resize((W // SS, H // SS), Image.LANCZOS)
    final.save(out)
    meta = {"out": out, "png_w": W // SS, "png_h": H // SS, "box": {"x0": pad, "y0": pad, "x1": pad + w, "y1": pad + h},
            "text_area": ta, "kind": kind}
    json.dump(meta, open(out + ".json", "w"), indent=1)
    print(json.dumps(meta))


ICON_COLORS = {  # top, bottom of the glossy gradient
    "amber": ((255, 214, 102), (233, 160, 40)), "indigo": ((112, 104, 255), (53, 37, 205)),
    "blue": ((92, 140, 255), (40, 46, 254)), "green": ((110, 231, 160), (22, 163, 74)),
    "coral": ((255, 150, 120), (240, 82, 70)), "navy": ((70, 72, 130), (17, 19, 57)),
    "pink": ((255, 150, 190), (236, 72, 153)), "white": ((255, 255, 255), (226, 228, 240)),
}


def icon3d(name, size, color, out):
    """Glossy flat-3D icon (soft gradient + top sheen + drop shadow). Size = canvas px (square)."""
    W = H = size * SS
    ink = (17, 19, 57)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pal = ICON_COLORS.get(color, None)
    default = {"folder": "amber", "lock": "amber", "trophy": "amber", "bulb": "amber", "star": "amber",
               "book": "indigo", "cap": "navy", "phone": "navy", "clock": "indigo", "stopwatch": "indigo",
               "target": "coral", "check": "green", "question": "blue", "chart": "indigo", "bell": "amber",
               "medal": "amber", "rocket": "indigo", "paper": "white", "calendar": "coral"}
    top, bot = pal or ICON_COLORS[default.get(name, "indigo")]
    u = W / 100.0  # 1 unit = 1% of canvas

    def layer(draw_fn, top=top, bot=bot, shadow=True, sheen=True):
        m = Image.new("L", (W, H), 0)
        draw_fn(ImageDraw.Draw(m))
        if shadow:
            img.alpha_composite(_shadow_layer((W, H), m, 4 * u, 4 * u, ink, 60))
        img.alpha_composite(_grad_fill((W, H), m, top, bot))
        if sheen:
            s = Image.new("L", (W, H), 0)
            bb = m.getbbox()
            if bb:
                ImageDraw.Draw(s).rectangle([0, bb[1], W, bb[1] + (bb[3] - bb[1]) * .42], fill=60)
                s = Image.composite(s, Image.new("L", (W, H), 0), m)
                img.alpha_composite(Image.merge("RGBA", [Image.new("L", (W, H), 255)] * 3 + [s]))
        return m

    def white(fn, a=255):
        m = Image.new("L", (W, H), 0)
        fn(ImageDraw.Draw(m))
        img.alpha_composite(Image.merge("RGBA", [Image.new("L", (W, H), 255)] * 3 + [m.point(lambda v: v * a // 255)]))

    R = lambda *b: [v * u for v in b]
    if name == "folder":
        layer(lambda d: (d.rounded_rectangle(R(12, 22, 48, 40), radius=5 * u, fill=255)), top=mix(top, bot, .5), bot=bot, sheen=False)
        layer(lambda d: d.rounded_rectangle(R(12, 30, 88, 80), radius=7 * u, fill=255))
    elif name == "lock":
        layer(lambda d: d.rounded_rectangle(R(30, 14, 70, 60), radius=20 * u, outline=255, width=int(8 * u)),
              top=(205, 205, 215), bot=(150, 150, 165), sheen=False)
        layer(lambda d: d.rounded_rectangle(R(20, 42, 80, 86), radius=10 * u, fill=255))
        white(lambda d: (d.ellipse(R(45, 54, 55, 64), fill=255), d.rounded_rectangle(R(48, 60, 52, 74), radius=2 * u, fill=255)), 200)
    elif name == "book":
        layer(lambda d: d.rounded_rectangle(R(18, 14, 82, 86), radius=8 * u, fill=255))
        white(lambda d: d.rounded_rectangle(R(24, 70, 78, 80), radius=3 * u, fill=255), 235)
        white(lambda d: (d.rounded_rectangle(R(32, 28, 68, 34), radius=3 * u, fill=255), d.rounded_rectangle(R(32, 40, 58, 45), radius=2 * u, fill=255)), 200)
    elif name == "cap":
        layer(lambda d: d.polygon(R(50, 18, 92, 38, 50, 58, 8, 38), fill=255))
        layer(lambda d: d.chord(R(26, 30, 74, 78), 0, 180, fill=255), top=mix(top, bot, .4), bot=bot, sheen=False)
        layer(lambda d: (d.line(R(78, 40, 78, 66), fill=255, width=int(3 * u)), d.ellipse(R(74, 64, 82, 72), fill=255)), *ICON_COLORS["amber"], shadow=False, sheen=False)
    elif name == "trophy" or name == "medal":
        if name == "trophy":
            layer(lambda d: (d.arc(R(10, 22, 40, 52), 90, 270, fill=255, width=int(6 * u)), d.arc(R(60, 22, 90, 52), 270, 90, fill=255, width=int(6 * u))), sheen=False)
            layer(lambda d: (d.chord(R(24, -6, 76, 62), 0, 180, fill=255), d.rectangle(R(24, 14, 76, 28), fill=255)))
            layer(lambda d: (d.rectangle(R(45, 58, 55, 72), fill=255), d.rounded_rectangle(R(30, 72, 70, 86), radius=3 * u, fill=255)), top=mix(top, bot, .5), bot=bot)
        else:
            layer(lambda d: (d.polygon(R(30, 8, 46, 8, 56, 40, 40, 40), fill=255), d.polygon(R(54, 8, 70, 8, 60, 40, 44, 40), fill=255)), *ICON_COLORS["indigo"], sheen=False)
            layer(lambda d: d.ellipse(R(24, 34, 76, 86), fill=255))
            white(lambda d: d.ellipse(R(36, 46, 64, 74), outline=255, width=int(3 * u)), 170)
    elif name == "bulb":
        layer(lambda d: (d.ellipse(R(22, 10, 78, 66), fill=255), d.polygon(R(34, 56, 66, 56, 60, 72, 40, 72), fill=255)))
        layer(lambda d: d.rounded_rectangle(R(38, 72, 62, 88), radius=4 * u, fill=255), top=(205, 205, 215), bot=(140, 140, 160), sheen=False)
    elif name in ("clock", "stopwatch"):
        if name == "stopwatch":
            layer(lambda d: (d.rounded_rectangle(R(42, 6, 58, 16), radius=3 * u, fill=255), d.rectangle(R(47, 14, 53, 22), fill=255)), sheen=False)
        layer(lambda d: d.ellipse(R(12, 18, 88, 94), fill=255))
        white(lambda d: d.ellipse(R(20, 26, 80, 86), fill=255), 255)
        layer(lambda d: (d.line(R(50, 56, 50, 36), fill=255, width=int(5 * u)), d.line(R(50, 56, 64, 64), fill=255, width=int(5 * u)), d.ellipse(R(46, 52, 54, 60), fill=255)), shadow=False, sheen=False)
    elif name == "target":
        layer(lambda d: d.ellipse(R(10, 10, 90, 90), fill=255))
        white(lambda d: d.ellipse(R(22, 22, 78, 78), fill=255))
        layer(lambda d: d.ellipse(R(33, 33, 67, 67), fill=255), shadow=False)
        white(lambda d: d.ellipse(R(43, 43, 57, 57), fill=255))
    elif name == "check":
        layer(lambda d: d.ellipse(R(10, 10, 90, 90), fill=255))
        white(lambda d: d.line(R(30, 52, 44, 66, 71, 37), fill=255, width=int(9 * u), joint="curve"))
    elif name == "question":   # biiQuiz-style question mark bubble
        layer(lambda d: (d.rounded_rectangle(R(10, 10, 90, 78), radius=22 * u, fill=255), d.polygon(R(26, 70, 44, 70, 24, 92), fill=255)))
        white(lambda d: (d.arc(R(36, 20, 64, 46), 180, 60, fill=255, width=int(8 * u)), d.line(R(57, 42, 50, 52, 50, 56), fill=255, width=int(8 * u)), d.ellipse(R(45, 60, 55, 70), fill=255)))
    elif name == "star":
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            rr = 44 if i % 2 == 0 else 20
            pts += [50 + rr * math.cos(ang), 54 + rr * math.sin(ang)]
        layer(lambda d: d.polygon(R(*pts), fill=255))
    elif name == "phone":
        layer(lambda d: d.rounded_rectangle(R(26, 6, 74, 94), radius=10 * u, fill=255))
        white(lambda d: d.rounded_rectangle(R(31, 14, 69, 82), radius=5 * u, fill=255), 245)
        layer(lambda d: (d.rounded_rectangle(R(36, 24, 64, 30), radius=2 * u, fill=255), d.rounded_rectangle(R(36, 36, 58, 41), radius=2 * u, fill=255), d.rounded_rectangle(R(36, 60, 64, 72), radius=5 * u, fill=255)), *ICON_COLORS["indigo"], shadow=False, sheen=False)
    elif name == "chart":
        for i, hh in enumerate([30, 50, 72]):
            layer(lambda d, i=i, hh=hh: d.rounded_rectangle(R(14 + i * 26, 88 - hh, 34 + i * 26, 88), radius=5 * u, fill=255))
    elif name == "bell":
        layer(lambda d: (d.chord(R(22, 14, 78, 70), 180, 360, fill=255), d.polygon(R(22, 42, 78, 42, 86, 74, 14, 74), fill=255)))
        layer(lambda d: d.ellipse(R(42, 72, 58, 88), fill=255), shadow=False, sheen=False)
    elif name == "calendar":
        layer(lambda d: d.rounded_rectangle(R(12, 16, 88, 88), radius=10 * u, fill=255), *ICON_COLORS["white"])
        layer(lambda d: d.rounded_rectangle(R(12, 16, 88, 38), radius=10 * u, fill=255), shadow=False)
        layer(lambda d: [d.rounded_rectangle(R(24 + c * 18, 48 + r * 16, 34 + c * 18, 58 + r * 16), radius=2 * u, fill=255) for r in range(2) for c in range(3)], *ICON_COLORS["indigo"], shadow=False, sheen=False)
    elif name == "rocket":
        layer(lambda d: d.ellipse(R(34, 6, 66, 78), fill=255), *ICON_COLORS["white"])
        layer(lambda d: (d.polygon(R(34, 48, 18, 74, 36, 70), fill=255), d.polygon(R(66, 48, 82, 74, 64, 70), fill=255)), shadow=False)
        layer(lambda d: d.ellipse(R(42, 26, 58, 42), fill=255), shadow=False)
        layer(lambda d: d.polygon(R(42, 76, 58, 76, 50, 96), fill=255), *ICON_COLORS["coral"], shadow=False, sheen=False)
    else:  # paper / generic sheet
        layer(lambda d: d.rounded_rectangle(R(20, 8, 80, 92), radius=8 * u, fill=255), *ICON_COLORS["white"])
        layer(lambda d: [d.rounded_rectangle(R(30, 24 + i * 14, 70 - (i % 2) * 14, 30 + i * 14), radius=2 * u, fill=255) for i in range(4)], top, bot, shadow=False, sheen=False)
    final = img.resize((size, size), Image.LANCZOS)
    final.save(out)
    print(json.dumps({"out": out, "png_w": size, "png_h": size, "name": name}))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["palette", "background", "box", "mesh", "widget", "icon"])
    ap.add_argument("--logo"); ap.add_argument("--out")
    ap.add_argument("--style", default="aurora"); ap.add_argument("--kind", default="glass")
    ap.add_argument("--w", type=int, default=1080); ap.add_argument("--h", type=int, default=1920)
    ap.add_argument("--primary", default="#4F46E5"); ap.add_argument("--secondary")
    ap.add_argument("--icon", default="none"); ap.add_argument("--theme", default="dark")
    ap.add_argument("--tint", default="#C7C3FF"); ap.add_argument("--accent")
    ap.add_argument("--pct", type=float, default=1.0); ap.add_argument("--count", type=int, default=4)
    ap.add_argument("--name", default="check"); ap.add_argument("--size", type=int, default=360)
    ap.add_argument("--color")
    a = ap.parse_args()
    if a.out:
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    if a.cmd == "palette":
        palette(a.logo, a.out)
    elif a.cmd == "background":
        background(a.style, a.w, a.h, a.primary, a.secondary, a.theme, a.out)
    elif a.cmd == "mesh":
        mesh(a.w, a.h, a.tint, a.primary, a.secondary, a.theme, a.out)
    elif a.cmd == "widget":
        widget(a.kind, a.w, a.h, a.primary, a.secondary, a.accent, a.pct, a.count, a.out)
    elif a.cmd == "icon":
        icon3d(a.name, a.size, a.color, a.out)
    else:
        box(a.kind, a.w, a.h, a.primary, a.secondary, a.icon, a.theme, a.out)


if __name__ == "__main__":
    main()
