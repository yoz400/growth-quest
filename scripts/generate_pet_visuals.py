from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "pet_visuals"
ICON_DIR = OUT / "icons"
SHEET_DIR = OUT / "sheets"


PETS = [
    (1, "こだまスライム", "slime", "forest"),
    (2, "ひだまりモコ", "fluffy", "light"),
    (3, "ランタンバット", "bat", "light"),
    (4, "つゆくさピクシー", "fairy", "water"),
    (5, "まめドラコ", "dragon", "fire"),
    (6, "ころころ岩モグ", "golem", "earth"),
    (7, "ホシクズクラゲ", "jelly", "star"),
    (8, "ねじまきゴーレム", "mechanical", "metal"),
    (9, "きのこリス", "mammal", "forest"),
    (10, "そよ風フェレット", "mammal", "wind"),
    (11, "あめだまスライム", "slime", "sweet"),
    (12, "こおりペンギン", "bird", "ice"),
    (13, "ぽんぽこタヌキン", "mammal", "earth"),
    (14, "ちびグリフォン", "bird", "wind"),
    (15, "ねむりヒツジ", "fluffy", "dream"),
    (16, "はっぱカメレオン", "reptile", "forest"),
    (17, "みずたまカーバンクル", "mammal", "gem"),
    (18, "さびネジインプ", "humanoid", "metal"),
    (19, "もぐらランサー", "mammal", "earth"),
    (20, "しろたまユニコ", "mammal", "light"),
    (21, "ほたるウルフ", "mammal", "light"),
    (22, "かぜきりツバメ竜", "dragon", "wind"),
    (23, "クリスタルラビット", "mammal", "gem"),
    (24, "どんぐりトレント", "plant", "forest"),
    (25, "ふわ雲ラム", "fluffy", "wind"),
    (26, "ひのこサラマンダー", "reptile", "fire"),
    (27, "こがねコガネムシ", "insect", "gold"),
    (28, "もふもふイエティ", "fluffy", "ice"),
    (29, "すなネコマタ", "mammal", "sand"),
    (30, "まよけフクロウ", "bird", "mystic"),
    (31, "ルーンとかげ", "reptile", "mystic"),
    (32, "ぷちミミック", "mimic", "gold"),
    (33, "みならいフェニックス", "bird", "fire"),
    (34, "ねむけバク", "mammal", "dream"),
    (35, "ゆきだまゴブリン", "humanoid", "ice"),
    (36, "しずくセイレーン", "aquatic", "water"),
    (37, "つぼみマンティス", "insect", "forest"),
    (38, "ほしぞらキツネ", "mammal", "star"),
    (39, "からくりネズミ", "mechanical", "metal"),
    (40, "こぐまナイト", "mammal", "metal"),
    (41, "あおばドレイク", "dragon", "forest"),
    (42, "まどろみクラゲ", "jelly", "dream"),
    (43, "ルビーサソリ", "insect", "gem"),
    (44, "しろつのボア", "mammal", "earth"),
    (45, "すずめ天狗", "bird", "wind"),
    (46, "こびんホムンクルス", "humanoid", "mystic"),
    (47, "くろねこシェイド", "ghost", "shadow"),
    (48, "ふうせんポルカ", "slime", "wind"),
    (49, "まんまる甲羅虫", "insect", "earth"),
    (50, "こはくリザード", "reptile", "gold"),
    (51, "うたたねドラゴン", "dragon", "dream"),
    (52, "さくらスプライト", "fairy", "flower"),
    (53, "ばちばちスパーク", "ghost", "lightning"),
    (54, "どろんこオークレット", "humanoid", "earth"),
    (55, "りんごワーム", "insect", "sweet"),
    (56, "きらめきインコ竜", "dragon", "gem"),
    (57, "こつこつスケルトン", "undead", "bone"),
    (58, "ひみつモモンガ", "mammal", "shadow"),
    (59, "わたあめビースト", "fluffy", "sweet"),
    (60, "こんぺいとうフェアリー", "fairy", "star"),
    (61, "すみれコボルト", "humanoid", "flower"),
    (62, "かいがらマーメイド", "aquatic", "water"),
    (63, "ゆらめきウィスプ", "ghost", "light"),
    (64, "つららハリネズミ", "mammal", "ice"),
    (65, "ぱたぱたガーゴイル", "dragon", "stone"),
    (66, "ちびケルベロス", "mammal", "fire"),
    (67, "もりのパンプキン", "plant", "shadow"),
    (68, "こめつぶゴーレム", "golem", "light"),
    (69, "あわあわタツノコ", "aquatic", "water"),
    (70, "てのりマンモス", "mammal", "ice"),
    (71, "まじないカラス", "bird", "shadow"),
    (72, "うろこリス竜", "dragon", "forest"),
    (73, "こだいハニワ", "golem", "earth"),
    (74, "ちゃぽんカエル仙人", "aquatic", "water"),
    (75, "すやすやノーム", "humanoid", "dream"),
    (76, "ひらめきイルカ", "aquatic", "light"),
    (77, "こがらしウサギ", "mammal", "wind"),
    (78, "ほねほねワンコ", "undead", "bone"),
    (79, "みずぐもスパイダー", "insect", "water"),
    (80, "めだまランタン", "ghost", "light"),
    (81, "こおりづのトナカイ", "mammal", "ice"),
    (82, "からすみシードラ", "aquatic", "gold"),
    (83, "まるたビーバー", "mammal", "forest"),
    (84, "くものこスフィンクス", "mammal", "mystic"),
    (85, "ぴかぴかビー", "insect", "lightning"),
    (86, "ひょうたんタヌキ", "mammal", "forest"),
    (87, "ねじれツノヤギ", "mammal", "earth"),
    (88, "こまいぬベビー", "mammal", "light"),
    (89, "ちびナーガ", "reptile", "water"),
    (90, "もくもく煙鬼", "ghost", "shadow"),
    (91, "こはるアルパカ", "fluffy", "flower"),
    (92, "まよい蝶", "insect", "mystic"),
    (93, "きんぎょドラゴン", "dragon", "water"),
    (94, "つきよモモン", "mammal", "star"),
    (95, "からくりフクロネズミ", "mechanical", "metal"),
    (96, "しおかぜラッコ", "aquatic", "water"),
    (97, "ひびきコウモリ", "bat", "mystic"),
    (98, "こもれび鹿", "mammal", "forest"),
    (99, "ちびタイタン", "humanoid", "stone"),
    (100, "にじいろスライム", "slime", "rainbow"),
]


