#!/usr/bin/python



class Rectangle(object):
    """
    Rectangle class, Iulib-style.
    """
    def __init__(self, x0, y0, x1, y1):
        """
        Initialise a rectangle.
        """
        self.x0 = x0
        self.y0 = y0
        self.x1 = x1
        self.y1 = y1

    def __repr__(self):
        return "<Rectangle: %d %d %d %d>" % (
                self.x0,
                self.y0,
                self.x1,
                self.y1
        )

    def __eq__(self, rect):
        return self.x0 == rect.x0 and self.y0 == rect.y0 \
                and self.x1 == rect.x1 and self.y1 == rect.y1

    def __ne__(self, rect):
        return self.x0 != rect.x0 or self.y0 != rect.y0 \
                or self.x1 != rect.x1 or self.y1 != rect.y1

    def aspect(self):
        if self.empty():
            return 1
        return float(self.width()) / float(self.height())

    def area(self):
        if self.empty():
            return 0
        return self.width() * self.height()

    def clone(self):
        return Rectangle(self.x0, self.y0, self.x1, self.y1)

    def empty(self):
        return self.x0 >= self.x1 and self.y0 >= self.y1

    def pad_by(self, dx, dy):
        assert(not self.empty())
        self.x0 -= dx
        self.y0 -= dy
        self.x1 += dx
        self.y0 += dy

    def shift_by(self, dx, dy):
        assert(not self.empty())
        self.x0 += dx
        self.y0 += dy
        self.x1 += dx
        self.y0 += dy

    def width(self):
        return max(0, self.x1 - self.x0)

    def height(self):
        return max(0, self.y1 - self.y0)

    def include_point(self, x, y):
        if self.empty():
            self.x0 = x
            self.y0 = y
            self.x1 = x + 1
            self.y1 = y + 1
        else:
            self.x0 = min(x, self.x0)
            self.y0 = min(y, self.y0)
            self.x1 = max(x + 1, self.x1)
            self.y1 = max(y + 1, self.y1)

    def include(self, rect):
        if self.empty():
            self.x0 = rect.x0
            self.y0 = rect.y0
            self.x1 = rect.x1
            self.y1 = rect.y1
        else:
            self.x0 = min(self.x0, rect.x0)
            self.y0 = min(self.y0, rect.y0)
            self.x1 = max(self.x1, rect.x1)
            self.y1 = max(self.y1, rect.y1)

    def grow(self, dx, dy):
        return Rectangle(self.x0 - dx, self.y0 - dy, 
                self.x1 + dx, self.y1 + dy)

    def overlaps(self, rect):
        return self.x0 <= rect.x1 and self.x1 >= rect.x0 \
                and self.y0 <= rect.y1 and self.y1 >= rect.y0

    def overlaps_x(self, rect):
        return self.x0 <= rect.x1 and self.x1 >= rect.x0

    def overlaps_y(self, rect):
        return self.y0 <= rect.y1 and self.y1 >= rect.y0

    def contains(self, x, y):
        return x >= self.x0 and x < self.x1 \
                and y >= self.y0 and y < self.y1

    def points(self):
        return (self.x0, self.y0, self.x1, self.y1,)

    def intersection(self, rect):
        if self.empty():
            return self
        return Rectangle(
                max(self.x0, rect.x0),
                max(self.y0, rect.y0),
                min(self.x1, rect.x1),
                min(self.y1, rect.y1)
        )                

    def inclusion(self, rect):
        if self.empty():
            return rect
        return Rectangle(
                min(self.x0, rect.x0),
                min(self.y0, rect.y0),
                max(self.x1, rect.x1),
                max(self.y1, rect.y1)
        ) 
    
    def fraction_covered_by(self, rect):
        isect = self.intersection(rect)
        if self.area():
            return isect.area() / float(self.area())
        else:
            return -1

    @classmethod
    def union_of(cls, *args):
        r = Rectangle(0, 0, 0, 0)
        for arg in args:
            r.include(arg)
        return r            




