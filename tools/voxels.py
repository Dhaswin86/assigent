#!/usr/bin/env python3
"""Build the five agent characters as isometric voxel SVGs.

Run: python3 tools/voxels.py   (writes site/img/agents/*.svg)

Axes: x runs to the right-front, y to the left-front (the character's face), z up.
Only the three faces the camera sees are drawn, and only where no voxel covers them.
"""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'site', 'img', 'agents')
S = 10                       # voxel edge in SVG units
CX, CY = math.cos(math.pi / 6) * S, math.sin(math.pi / 6) * S


def shade(hex_, f):
    """f > 1 lightens towards white, f < 1 darkens."""
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    if f >= 1:
        t = f - 1
        r, g, b = (round(c + (255 - c) * t) for c in (r, g, b))
    else:
        r, g, b = (round(c * f) for c in (r, g, b))
    return '#%02x%02x%02x' % (r, g, b)


class Model:
    def __init__(self):
        self.v = {}

    def box(self, x0, y0, z0, x1, y1, z1, c):
        for x in range(x0, x1):
            for y in range(y0, y1):
                for z in range(z0, z1):
                    self.v[(x, y, z)] = c

    def dot(self, x, y, z, c):
        self.v[(x, y, z)] = c

    def clear(self, x0, y0, z0, x1, y1, z1):
        for x in range(x0, x1):
            for y in range(y0, y1):
                for z in range(z0, z1):
                    self.v.pop((x, y, z), None)

    def svg(self):
        def p(x, y, z):
            return ((x - y) * CX, (x + y) * CY - z * S)

        polys = []
        for (x, y, z) in sorted(self.v, key=lambda k: (k[0] + k[1] + k[2], k[2])):
            c = self.v[(x, y, z)]
            # a voxel further along the view diagonal covers this one exactly
            if any((x + k, y + k, z + k) in self.v for k in range(1, 40)):
                continue
            faces = []
            if (x, y, z + 1) not in self.v:   # top
                faces.append(([p(x, y, z + 1), p(x + 1, y, z + 1), p(x + 1, y + 1, z + 1), p(x, y + 1, z + 1)], shade(c, 1.16)))
            if (x, y + 1, z) not in self.v:   # front (left on screen)
                faces.append(([p(x, y + 1, z), p(x + 1, y + 1, z), p(x + 1, y + 1, z + 1), p(x, y + 1, z + 1)], c))
            if (x + 1, y, z) not in self.v:   # side (right on screen)
                faces.append(([p(x + 1, y, z), p(x + 1, y + 1, z), p(x + 1, y + 1, z + 1), p(x + 1, y, z + 1)], shade(c, .8)))
            polys += faces

        xs = [pt[0] for f, _ in polys for pt in f]
        ys = [pt[1] for f, _ in polys for pt in f]
        pad = 6
        minx, maxx, miny, maxy = min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad + 8
        # soft floor shadow under the feet
        fx = [p(x, y, 0) for (x, y, z) in self.v if z == 0]
        sx = sum(a for a, _ in fx) / len(fx)
        sy = max(b for _, b in fx) - CY * 1.5
        out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="%.1f %.1f %.1f %.1f">' % (minx, miny, maxx - minx, maxy - miny),
               '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="#000" opacity=".14"/>' % (sx, sy + 4, 6 * CX, 6 * CY)]
        by_col = []
        for pts, col in polys:
            d = 'M' + 'L'.join('%.1f %.1f' % pt for pt in pts) + 'Z'
            if by_col and by_col[-1][0] == col:
                by_col[-1][1].append(d)
            else:
                by_col.append([col, [d]])
        for col, ds in by_col:
            out.append('<path fill="%s" stroke="%s" stroke-width=".5" stroke-linejoin="round" d="%s"/>' % (col, col, ''.join(ds)))
        out.append('</svg>')
        return '\n'.join(out)


SKIN = '#f0a07c'
EYE = '#2b211c'
BLUSH = '#ec7f72'
SHOE = '#5b4636'
WHITE = '#f6f1e8'


def buddy(shirt):
    """The shared body: blocky critter with a big head, facing +y."""
    m = Model()
    m.box(2, 2, 0, 4, 5, 2, SHOE)              # legs
    m.box(6, 2, 0, 8, 5, 2, SHOE)
    m.box(1, 1, 2, 9, 6, 7, shirt)             # body
    m.box(0, 2, 3, 1, 5, 7, shirt)             # arms
    m.box(9, 2, 3, 10, 5, 7, shirt)
    m.box(0, 2, 2, 1, 5, 3, SKIN)              # hands
    m.box(9, 2, 2, 10, 5, 3, SKIN)
    m.box(0, 0, 7, 10, 8, 14, SKIN)            # head
    m.box(-1, 2, 11, 0, 5, 14, SKIN)           # ears
    m.box(10, 2, 11, 11, 5, 14, SKIN)
    m.box(3, 8, 8, 7, 9, 10, shade(SKIN, .92))   # snout
    m.dot(4, 8, 9, shade(SKIN, .72)); m.dot(5, 8, 9, shade(SKIN, .72))   # nostrils
    for x in (2, 7):                           # eyes
        m.box(x, 7, 10, x + 1, 8, 12, EYE)
    m.dot(1, 7, 9, BLUSH); m.dot(8, 7, 9, BLUSH)
    return m


