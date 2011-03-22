#!/usr/bin/python

import os
import sys
from optparse import OptionParser

import iulib
import ocropus
import ocrolib

import pylab as P
import numpy

from rect import Rectangle


def r2i(rect):
    return iulib.rectangle(rect.x0, rect.y0, rect.x1, rect.y1)

def i2r(rect):
    return Rectangle(rect.x0, rect.y0, rect.x1, rect.y1)


def smooth(x,window_len=11,window='hanning'):
    """smooth the data using a window with requested size.
    
    This method is based on the convolution of a scaled window with the signal.
    The signal is prepared by introducing reflected copies of the signal 
    (with the window size) in both ends so that transient parts are minimized
    in the begining and end part of the output signal.
    
    input:
        x: the input signal 
        window_len: the dimension of the smoothing window; should be an odd integer
        window: the type of window from 'flat', 'hanning', 'hamming', 'bartlett', 'blackman'
            flat window will produce a moving average smoothing.

    output:
        the smoothed signal
        
    example:

    t=linspace(-2,2,0.1)
    x=sin(t)+randn(len(t))*0.1
    y=smooth(x)
    
    see also: 
    
    numpy.hanning, numpy.hamming, numpy.bartlett, numpy.blackman, numpy.convolve
    scipy.signal.lfilter
 
    TODO: the window parameter could be the window itself if an array instead of a string   
    """

    if x.ndim != 1:
        raise ValueError, "smooth only accepts 1 dimension arrays."
    if x.size < window_len:
        raise ValueError, "Input vector needs to be bigger than window size."
    if window_len<3:
        return x
    if not window in ['flat', 'hanning', 'hamming', 'bartlett', 'blackman']:
        raise ValueError, "Window is on of 'flat', 'hanning', 'hamming', 'bartlett', 'blackman'"

    s=numpy.r_[2*x[0]-x[window_len:1:-1],x,2*x[-1]-x[-1:-window_len:-1]]
    #print(len(s))
    if window == 'flat': #moving average
        w=numpy.ones(window_len,'d')
    else:
        w=eval('numpy.'+window+'(window_len)')

    y=numpy.convolve(w/w.sum(),s,mode='same')
    return y[window_len-1:-window_len+1]


def not_char(rect):
    """
    Perform basic validation on a rect to
    test if it *could* be a character box.
    """
    return rect.area() < 4 or rect.area() > 10000 \
            or rect.aspect() < 0.2 or rect.aspect() > 5


def horizontal_overlaps(rect, others, sorted=False):
    """
    Get rects that overlap horizontally with the
    given rect.
    """
    overlaps = []
    for other in others:
        # Note: can optimise to prevent
        # going through the rest of the
        # array when we hit a non match
        if rect.overlaps_y(other):
            overlaps.append(other)
    return overlaps


def get_average_line_height(top_bottoms):
    """
    Tricksy - get height of median line?
    """
    lheights = [b - t for t, b in top_bottoms] 
    lhm = numpy.max(lheights)
    def weight(val):
        return 0 if val < (lhm / 2) else 1
    weights = numpy.vectorize(weight)(lheights)
    return numpy.average(numpy.array(lheights), weights=weights)


def remove_border(narray, average_char_height):
    """
    Try and remove anything that's in a likely
    border region and return the subimage.    
    """
    na = iulib.numpy(narray)
    hpr = na.sum(axis=0)
    vpr = na.sum(axis=1)
    hhp = high_pass_median(hpr, 5.0 / average_char_height)
    vhp = high_pass_median(vpr, 5.0 / average_char_height)

    vidx = vhp.nonzero()[0]
    hidx = hhp.nonzero()[0]

    b = iulib.bytearray()
    iulib.extract_subimage(b, narray, int(vidx[0]), int(hidx[0]),
            int(vidx[-1]), int(hidx[-1]))
    return b




def get_vertical_projection(narray):
    """
    Accumulate image columns.
    """
    return iulib.numpy(narray).sum(axis=1)


def get_horizontal_projection(narray):
    """
    Accumulate image rows.
    """
    return iulib.numpy(narray).sum(axis=0)


def high_pass_max(numpy_arr, maxscale):
    """
    Remove everything below 1/2 of the median
    value.
    """
    # remove noise
    max = numpy.max(numpy_arr)
    def hp(x, m):
        return 0 if x < m else x
    return numpy.vectorize(hp)(numpy_arr, max * maxscale) 


def high_pass_median(numpy_arr, medscale):
    """
    Remove everything below 1/2 of the median
    value.
    """
    # remove noise
    median = numpy.median(numpy_arr)
    def hp(x, m):
        return 0 if x < m else x
    return numpy.vectorize(hp)(numpy_arr, median * medscale) 


