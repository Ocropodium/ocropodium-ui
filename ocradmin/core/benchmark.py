import time
import utils


def test_simple_binarize():
    """
    Test the Ocropus native binarizer.
    """
    start = time.clock()
    wrap = utils.OcropusWrapper(params={"clean": "StandardPreprocessing"})
    bin = wrap.get_page_binary("21.png")
    return time.clock() - start


def test_sp_binarize():
    """
    Test custom Python StandardPreprocessing.
    """
    start = time.clock()
    wrap = utils.OcropusWrapper()
    gray, bin = wrap.standard_preprocess("21.png")
    return time.clock() - start




if __name__ == "__main__":
    
    simple = sum([test_simple_binarize() for i in range(0, 5)]) / 5.0
    bespoke = sum([test_sp_binarize() for i in range(0, 5)]) / 5.0 

    print "Simple:  %03f secs" % simple
    print "Bespoke: %03f secs" % bespoke