def analyst():
    c = '#c2410c'
    m = buddy(c)
    m.box(-1, -1, 14, 11, 9, 15, shade(c, 1.1))        # cap
    m.box(0, 0, 15, 10, 8, 17, c)
    m.box(1, 8, 14, 9, 11, 15, shade(c, .9))          # visor
    m.box(2, 7, 2, 8, 8, 7, '#8a5a3c')                # clipboard
    m.box(3, 8, 3, 7, 9, 7, WHITE)
    m.box(4, 8, 7, 6, 9, 8, '#9aa3ad')
    for z in (4, 6):
        m.dot(3, 9, z, '#15803d'); m.box(4, 9, z, 7, 10, z + 1, '#7b8794')
    return m


def source_finder():
    c = '#2563eb'
    m = buddy(c)
    m.box(-1, -1, 14, 11, 9, 15, shade(c, .85))       # beanie
    m.box(0, 0, 15, 10, 8, 17, c)
    m.box(4, 3, 17, 6, 5, 18, WHITE)                  # pom-pom
    for x in (1, 6):                                  # glasses
        m.box(x, 8, 10, x + 3, 9, 13, '#1f2937')
        m.clear(x + 1, 8, 11, x + 2, 9, 12)
    m.box(4, 8, 12, 6, 9, 13, '#1f2937')
    m.box(1, 7, 3, 5, 9, 7, '#1e3a8a')                # open book
    m.box(5, 7, 3, 9, 9, 7, '#1e3a8a')
    m.box(1, 9, 4, 4, 10, 7, WHITE)
    m.box(6, 9, 4, 9, 10, 7, WHITE)
    return m


def builder():
    c = '#7c3aed'
    m = buddy(c)
    y = '#f2c94c'
    m.box(-1, -1, 14, 11, 10, 15, y)                  # hard hat with brim
    m.box(0, 0, 15, 10, 8, 17, shade(y, .95))
    m.box(4, 0, 17, 6, 8, 18, shade(y, .85))
    m.box(-1, 7, 0, 11, 11, 3, '#8a5a3c')             # desk
    m.box(0, 7, 3, 10, 11, 4, '#a9744f')
    m.box(2, 9, 4, 8, 11, 5, '#9aa3ad')               # laptop base
    m.box(2, 9, 5, 8, 10, 9, '#374151')               # back of the screen
    m.box(4, 10, 6, 6, 11, 8, c)                      # sticker
    return m


def evaluator():
    c = '#15803d'
    m = buddy(c)
    m.box(1, 1, 14, 9, 7, 16, '#1f2937')              # mortarboard-ish visor cap
    m.box(-1, -1, 16, 11, 9, 17, '#111827')
    m.box(4, 3, 17, 6, 5, 18, '#fbbf24')
    m.box(0, 8, 1, 10, 9, 8, WHITE)                   # marked paper
    tick = [(2, 5), (3, 4), (4, 3), (5, 4), (6, 5), (7, 6), (8, 7)]
    for x, z in tick:
        m.dot(x, 9, z, '#16a34a')
    return m


def tutor():
    c = '#d97706'
    m = buddy(c)
    m.box(-1, -1, 14, 11, 9, 15, shade(c, .8))       # band
    m.box(0, 0, 15, 10, 8, 16, c)
    g = '#fde68a'                                     # lightbulb over the head
    m.box(3, 2, 19, 7, 6, 23, g)
    m.box(4, 3, 23, 6, 5, 24, g)
    m.box(4, 3, 18, 6, 5, 19, '#9aa3ad')
    m.box(4, 3, 17, 6, 5, 18, shade('#9aa3ad', .8))
    m.box(10, 3, 2, 11, 4, 12, '#8a5a3c')             # pointer stick in the right hand
    m.dot(10, 3, 12, '#ef4444')
    return m


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [('analyst', analyst), ('source-finder', source_finder), ('builder', builder), ('evaluator', evaluator), ('tutor', tutor)]:
        path = os.path.join(OUT, name + '.svg')
        with open(path, 'w') as f:
            f.write(fn().svg())
        print(name, os.path.getsize(path))
