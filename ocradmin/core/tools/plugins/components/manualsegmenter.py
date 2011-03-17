import sys
import ocrolib

from rect import Rectangle



def r2i(rect):
    return ocrolib.iulib.rectangle(rect.x0, rect.y0, rect.x1, rect.y1)

def i2r(rect):
    return Rectangle(rect.x0, rect.y0, rect.x1, rect.y1)


def main_class():
    return SegmentPageManual



class SegmentPageManual(ocrolib.ocropus.ISegmentPage):
    """
    Segment page by providing the co-ordinated of
    each block in a tilde-delimited string.
    """
    def __init__(self):
        """
        Initialise a new object.
        """
        self._regions = ocrolib.RegionExtractor()
        self._segmenter = ocrolib.SegmentPageByRAST1()
        self._params = [
            ["coords", ""],
        ]

    def name(self):
        """
        Short string name.
        """
        return "segmanual"

    def description(self):
        """
        Descriptive string for help etc.
        """
        return "Segment Page by Manual Coordinated."

    def plength(self):
        return len(self._params)

    def pset(self, name, value):
        for i in range(len(self._params)):
            if self._params[i][0] == name:
                self._params[i][1] = value

    def pget(self, name):
        for i in range(len(self._params)):
            if self._params[i][0] == name:
                return self._params[i][1]

    def pname(self, idx):
        return self._params[idx][0]

    def segment(self, page_bin):
        """
        Segment the page using the given coords.
        """
        self.inarray = ocrolib.page2narray(page_bin, type='B')
        self.inverted = ocrolib.iulib.bytearray()
        self.inverted.copy(self.inarray)
        ocrolib.iulib.binary_invert(self.inverted)

        coords = self.get_coords()
        if len(coords) == 0:
            coords.append(Rectangle(0, 0, 
                page_bin.shape[1] - 1, page_bin.shape[0] - 1))
        boxes = {}
        for rect in coords:
            col = ocrolib.iulib.bytearray()
            ocrolib.iulib.extract_subimage(col, self.inarray, *rect.points())
            pout = self.segment_portion(col)
            for key, lines in pout.iteritems():
                if boxes.get(key) is not None:
                    boxes.get(key).extend(lines)
                else:
                    boxes[key] = lines

        encoded = self.encode_boxes(boxes)        
        return ocrolib.narray2pseg(encoded)

    def encode_boxes(self, boxes):
        """
        Encode a pretty pattern.
        """
        lines = boxes.get("lines", [])
        columns = boxes.get("columns", [])
        paragraphs = boxes.get("paragraphs", [])

        colenc = ocrolib.ocropus.ColorEncodeLayout()
        colenc.inputImage.copy(self.inverted)
        colenc.textlines.resize(len(lines))
        for i in range(len(lines)):
            colenc.textlines.put(i, r2i(lines[i]))
        colenc.textcolumns.resize(len(columns))
        for i in range(len(columns)):
            colenc.textcolumns.put(i, r2i(columns[i]))
        colenc.paragraphs.resize(len(paragraphs))
        for i in range(len(paragraphs)):
            colenc.paragraphs.put(i, r2i(paragraphs[i]))
        try:
            colenc.encode()
        except IndexError: pass
        encoded = ocrolib.iulib.intarray()
        encoded.copy(colenc.outputImage)
        return encoded

    def segment_portion(self, portion):
        """
        Segment a single-column chunk.
        """
        portionseg = self._segmenter.segment(ocrolib.narray2numpy(portion))
        return self.extract_boxes(self._regions, portionseg)

    def get_coords(self):
        """
        Return a list of rects from the coords string.
        """
        strlist = self.pget("coords")
        if strlist is None:
            return []
        rstr = strlist.split("~")
        rects = []
        for r in rstr:
            points = r.split(",")
            if len(points) != 4:
                continue
            try:
                ints = [int(i) for i in points]
                rects.append(Rectangle(*ints))
            except ValueError:
                continue
        return rects            

    @classmethod
    def extract_boxes(cls, regions, page_seg):
        """
        Extract line/paragraph geoocrolib.metry info.
        """
        out = dict(columns=[], lines=[], paragraphs=[])
        exfuncs = dict(lines=regions.setPageLines,
                paragraphs=regions.setPageParagraphs)
        for box, func in exfuncs.iteritems():
            func(page_seg)
            for i in range(1, regions.length()):
                out[box].append(Rectangle(regions.x0(i),
                    regions.y0(i), regions.x1(i), regions.y1(i)))
        return out


if __name__ == "__main__":
    inf, outf = sys.argv[1:]
    inarray = ocrolib.iulib.bytearray()
    ocrolib.iulib.read_image_binary(inarray, inf)

    outarray = ocrolib.iulib.intarray()
    hs = SegmentPageManual()
    hs.pset("coords", "0,0,320,480~320,0,640,480")
    tmp2 = hs.segment(ocrolib.narray2numpy(inarray))
    ocrolib.write_page_segmentation(outf, tmp2, white=0)