PALETTES = {
    "forest": ((92, 164, 96), (44, 104, 66), (230, 222, 130)),
    "light": ((246, 219, 112), (190, 132, 45), (255, 247, 202)),
    "water": ((72, 174, 205), (35, 101, 148), (205, 247, 255)),
    "fire": ((236, 102, 65), (155, 48, 45), (255, 205, 89)),
    "earth": ((152, 112, 72), (88, 67, 54), (221, 187, 120)),
    "star": ((97, 102, 194), (50, 55, 118), (249, 229, 125)),
    "metal": ((142, 152, 160), (76, 84, 94), (222, 224, 215)),
    "sweet": ((236, 137, 177), (183, 81, 123), (255, 224, 151)),
    "ice": ((141, 215, 232), (70, 126, 166), (240, 255, 255)),
    "wind": ((141, 205, 171), (65, 128, 119), (231, 255, 232)),
    "dream": ((174, 145, 219), (94, 73, 143), (247, 227, 255)),
    "gem": ((80, 201, 190), (34, 102, 139), (255, 220, 99)),
    "gold": ((224, 166, 58), (133, 89, 35), (255, 237, 151)),
    "sand": ((214, 170, 102), (137, 93, 58), (255, 231, 174)),
    "mystic": ((129, 99, 183), (57, 54, 106), (115, 229, 210)),
    "flower": ((229, 128, 171), (116, 96, 167), (245, 229, 105)),
    "shadow": ((83, 79, 105), (36, 35, 55), (151, 210, 221)),
    "lightning": ((245, 207, 65), (73, 96, 150), (255, 255, 180)),
    "bone": ((223, 218, 197), (92, 86, 76), (180, 213, 240)),
    "stone": ((147, 148, 142), (76, 77, 76), (212, 205, 172)),
    "rainbow": ((127, 210, 178), (75, 111, 205), (255, 204, 95)),
}


