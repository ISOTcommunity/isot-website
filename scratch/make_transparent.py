import os
from PIL import Image, ImageChops
import collections

USER_DIR = "/Users/amirhosseinshokouhipour/.gemini/antigravity/brain/d91bd9f7-9765-4fcd-94ab-550af0651d5e/.user_uploaded"
OUT_DIR = "/Users/amirhosseinshokouhipour/Desktop/claude projects/Digital Products/ISOT/website/assets/characters"

os.makedirs(OUT_DIR, exist_ok=True)

files_map = {
    "media_1787848513282.png": "char_white_standing.png",
    "media_1787848513294.png": "char_white_runner.png",
    "media_1787848513292.png": "char_white_starjumper.png",
    "media_1787848513302.png": "char_white_leaper.png",
    "media_1787848513327.png": "char_white_dancer.png",
    "media_1787848540496.png": "char_bottle_rider.png",
    "media_1787848540501.png": "char_yellow_dancer.png",
    "media_1787848540556.png": "char_spiky_twins.png",
    "media_1787848540571.png": "char_duo_sitting.png",
    "media_1787848540683.png": "char_cat_wizards.png",
    "media_1787848548415.png": "char_karaoke_singer.png"
}

def remove_white_bg(img_path, out_path):
    img = Image.open(img_path).convert("RGBA")
    w, h = img.size
    pix = img.load()

    # Create a mask for visited pixels
    visited = [[False]*h for _ in range(w)]
    queue = collections.deque()

    # Push all border pixels that are near white
    def is_white(r, g, b):
        return r >= 235 and g >= 235 and b >= 235

    for x in range(w):
        for y in [0, h - 1]:
            r, g, b, a = pix[x, y]
            if is_white(r, g, b) and not visited[x][y]:
                visited[x][y] = True
                queue.append((x, y))

    for y in range(h):
        for x in [0, w - 1]:
            r, g, b, a = pix[x, y]
            if is_white(r, g, b) and not visited[x][y]:
                visited[x][y] = True
                queue.append((x, y))

    # Flood fill outer background
    while queue:
        cx, cy = queue.popleft()
        pix[cx, cy] = (0, 0, 0, 0) # set transparent

        for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                r, g, b, a = pix[nx, ny]
                if is_white(r, g, b):
                    visited[nx][ny] = True
                    queue.append((nx, ny))

    # Autocrop transparent borders
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    img.save(out_path, "PNG")
    print(f"Saved {out_path} ({img.size[0]}x{img.size[1]})")

for src_name, target_name in files_map.items():
    src_path = os.path.join(USER_DIR, src_name)
    dst_path = os.path.join(OUT_DIR, target_name)
    if os.path.exists(src_path):
        remove_white_bg(src_path, dst_path)
    else:
        print(f"File not found: {src_path}")