def get_lines_by_projection(narray):
    """
    Extract regions of blackness.
    """
    hpr = iulib.numpy(narray).sum(axis=0)
    hps = high_pass_max(hpr, 0.001)

    regions = []
    gotline = None
    count = 0
    for val in hps:
        if val != 0:
            if gotline is None:
                gotline = count                
        else:
            if not gotline is None:
                regions.append((gotline, count))
                gotline = None
        count += 1
    return regions                


def large_or_odd(rect, avg):
    """
    An odd shape.
    """
    return rect.area() > (100 * avg * avg)  or rect.aspect() < 0.2 \
            or rect.aspect() > 10


def strip_non_chars(narray, bboxes, average_height, inverted=True):
    """
    Remove stuff that isn't looking like a character box.
    """
    outboxes = []
    color = 0 if inverted else 255
    for box in bboxes:
        if large_or_odd(box, average_height):
            iulib.fill_rect(narray, box.x0, box.y0, box.x1, box.y1, color)
        else:
            outboxes.append(box)
    return outboxes            
    

def trimmed_mean(numpy_arr, lperc=0, hperc=0):
    """
    Get a trimmed mean value from array, with low and
    high percentage ignored.
    """
    alen = len(numpy_arr)
    return numpy_arr[(alen / 100 * lperc):
            (alen - (alen / 100 * hperc))].mean()
        


def main_class():
    return SegmentPageByHint



