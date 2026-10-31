#!/usr/bin/env python3
"""Keep the Photos page in sync with the folders in images/photos/.

The folders are the source of truth. Make changes in Finder, then run:

    python3 update-photos.py

What it handles
  - Deleted a photo or a whole album folder   -> removed from the site
  - Renamed an album folder                   -> recognized by its photos; keeps the
                                                 album's title, category, dates, camera
                                                 settings and featured-slider spots
  - Dropped new photos into an album folder   -> web-sized copy + thumbnail made,
    (or a brand-new folder of photos)            camera settings and date read from the
                                                 photo, original moved to
                                                 _imported-originals/ (never deleted)
  - Leftover thumbnails of deleted photos     -> removed

Every count on the Photos page is calculated from photos-data.js, so it always
matches what this script finds.

Adding new photos needs Pillow (pip3 install Pillow). Deleting and renaming work
without it.

Album titles, categories, covers, dates and the featured slider can be edited by
hand in photos-data.js; this script keeps those edits.
"""
import datetime
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "photos-data.js")
PHOTOS = os.path.join(HERE, "images", "photos")
ORIGINALS = os.path.join(HERE, "_imported-originals")
FULL, THUMB = 1600, 800
IMAGE_EXT = (".jpg", ".jpeg", ".png")
CATEGORIES = ("portraits", "shoots", "events", "everyday", "classwork")

try:
    from PIL import Image, ImageOps
except ImportError:  # deleting and renaming still work without Pillow
    Image = None

HEADER = """/* Photo data for photos.html, written by update-photos.py.

   Manage photos with folders, not by editing this file:
     delete photos or album folders in images/photos/, rename a folder, or drop
     new photos into a folder, then run:  python3 update-photos.py

   Safe to edit by hand (keep the quotes and commas):
     "title"  album name shown on the site
     "cat"    portraits, shoots, events, everyday or classwork
     "cover"  file name (without .jpg) of the album's cover photo
     "date"   optional text that replaces the album's date, e.g. "Summer 2026"
     "d"      the date a photo was taken, YYYY-MM-DD
     "t"      optional photo title
   "folder" is the folder name in images/photos/. Rename the folder instead of
   editing it, and the script updates it.

   PHOTO_FEATURED is the slider at the top of the Photos page, in order.
*/

"""


# ---------------------------------------------------------------- reading

def read_data():
    if not os.path.exists(DATA):
        return [], []
    text = open(DATA, encoding="utf-8").read()
    dec = json.JSONDecoder()

    def grab(name):
        m = re.search(r"window\." + name + r"\s*=\s*", text)
        if not m:
            return []
        try:
            return dec.raw_decode(text, m.end())[0]
        except json.JSONDecodeError as e:
            line = text.count("\n", 0, e.pos) + 1
            sys.exit(f"photos-data.js has a typo near line {line}: {e.msg}. "
                     "Fix it (usually a missing quote or comma), then run this again.")

    albums = grab("PHOTO_ALBUMS")
    for a in albums:  # older files used "slug"
        if "folder" not in a:
            a["folder"] = a.pop("slug")
    return grab("PHOTO_FEATURED"), albums


def list_folder(folder):
    """Image files directly inside an album folder (not thumbs/)."""
    path = os.path.join(PHOTOS, folder)
    return sorted(f for f in os.listdir(path)
                  if f.lower().endswith(IMAGE_EXT) and not f.startswith(".")
                  and os.path.isfile(os.path.join(path, f)))


def key(filename):
    return os.path.splitext(filename)[0]


def web_name(filename):
    return re.sub(r"[^a-z0-9]+", "-", key(filename).lower()).strip("-") or "photo"


# ---------------------------------------------------------------- photo info

def fix_date(raw):
    """EXIF date -> YYYY-MM-DD, or None if the camera clock had reset."""
    if not raw or str(raw).startswith(("0000", "2000")):
        return None
    try:
        d = datetime.date(*map(int, str(raw)[:10].split(":")))
    except ValueError:
        return None
    # The D90's clock ran a year behind from mid-Feb to early Apr 2026
    if datetime.date(2025, 2, 1) <= d <= datetime.date(2025, 4, 4):
        d = d.replace(year=2026)
    return d.isoformat()


def fmt_shutter(t):
    if t >= 1:
        return f"{t:.0f}s"
    if t >= 0.3:
        return f"{t:g}s"
    return f"1/{round(1 / t)}s"


def fmt_lens(lens):
    m = re.match(r"([\d.]+)-([\d.]+) mm f/([\d.]+)-([\d.]+)", lens or "")
    if m:
        return f"{float(m[1]):g}–{float(m[2]):g}mm f/{float(m[3]):g}–{float(m[4]):g}"
    return (lens or "").strip() or None