def color_variant(color, amount):
    r, g, b = color
    return tuple(max(0, min(255, int(c + (255 - c) * amount))) for c in (r, g, b))


def darken(color, amount):
    r, g, b = color
    return tuple(max(0, min(255, int(c * (1 - amount)))) for c in (r, g, b))


class Art:
    def __init__(self, size=256):
        self.size = size
        self.img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.img)
        self.line = (33, 29, 31, 255)

    def ellipse(self, box, fill, outline=True, width=5):
        self.draw.ellipse(box, fill=fill + (255,), outline=self.line if outline else None, width=width)

    def rect(self, box, fill, outline=True, width=5):
        self.draw.rounded_rectangle(box, radius=10, fill=fill + (255,), outline=self.line if outline else None, width=width)

    def poly(self, points, fill, outline=True, width=5):
        self.draw.polygon(points, fill=fill + (255,))
        if outline:
            self.draw.line(points + [points[0]], fill=self.line, width=width, joint="curve")

    def line_draw(self, points, fill=None, width=5):
        self.draw.line(points, fill=fill or self.line, width=width, joint="curve")

    def eye_pair(self, cx=128, cy=116, dx=24, sleepy=False):
        if sleepy:
            self.line_draw([(cx - dx - 10, cy), (cx - dx + 10, cy + 3)], width=4)
            self.line_draw([(cx + dx - 10, cy + 3), (cx + dx + 10, cy)], width=4)
            return
        for x in (cx - dx, cx + dx):
            self.ellipse((x - 10, cy - 13, x + 10, cy + 13), (18, 18, 22), outline=False)
            self.ellipse((x - 4, cy - 9, x + 2, cy - 3), (255, 255, 255), outline=False)

    def smile(self, cx=128, cy=145):
        self.line_draw([(cx - 10, cy), (cx, cy + 7), (cx + 10, cy)], fill=(117, 54, 50, 255), width=4)


def add_element_mark(a, element, main, accent):
    d = a.draw
    if element in ("forest", "flower"):
        a.poly([(192, 62), (210, 48), (216, 68)], accent, width=4)
        a.line_draw([(197, 69), (189, 82)], fill=(49, 113, 67, 255), width=3)
    elif element == "fire":
        a.poly([(198, 74), (211, 42), (224, 74), (211, 92)], accent, width=4)
        a.poly([(207, 75), (214, 58), (219, 77), (213, 86)], (255, 238, 110), width=2)
    elif element == "ice":
        for ang in range(0, 360, 60):
            x = 208 + math.cos(math.radians(ang)) * 18
            y = 61 + math.sin(math.radians(ang)) * 18
            a.line_draw([(208, 61), (x, y)], fill=accent + (255,), width=3)
    elif element in ("gem", "star", "light"):
        a.poly([(208, 44), (218, 64), (208, 86), (198, 64)], accent, width=4)
    elif element == "lightning":
        a.poly([(204, 43), (222, 43), (212, 63), (225, 63), (199, 91), (207, 68), (195, 68)], accent, width=4)
    elif element == "metal":
        a.ellipse((196, 49, 222, 75), accent, width=4)
        for ang in range(0, 360, 45):
            x = 209 + math.cos(math.radians(ang)) * 20
            y = 62 + math.sin(math.radians(ang)) * 20
            a.line_draw([(209, 62), (x, y)], fill=a.line, width=2)
    elif element == "water":
        a.poly([(207, 43), (222, 70), (208, 88), (194, 70)], accent, width=4)
    elif element == "shadow":
        a.ellipse((195, 48, 225, 82), darken(main, 0.2), width=4)
        d.arc((200, 49, 226, 80), 80, 280, fill=accent + (255,), width=4)
    elif element == "rainbow":
        colors = [(237, 91, 91), (245, 190, 75), (92, 190, 103), (82, 151, 221), (164, 111, 219)]
        for i, c in enumerate(colors):
            d.arc((190, 45 + i * 3, 230, 92 + i * 3), 200, 330, fill=c + (255,), width=4)