class SegmentPageByHint(ocropus.ISegmentPage):
    """
    Segment with a hint.
    """
    def __init__(self):
        """
        Initialise a new HintSegmenter
        """
        self._params = [
            ["toplines", "0"],
            ["columns", "1"],
        ]

    def name(self):
        """
        Short string name.
        """
        return "seghint"

    def description(self):
        """
        Descriptive string for help etc.
        """
        return "Segment Page by Hint."

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
                
    def init(self):
        """
        Initialise on receipt of the input.
        """
        # pointer to the region that remains
        # to be segmented - starts at the top
        self.topptr = self.inarray.dim(1)
        
        # obtain an inverted version of the array
        self.inverted = iulib.bytearray()
        self.inverted.copy(self.inarray)        
        iulib.binary_invert(self.inverted)
        self.calc_bounding_boxes()

        # list of extracted line rectangles
        self.textlines = []
        self.columns = []

    def calc_bounding_boxes(self):
        """
        Get bounding boxes if connected components.
        """
        concomps = iulib.intarray()
        concomps.copy(self.inverted)
        iulib.label_components(concomps, False)
        bboxes = iulib.rectarray()
        iulib.bounding_boxes(bboxes, concomps)
        self.boxes = []
        for i in range(bboxes.length()):
            if bboxes.at(i).area() > (self.inverted.dim(0) *
                    self.inverted.dim(1) * 0.95):
                continue
            self.boxes.append(i2r(bboxes.at(i)))

        # get the average text height, excluding  any %%
        self.avgheight = trimmed_mean(numpy.sort(numpy.array(
            [r.height() for r in self.boxes])), 5, 5)

        # remove large or weird boxes from the inverted images
        self.boxes = strip_non_chars(self.inverted, self.boxes, self.avgheight)


    def get_char_boxes(self, boxes):
        """
        Get character boxes.
        """
        return [b for b in boxes if not not_char(b)] 


    def get_header_line(self):
        """
        Get the first found line in an image.
        """
        boxes = self.get_char_boxes(self.boxes)
        # eliminate boxes above our top-of-the-page
        # pointer
        boxes = [b for b in boxes if b.y1 <= self.topptr]
        
        # order boxes by y0 (distance from bottom)
        boxes.sort(lambda x, y: cmp(x.y1, y.y1))
        # reverse so those nearest the top are first
        boxes.reverse()

        # get rects with overlap horizontally with
        # the topmost one
        # try a maximum of 20 lines until we find one with at least
        # 5 overlaps
        overlaps = []
        maxcnt = 0
        line = Rectangle(0, 0, 0, 0)
        while maxcnt < 200 and (len(overlaps) < 2 \
                or line.height() < (self.avgheight * 1.5)):
            overlaps = horizontal_overlaps(
                    boxes[maxcnt], boxes, sorted=False) 
            line = Rectangle.union_of(*overlaps)
            maxcnt += 1

        self.textlines.append(line)

        # set region of interest to below the top line
        self.topptr = line.y0


    def segment(self, page_bin):
        """
        Segment an image array.
        """
        self.inarray = ocrolib.page2narray(page_bin, type='B')
        self.init()

        for topline in range(int(self.pget("toplines"))):
            self.get_header_line()
        self.columns.append(Rectangle.union_of(*self.textlines))
        self.find_columns()
        self.find_lines()
        page_seg = iulib.intarray()
        self.encode_lines(page_seg)
        self.draw_rects(page_seg, self.textlines)
        return ocrolib.narray2pseg(page_seg)


    def get_possible_columns(self, projection):
        """
        Extract regions of whiteness.
        """
        regions = []
        gotcol = None
        count = 0
        for val in projection:
            if count == len(projection) - 1 and gotcol is not None:
                regions.append(Rectangle(gotcol, 0, count, self.topptr))
            elif val != 0:
                if gotcol is None:
                    gotcol = count                
            else:
                if not gotcol is None:
                    regions.append(Rectangle(gotcol, 0, count, self.topptr))
                    gotcol = None
            count += 1
        return regions


    def filter_columns(self, rects, target):
        """
        Filter a group of regions to match the target
        number, preserving those which seem the most
        likely to be 'good'
        """
        if len(rects) <= target:
            return rects

        # add the x largest cols
        best = []
        for col in sorted(rects, lambda x, y: cmp(y.area(), x.area())):
            best.append(col)
            if len(best) == target:
                break
        return best            


    def find_columns(self):
        """
        Get columns in a section of the image
        """

        portion = iulib.bytearray()
        iulib.extract_subimage(portion, self.inverted, 0, 0, 
                self.inverted.dim(0), self.topptr)
        projection = high_pass_median(iulib.numpy(portion).sum(axis=1), 0.20)
        posscols = self.get_possible_columns(projection)
        bestcols = self.filter_columns(posscols, int(self.pget("columns")))
        self.columns.extend(bestcols)

    def find_lines(self):
        """
        Get lines in a section of the images.
        """
        #segout = iulib.intarray()
        #segout.copy(self.inarray)

        for colrect in self.columns:
            newrect = Rectangle(colrect.x0, 0, colrect.x1, self.topptr)
            if newrect.area() < 1:
                continue
            portion = iulib.bytearray()
            iulib.extract_subimage(portion, self.inverted, *newrect.points())
            regions = get_lines_by_projection(portion)
            plines = []
            for bottom, top in regions:
                height = top - bottom
                if height - self.avgheight < self.avgheight / 2:
                    continue
                plines.append(Rectangle(colrect.x0, bottom, colrect.x1, top))
                #self.textlines.extend(plines)


            cpline = None
            clline = Rectangle(0, 0, 0, 0)
            charboxes = self.get_char_boxes(self.boxes)
            colboxes = [b for b in charboxes \
                    if b.overlaps(colrect.grow(10, 10))]
            colboxes.sort(lambda x, y: cmp(x.y1, y.y1))
            colboxes.reverse()

            clines = []
            for p in plines:
                clines.append(Rectangle(0, 0, 0, 0))

            while colboxes:
                char = colboxes.pop(0)
                cline = Rectangle(0, 0, 0, 0)
                for i in range(len(plines)):
                    pline = plines[i]
                    if char.overlaps(pline):
                        clines[i].include(char)
            self.textlines.extend(clines)
            


    def encode_lines2(self, encoded):
        """
        Encode output file.
        """
        encoded.copy(self.inarray)
        colcolour = 0x00010000
        colour = 1
        #self.textlines.sort(lambda x, y: cmp(x.x0, y.x0))        

        for rect in self.textlines:
            for j in range(len(self.columns)):
                col = self.columns[j]
                if rect.overlaps(col):
                    break
            colcolour = (j + 1) << 16
            for x in range(rect.x0, rect.x1):
                for y in range(rect.y0, rect.y1):
                    if self.inarray.at(x, y) == 0:
                        encoded.put(x, y, (colour | colcolour))
            colour += 1
        return encoded                


    def encode_lines(self, encoded):
        """
        Encode output.
        """
        colenc = ocropus.ColorEncodeLayout()
        colenc.inputImage.copy(self.inverted)
        colenc.textlines.resize(len(self.textlines))
        for i in range(len(self.textlines)):
            colenc.textlines.put(i, r2i(self.textlines[i]))
        colenc.textcolumns.resize(len(self.columns))
        colenc.paragraphs.resize(len(self.columns))
        for i in range(len(self.columns)):
            colenc.textcolumns.put(i, r2i(self.columns[i]))
            colenc.paragraphs.put(i, r2i(self.columns[i]))
        colenc.encode()
        encoded.copy(colenc.outputImage)
        return encoded


    def draw_rects(self, image, rects):
        """
        Highlight the end results.
        """
        for rect in rects:
            self.draw_rect(image, rect)


    def draw_rect(self, image, rect, colour=0x00FF4444):
        try:
            for i in range(rect.x0, rect.x1):
                image.put(i, rect.y0, colour)
                image.put(i, rect.y1, colour)
            for i in range(rect.y0, rect.y1):
                image.put(rect.x0, i, colour)
                image.put(rect.x1, i, colour)
        except IndexError:
            pass




if __name__ == "__main__":
    inf, outf = sys.argv[1:]
    inarray = iulib.bytearray()
    iulib.read_image_binary(inarray, inf)

    outarray = iulib.intarray()
    hs = SegmentPageByHint()
    hs.pset("toplines", 1)
    hs.pset("columns", 2)
    tmp2 = hs.segment(ocrolib.narray2numpy(inarray))
    ocrolib.write_page_segmentation(outf, tmp2, white=0)