def camera_info(im):
    ex = im.getexif()
    sub = ex.get_ifd(0x8769)

    def num(tag):
        try:
            v = sub.get(tag)
            return float(v) if v is not None else None
        except (TypeError, ValueError, ZeroDivisionError):
            return None

    info = {}
    cam = (ex.get(0x0110) or "").strip()
    if cam:
        info["cam"] = {"NIKON D90": "Nikon D90"}.get(cam, cam)
    lens = fmt_lens(sub.get(0xa434))
    if lens and cam.lower() not in lens.lower():
        info["lens"] = lens
    if num(0x920a):
        info["fl"] = f"{num(0x920a):g}mm"
    if num(0x829d):
        info["ap"] = f"f/{num(0x829d):g}"
    if num(0x829a):
        info["ss"] = fmt_shutter(num(0x829a))
    iso = sub.get(0x8827)
    if isinstance(iso, (tuple, list)):
        iso = iso[0] if iso else None
    if iso:
        info["iso"] = int(iso)
    d = fix_date(sub.get(0x9003) or ex.get(0x0132))
    if d:
        info["d"] = d
    return info


def make_thumb(folder, name, im=None):
    os.makedirs(os.path.join(PHOTOS, folder, "thumbs"), exist_ok=True)
    if im is None:
        im = Image.open(os.path.join(PHOTOS, folder, name + ".jpg")).convert("RGB")
    th = im.copy()
    th.thumbnail((THUMB, THUMB), Image.LANCZOS)
    th.save(os.path.join(PHOTOS, folder, "thumbs", name + ".jpg"), "JPEG",
            quality=74, optimize=True, progressive=True)


def import_photo(folder, filename, used):
    """Make the web copy + thumbnail for a new photo; return its data entry."""
    src = os.path.join(PHOTOS, folder, filename)
    name = base = web_name(filename)
    i = 2
    while name in used:
        name, i = f"{base}-{i}", i + 1
    used.add(name)

    im = Image.open(src)
    info = camera_info(im)
    im = ImageOps.exif_transpose(im).convert("RGB")

    # Move the original out of the website (never delete it), then write the web copy
    dest_dir = os.path.join(ORIGINALS, folder)
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, filename)
    n = 2
    while os.path.exists(dest):
        dest = os.path.join(dest_dir, f"{key(filename)}-{n}{os.path.splitext(filename)[1]}")
        n += 1
    shutil.move(src, dest)

    full = im.copy()
    full.thumbnail((FULL, FULL), Image.LANCZOS)
    full.save(os.path.join(PHOTOS, folder, name + ".jpg"), "JPEG",
              quality=80, optimize=True, progressive=True)  # no metadata: strips GPS etc.
    make_thumb(folder, name, full)

    entry = {"f": name, "w": full.size[0], "h": full.size[1]}
    entry.update(info)
    return entry


def title_from_folder(folder):
    t = re.sub(r"[-_]+", " ", folder).strip()
    return t[:1].upper() + t[1:] if t else folder


def ensure_gitignore():
    path = os.path.join(HERE, ".gitignore")
    lines = open(path).read().splitlines() if os.path.exists(path) else []
    if "_imported-originals/" not in lines:
        with open(path, "a") as f:
            if lines and lines[-1] != "":
                f.write("\n")
            f.write("# Full-size originals moved here by update-photos.py\n_imported-originals/\n")


# ---------------------------------------------------------------- writing

def write_data(featured, albums):
    dump = lambda v: json.dumps(v, ensure_ascii=False)
    out = [HEADER, "window.PHOTO_FEATURED = [\n"]
    out.append(",\n".join("  " + dump(s) for s in featured))
    out.append("\n];\n\nwindow.PHOTO_ALBUMS = [\n")
    top = ("folder", "title", "cat", "cover", "date")
    order = ("f", "d", "t", "cam", "lens", "fl", "ap", "ss", "iso", "w", "h")
    blocks = []
    for a in albums:
        lines = ["  {"]
        for k in top:
            if a.get(k) is not None:
                lines.append(f'    "{k}": {dump(a[k])},')
        for k, v in a.items():  # keep any extra keys added by hand
            if k not in top and k != "photos":
                lines.append(f'    "{k}": {dump(v)},')
        lines.append('    "photos": [')
        rows = []
        for p in a["photos"]:
            row = {k: p[k] for k in order if k in p}
            row.update({k: v for k, v in p.items() if k not in row})
            rows.append("      " + dump(row))
        lines.append(",\n".join(rows))
        lines.append("    ]")
        lines.append("  }")
        blocks.append("\n".join(lines))
    out.append(",\n".join(blocks))
    out.append("\n];\n")
    tmp = DATA + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("".join(out))
    os.replace(tmp, DATA)


# ---------------------------------------------------------------- main