def draw_slime(a, main, dark, accent, rng, element):
    a.ellipse((54, 72, 202, 198), main, width=6)
    a.poly([(114, 80), (133, 42), (150, 82)], main, width=5)
    a.ellipse((84, 98, 127, 122), color_variant(main, 0.35), outline=False)
    a.eye_pair(cy=129, dx=28)
    a.smile(cy=157)
    if rng.random() < 0.65:
        a.ellipse((108, 184, 148, 204), dark, width=4)
    add_element_mark(a, element, main, accent)


def draw_mammal(a, main, dark, accent, rng, element):
    a.ellipse((72, 76, 184, 186), main, width=6)
    ear_type = rng.choice(["round", "point", "horn"])
    if ear_type == "round":
        a.ellipse((62, 62, 96, 100), main, width=5)
        a.ellipse((160, 62, 194, 100), main, width=5)
    elif ear_type == "point":
        a.poly([(76, 85), (88, 42), (106, 88)], main, width=5)
        a.poly([(150, 88), (168, 42), (180, 85)], main, width=5)
    else:
        a.poly([(86, 80), (82, 42), (104, 77)], accent, width=5)
        a.poly([(154, 77), (174, 42), (170, 80)], accent, width=5)
    a.ellipse((86, 118, 170, 196), color_variant(main, 0.18), width=5)
    a.eye_pair(cy=123, dx=25, sleepy=element == "dream")
    a.smile(cy=148)
    a.line_draw([(174, 166), (215, 145), (218, 112)], fill=dark + (255,), width=8)
    a.ellipse((58, 178, 93, 215), dark, width=5)
    a.ellipse((163, 178, 198, 215), dark, width=5)
    add_element_mark(a, element, main, accent)