def main():
    featured, albums = read_data()
    before = (sum(len(a["photos"]) for a in albums), len(albums))
    report = []
    need_pillow = set()
    folders = sorted(d for d in os.listdir(PHOTOS)
                     if os.path.isdir(os.path.join(PHOTOS, d)) and not d.startswith((".", "_")))
    files = {d: list_folder(d) for d in folders}

    by_folder = {a["folder"]: a for a in albums}
    claimed = {d: by_folder[d] for d in folders if d in by_folder}
    missing = [a for a in albums if a["folder"] not in files]

    # Renamed folders: match an album whose folder vanished by the photos inside
    for d in folders:
        if d in claimed:
            continue
        names = {key(f) for f in files[d]}
        best, best_n = None, 0
        for a in missing:
            if any(a is c for c in claimed.values()):
                continue
            n = len(names & {p["f"] for p in a["photos"]})
            if n > best_n:
                best, best_n = a, n
        if best and best_n >= max(1, len(best["photos"]) // 4):
            old = best["folder"]
            for s in featured:
                if s["album"] == old:
                    s["album"] = d
            best["folder"] = d
            claimed[d] = best
            report.append(f'Renamed folder "{old}" -> "{d}" (album "{best["title"]}" kept as is)')

    for a in missing:
        if not any(a is c for c in claimed.values()):
            report.append(f'{a["title"]}: folder "{a["folder"]}" is gone, album removed')

    # Existing albums keep their order; new folders are added at the end
    order = [a["folder"] for a in albums if a["folder"] in claimed]
    order += [d for d in folders if d not in order]

    result = []
    for d in order:
        a = claimed.get(d)
        present = {key(f): f for f in files[d]}
        if a is None:
            if not present:
                continue
            a = {"folder": d, "title": title_from_folder(d), "cat": "everyday", "cover": None, "photos": []}
            report.append(f'New album "{a["title"]}" (category "everyday"; change "cat" in photos-data.js if needed)')

        kept = [p for p in a["photos"] if present.get(p["f"]) == p["f"] + ".jpg"]
        removed = len(a["photos"]) - len(kept)
        if removed:
            report.append(f'{a["title"]}: removed {removed} deleted photo{"s" * (removed != 1)}')

        known = {p["f"] for p in kept}
        new_files = [fn for k, fn in present.items() if k not in known]
        added = []
        if new_files and Image is None:
            need_pillow.add(d)
        elif new_files:
            ensure_gitignore()
            used = set(known)
            for fn in new_files:
                try:
                    added.append(import_photo(d, fn, used))
                except Exception as e:  # unreadable file: leave it where it is
                    report.append(f"  ! skipped {d}/{fn}: {e}")
            added.sort(key=lambda p: (p.get("d", "9999"), p["f"]))
            if added:
                report.append(f'{a["title"]}: added {len(added)} new photo{"s" * (len(added) != 1)}')
        a["photos"] = kept + added

        if not a["photos"]:
            if a.get("title") and claimed.get(d) is not None:
                report.append(f'{a["title"]}: no photos left, album removed')
            continue
        if not any(p["f"] == a.get("cover") for p in a["photos"]):
            a["cover"] = a["photos"][0]["f"]
        if a.get("cat") not in CATEGORIES:
            a["cat"] = "everyday"
        result.append(a)

        # Thumbnails: remove leftovers of deleted photos, rebuild any missing ones
        tdir = os.path.join(PHOTOS, d, "thumbs")
        valid = {p["f"] + ".jpg" for p in a["photos"]}
        if os.path.isdir(tdir):
            stale = []
            for t in os.listdir(tdir):
                if t.lower().endswith(IMAGE_EXT) and t not in valid:
                    try:
                        os.remove(os.path.join(tdir, t))
                        stale.append(t)
                    except OSError as e:
                        report.append(f"  ! couldn't remove leftover thumbnail {d}/thumbs/{t}: {e.strerror}")
            if stale:
                report.append(f'{a["title"]}: cleaned up {len(stale)} leftover thumbnail{"s" * (len(stale) != 1)}')
        for p in a["photos"]:
            if not os.path.exists(os.path.join(tdir, p["f"] + ".jpg")):
                if Image is None:
                    need_pillow.add(d)
                else:
                    make_thumb(d, p["f"])

    live = {(a["folder"], p["f"]) for a in result for p in a["photos"]}
    for s in featured:
        if (s["album"], s["f"]) not in live:
            report.append(f'Featured slider: removed {s["album"]}/{s["f"]} (photo no longer exists)')
    featured = [s for s in featured if (s["album"], s["f"]) in live]

    write_data(featured, result)
    after = (sum(len(a["photos"]) for a in result), len(result))

    for line in report:
        print(line)
    if need_pillow:
        print("\nNew photos or missing thumbnails in: " + ", ".join(sorted(need_pillow)))
        print("To process them, install Pillow:  pip3 install Pillow   then run this again.")
    print(f"\nPhotos: {before[0]} -> {after[0]}   Albums: {before[1]} -> {after[1]}   Slider: {len(featured)} photos")
    if not report and not need_pillow:
        print("Everything already matches.")


if __name__ == "__main__":
    main()