def draw_fluffy(a, main, dark, accent, rng, element):
    for i in range(10):
        x = 72 + (i % 5) * 26 + rng.randint(-4, 4)
        y = 78 + (i // 5) * 38 + rng.randint(-4, 4)
        a.ellipse((x - 24, y - 24, x + 24, y + 24), color_variant(main, 0.15), width=4)
    a.ellipse((72, 82, 184, 190), main, width=6)
    a.eye_pair(cy=128, dx=25, sleepy=element == "dream")
    a.smile(cy=151)
    a.ellipse((82, 182, 112, 216), dark, width=4)
    a.ellipse((144, 182, 174, 216), dark, width=4)
    if element == "ice":
        a.poly([(126, 48), (138, 70), (126, 91), (114, 70)], accent, width=4)
    add_element_mark(a, element, main, accent)


def draw_dragon(a, main, dark, accent, rng, element):
    a.ellipse((76, 78, 174, 177), main, width=6)
    a.ellipse((98, 110, 194, 205), main, width=6)
    a.poly([(84, 92), (68, 48), (107, 78)], accent, width=5)
    a.poly([(157, 79), (195, 49), (174, 94)], accent, width=5)
    a.poly([(70, 128), (28, 94), (47, 158)], color_variant(main, 0.1), width=5)
    a.poly([(176, 131), (228, 97), (207, 160)], color_variant(main, 0.1), width=5)
    a.line_draw([(183, 176), (223, 190), (217, 220)], fill=dark + (255,), width=8)
    a.eye_pair(cy=119, dx=23)
    a.smile(cy=143)
    for x in (104, 130, 156):
        a.poly([(x, 83), (x + 7, 66), (x + 14, 83)], accent, width=3)
    add_element_mark(a, element, main, accent)


def draw_bird_or_bat(a, main, dark, accent, rng, element, bat=False):
    a.ellipse((83, 72, 173, 178), main, width=6)
    if bat:
        a.poly([(83, 116), (28, 78), (53, 162)], dark, width=5)
        a.poly([(173, 116), (228, 78), (203, 162)], dark, width=5)
        a.poly([(91, 85), (101, 45), (112, 89)], main, width=5)
        a.poly([(145, 89), (156, 45), (166, 85)], main, width=5)
    else:
        a.poly([(85, 118), (31, 104), (61, 166)], color_variant(main, 0.08), width=5)
        a.poly([(171, 118), (225, 104), (195, 166)], color_variant(main, 0.08), width=5)
        a.poly([(118, 118), (138, 118), (128, 135)], accent, width=4)
    a.eye_pair(cy=105, dx=21, sleepy=element == "shadow")
    a.smile(cy=137)
    a.ellipse((90, 170, 116, 210), dark, width=4)
    a.ellipse((140, 170, 166, 210), dark, width=4)
    add_element_mark(a, element, main, accent)


def draw_golem(a, main, dark, accent, rng, element):
    blocks = [
        (82, 62, 174, 118), (65, 116, 191, 178), (86, 176, 124, 220), (132, 176, 170, 220),
        (45, 125, 75, 174), (181, 125, 211, 174)
    ]
    for i, box in enumerate(blocks):
        a.rect(box, color_variant(main, 0.08 if i % 2 else 0), width=5)
    a.eye_pair(cy=97, dx=23)
    a.smile(cy=138)
    if element == "metal":
        a.ellipse((112, 130, 144, 162), accent, width=4)
    else:
        a.poly([(123, 43), (142, 60), (124, 75), (106, 60)], accent, width=4)


def draw_insect(a, main, dark, accent, rng, element):
    a.ellipse((92, 58, 164, 116), main, width=5)
    a.ellipse((75, 108, 181, 190), color_variant(main, 0.08), width=6)
    a.ellipse((86, 166, 170, 224), dark, width=5)
    for x1, x2 in ((83, 37), (173, 219)):
        a.line_draw([(x1, 121), (x2, 98)], width=4)
        a.line_draw([(x1, 153), (x2, 168)], width=4)
    a.line_draw([(105, 64), (82, 36)], width=4)
    a.line_draw([(151, 64), (174, 36)], width=4)
    a.eye_pair(cy=93, dx=19)
    if element in ("lightning", "gold", "gem"):
        a.poly([(126, 130), (139, 152), (126, 175), (113, 152)], accent, width=4)
    add_element_mark(a, element, main, accent)


def draw_aquatic(a, main, dark, accent, rng, element):
    a.ellipse((70, 82, 176, 174), main, width=6)
    a.poly([(174, 126), (222, 90), (212, 157)], color_variant(main, 0.12), width=5)
    a.poly([(92, 88), (116, 45), (137, 88)], accent, width=5)
    a.poly([(108, 175), (75, 212), (126, 198)], dark, width=5)
    a.poly([(145, 174), (181, 211), (134, 198)], dark, width=5)
    a.eye_pair(cy=117, dx=24)
    a.smile(cy=144)
    for i in range(3):
        a.ellipse((44 + i * 18, 52 - i * 8, 57 + i * 18, 65 - i * 8), accent, width=3)
    add_element_mark(a, element, main, accent)


def draw_fairy_or_ghost(a, main, dark, accent, rng, element, ghost=False):
    if ghost:
        a.poly([(82, 68), (174, 68), (193, 147), (174, 214), (148, 196), (128, 220), (108, 196), (82, 214), (63, 147)], main, width=6)
    else:
        a.ellipse((88, 74, 168, 166), main, width=6)
        a.ellipse((45, 80, 100, 152), color_variant(main, 0.3), width=4)
        a.ellipse((156, 80, 211, 152), color_variant(main, 0.3), width=4)
        a.poly([(118, 158), (138, 158), (150, 210), (106, 210)], dark, width=5)
    a.eye_pair(cy=113, dx=22, sleepy=element in ("dream", "shadow"))
    a.smile(cy=140)
    add_element_mark(a, element, main, accent)


def draw_reptile(a, main, dark, accent, rng, element):
    a.ellipse((71, 91, 179, 176), main, width=6)
    a.ellipse((88, 62, 168, 127), main, width=6)
    a.line_draw([(174, 154), (220, 165), (224, 128)], fill=dark + (255,), width=8)
    for x in (92, 118, 144):
        a.poly([(x, 72), (x + 8, 55), (x + 16, 72)], accent, width=3)
    a.eye_pair(cy=98, dx=21)
    a.smile(cy=123)
    a.ellipse((82, 174, 112, 211), dark, width=4)
    a.ellipse((144, 174, 174, 211), dark, width=4)
    add_element_mark(a, element, main, accent)


def draw_plant(a, main, dark, accent, rng, element):
    a.rect((86, 97, 170, 198), dark, width=6)
    a.ellipse((67, 63, 128, 125), main, width=5)
    a.ellipse((128, 63, 189, 125), main, width=5)
    a.ellipse((93, 36, 163, 106), color_variant(main, 0.16), width=5)
    a.eye_pair(cy=125, dx=22)
    a.smile(cy=151)
    a.poly([(119, 89), (134, 63), (149, 90)], accent, width=4)
    add_element_mark(a, element, main, accent)


def draw_humanoid(a, main, dark, accent, rng, element):
    a.ellipse((82, 54, 174, 139), main, width=6)
    a.rect((88, 133, 168, 197), color_variant(main, 0.12), width=6)
    a.ellipse((57, 128, 91, 174), main, width=5)
    a.ellipse((165, 128, 199, 174), main, width=5)
    a.rect((92, 192, 121, 224), dark, width=5)
    a.rect((135, 192, 164, 224), dark, width=5)
    a.eye_pair(cy=96, dx=22, sleepy=element == "dream")
    a.smile(cy=120)
    if element in ("stone", "earth", "metal"):
        a.poly([(101, 67), (83, 37), (126, 60)], accent, width=5)
        a.poly([(155, 67), (173, 37), (130, 60)], accent, width=5)
    add_element_mark(a, element, main, accent)


def draw_mimic(a, main, dark, accent, rng, element):
    a.rect((62, 91, 194, 188), main, width=7)
    a.rect((56, 71, 200, 111), dark, width=7)
    a.rect((116, 90, 140, 132), accent, width=4)
    a.eye_pair(cy=141, dx=28)
    a.line_draw([(90, 166), (166, 166)], fill=(120, 46, 50, 255), width=5)
    for x in range(98, 160, 14):
        a.poly([(x, 166), (x + 7, 178), (x + 14, 166)], (255, 248, 211), width=2)


def draw_mechanical(a, main, dark, accent, rng, element):
    a.rect((79, 75, 177, 178), main, width=6)
    a.ellipse((91, 88, 123, 120), accent, width=4)
    a.ellipse((133, 88, 165, 120), accent, width=4)
    a.rect((98, 137, 158, 163), dark, width=4)
    a.line_draw([(128, 75), (128, 39)], width=4)
    a.ellipse((118, 29, 138, 49), accent, width=4)
    for x in (82, 174):
        a.line_draw([(x, 130), (x - 33 if x < 128 else x + 33, 151)], width=6)
    a.rect((89, 176, 119, 218), dark, width=5)
    a.rect((137, 176, 167, 218), dark, width=5)
    add_element_mark(a, element, main, accent)


def draw_jelly(a, main, dark, accent, rng, element):
    a.ellipse((70, 55, 186, 156), main, width=6)
    a.rect((76, 118, 180, 160), main, width=0, outline=False)
    for i, x in enumerate((86, 112, 138, 164)):
        a.line_draw([(x, 154), (x - 10 + i * 5, 216)], fill=dark + (255,), width=5)
    a.eye_pair(cy=110, dx=24, sleepy=element == "dream")
    a.smile(cy=136)
    add_element_mark(a, element, main, accent)


def draw_undead(a, main, dark, accent, rng, element):
    a.ellipse((79, 58, 177, 148), main, width=6)
    a.rect((91, 137, 165, 201), main, width=6)
    a.eye_pair(cy=99, dx=24)
    for x in (107, 128, 149):
        a.line_draw([(x, 125), (x, 137)], fill=dark + (255,), width=3)
    a.line_draw([(93, 166), (163, 166)], fill=dark + (255,), width=5)
    a.rect((89, 197, 118, 224), dark, width=5)
    a.rect((138, 197, 167, 224), dark, width=5)
    add_element_mark(a, element, main, accent)


DRAWERS = {
    "slime": draw_slime,
    "mammal": draw_mammal,
    "fluffy": draw_fluffy,
    "dragon": draw_dragon,
    "bird": lambda a, m, d, ac, r, e: draw_bird_or_bat(a, m, d, ac, r, e, False),
    "bat": lambda a, m, d, ac, r, e: draw_bird_or_bat(a, m, d, ac, r, e, True),
    "golem": draw_golem,
    "insect": draw_insect,
    "aquatic": draw_aquatic,
    "fairy": lambda a, m, d, ac, r, e: draw_fairy_or_ghost(a, m, d, ac, r, e, False),
    "ghost": lambda a, m, d, ac, r, e: draw_fairy_or_ghost(a, m, d, ac, r, e, True),
    "reptile": draw_reptile,
    "plant": draw_plant,
    "humanoid": draw_humanoid,
    "mimic": draw_mimic,
    "mechanical": draw_mechanical,
    "jelly": draw_jelly,
    "undead": draw_undead,
}


def create_icon(num, name, category, element):
    rng = random.Random(num * 991 + len(name))
    main, dark, accent = PALETTES[element]
    art = Art(256)
    # Ground shadow.
    art.draw.ellipse((67, 204, 189, 228), fill=(0, 0, 0, 36))
    DRAWERS[category](art, main, dark, accent, rng, element)

    # Small ecology detail: rugged but not too busy.
    if category not in ("mechanical", "mimic") and rng.random() < 0.58:
        horn = color_variant(accent, 0.12)
        art.poly([(70, 82), (60, 52), (86, 75)], horn, width=4)
    if rng.random() < 0.55:
        # A few scale/plate marks for the fantasy ecology feel.
        for i in range(rng.randint(2, 4)):
            x = 104 + i * 18 + rng.randint(-4, 4)
            y = 168 + rng.randint(-18, 10)
            art.draw.arc((x, y, x + 18, y + 18), 200, 340, fill=dark + (255,), width=3)
    return art.img


def safe_slug(num, name):
    return f"pet_{num:03d}"


def find_japanese_font(size):
    candidates = [
        "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make_sheet(icons):
    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    cols, rows = 10, 10
    cell = 176
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (246, 247, 242, 255))
    for i, (num, _name, _category, _element, img) in enumerate(icons):
        thumb = img.copy()
        thumb.thumbnail((150, 150), Image.Resampling.LANCZOS)
        x = (i % cols) * cell + (cell - thumb.width) // 2
        y = (i // cols) * cell + (cell - thumb.height) // 2
        sheet.alpha_composite(thumb, (x, y))
    sheet.convert("RGB").save(SHEET_DIR / "pet_visuals_100_sheet.png")

    font = find_japanese_font(14)
    labeled_cell = (220, 238)
    labeled = Image.new("RGBA", (cols * labeled_cell[0], rows * labeled_cell[1]), (246, 247, 242, 255))
    d = ImageDraw.Draw(labeled)
    for i, (num, name, _category, _element, img) in enumerate(icons):
        x0 = (i % cols) * labeled_cell[0]
        y0 = (i // cols) * labeled_cell[1]
        d.rounded_rectangle((x0 + 6, y0 + 6, x0 + labeled_cell[0] - 6, y0 + labeled_cell[1] - 6), radius=10, fill=(255, 255, 255, 255), outline=(214, 218, 210, 255), width=2)
        thumb = img.copy()
        thumb.thumbnail((156, 156), Image.Resampling.LANCZOS)
        labeled.alpha_composite(thumb, (x0 + (labeled_cell[0] - thumb.width) // 2, y0 + 18))
        d.text((x0 + 12, y0 + 181), f"{num:03d}", font=font, fill=(72, 76, 68, 255))
        d.text((x0 + 52, y0 + 181), name, font=font, fill=(20, 24, 22, 255))
    labeled.convert("RGB").save(SHEET_DIR / "pet_visuals_100_sheet_labeled.png")


def visual_prompt(name, category, element):
    category_jp = {
        "slime": "丸いスライム系",
        "fluffy": "もこもこの獣系",
        "bat": "小型の翼獣系",
        "fairy": "小さな妖精系",
        "dragon": "幼い竜・飛竜系",
        "golem": "石や土のゴーレム系",
        "jelly": "空中クラゲ系",
        "mechanical": "からくり機械獣系",
        "mammal": "小型哺乳モンスター系",
        "bird": "鳥型モンスター系",
        "reptile": "トカゲ・爬虫類系",
        "insect": "虫型モンスター系",
        "mimic": "宝箱擬態系",
        "aquatic": "水棲モンスター系",
        "plant": "植物精霊系",
        "ghost": "霊体・影系",
        "humanoid": "小鬼・亜人系",
        "undead": "骨・アンデッド系",
    }[category]
    element_jp = {
        "forest": "森や葉",
        "light": "光",
        "water": "水",
        "fire": "火",
        "earth": "土",
        "star": "星空",
        "metal": "金属",
        "sweet": "お菓子",
        "ice": "氷",
        "wind": "風",
        "dream": "夢",
        "gem": "宝石",
        "gold": "黄金",
        "sand": "砂",
        "mystic": "魔法",
        "flower": "花",
        "shadow": "影",
        "lightning": "雷",
        "bone": "骨",
        "stone": "石",
        "rainbow": "虹",
    }[element]
    return f"{category_jp}。かわいい丸いシルエットに、{element_jp}の素材感や小さな角・鱗・羽などを足したオリジナルのオトモモンスター。"


def write_gallery(icons):
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    md_rows = ["# Growth Quest ペットビジュアル100\n", "かわいい収集モンスター感と、生態・素材感のあるファンタジー獣感を混ぜたオリジナル案です。\n", "| No | 名前 | 画像 | ビジュアル方針 |", "|---:|---|---|---|"]
    for num, name, category, element, _img in icons:
        slug = safe_slug(num, name)
        prompt = visual_prompt(name, category, element)
        rows.append(f"""
        <article class="card">
          <img src="icons/{slug}.png" alt="{num:03d} {name}">
          <div class="meta"><span>{num:03d}</span><strong>{name}</strong></div>
          <p>{prompt}</p>
        </article>
        """)
        md_rows.append(f"| {num} | {name} | `outputs/pet_visuals/icons/{slug}.png` | {prompt} |")
    html = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Growth Quest ペットビジュアル100</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; background: #f5f6f1; color: #20241f; }}
    header {{ padding: 28px 32px 12px; }}
    h1 {{ margin: 0 0 8px; font-size: 28px; }}
    p.lead {{ margin: 0; color: #596154; }}
    main {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; padding: 24px 32px 40px; }}
    .card {{ background: white; border: 1px solid #d9ddd2; border-radius: 8px; padding: 12px; }}
    .card img {{ display: block; width: 144px; height: 144px; object-fit: contain; margin: 0 auto 8px; }}
    .meta {{ display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; }}
    .meta span {{ color: #777f70; font-size: 12px; }}
    .meta strong {{ font-size: 14px; }}
    .card p {{ margin: 0; color: #596154; font-size: 12px; line-height: 1.55; }}
  </style>
</head>
<body>
  <header>
    <h1>Growth Quest ペットビジュアル100</h1>
    <p class="lead">オリジナルのオトモモンスター案。かわいさとファンタジー生態感を両立したラフアイコンです。</p>
  </header>
  <main>
    {''.join(rows)}
  </main>
</body>
</html>
"""
    (OUT / "pet_visual_gallery.html").write_text(html, encoding="utf-8")
    (OUT / "pet_visual_concepts.md").write_text("\n".join(md_rows) + "\n", encoding="utf-8")


def main():
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    icons = []
    for num, name, category, element in PETS:
        img = create_icon(num, name, category, element)
        slug = safe_slug(num, name)
        img.save(ICON_DIR / f"{slug}.png")
        icons.append((num, name, category, element, img))
    make_sheet(icons)
    write_gallery(icons)
    print(OUT)


if __name__ == "__main__":
    main()
