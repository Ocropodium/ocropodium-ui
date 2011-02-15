import re


def parse_post_data(postdict):
    """
    Parse options into a dictionary.
    """
    # parse the postdict into a conventient, sorted
    # array of tuples:
    # [(name, value), (name, value)]
    post = []
    for k, v in postdict.iteritems():
        if not k.startswith("$options"):
            continue
        post.append((k, v))
    post.sort()
    paramstruct = _initialise_param_structure(post)
    params = _populate_param_structure(
            post, paramstruct)
    return OcrParameters(params)


def _initialise_param_structure(post):
    """
    Build the initial parameter structure.  TODO: Make this
    less hideous.
    """
    cleaned = dict()
    idxre = re.compile("(?P<base>.+)\[(?P<index>\d+)\]$")
    for name, value in post:
        last = None
        index = None
        lastindex = None
        parts = name.split(".")
        parts.pop(0)
        curr = cleaned
        for part in parts:
            partcopy = part
            indexmatch = idxre.search(part)
            if indexmatch:
                part, _index = indexmatch.groups()
                index = int(_index)
            else:
                index = None
            found = False
            if isinstance(curr, list):
                for item in curr:
                    if item is not None and item["name"] == part:
                        curr = item["value"]
                        found = True
                        break
            else:
                if curr.get("name") == part:
                    curr = curr.get("value")
                    found = True
            if found is False:
                next = [] if index is not None else {}
                if not isinstance(curr, list):
                    curr["name"] = part
                    curr["value"] = next
                    curr = curr["value"]
                else:
                    while len(curr) < lastindex + 1:
                        curr.append(None)
                    curr[lastindex] = dict(name=part, value=next)
                    curr = curr[lastindex]["value"]
            last = partcopy
            lastindex = index
    return cleaned


def _populate_param_structure(post, params):
    """
    Populate the parameter data structure
    with values.
    """
    idxre = re.compile("(?P<base>.+)\[(?P<index>\d+)\]$")
    for name, value in post:
        last = None
        index = None
        lastindex = None
        parts = name.split(".")
        parts.pop(0)
        dest = parts.pop()
        curr = params
        for part in parts:
            partcopy = part
            indexmatch = idxre.search(part)
            if indexmatch:
                part, _index = indexmatch.groups()
                index = int(_index)
            else:
                index = None
            if isinstance(curr, list):
                for item in curr:
                    if item is not None and item["name"] == part:
                        curr = item["value"]
                        break
            else:
                if curr.get("name") == part:
                    curr = curr.get("value")
        if isinstance(curr, list): 
            for param in curr:
                if param is None or param["name"] != dest:
                    continue
                if not isinstance(param["value"], dict):
                    continue
                if len(param["value"]) == 0:
                    param["value"] = value
                break
    return params


class OcrParameters(object):
    """
    Class to access more elegantly access an OCR
    parameters data structure.
    """
    def __init__(self, params):
        """
        Initialise an OCR params object from a 
        parameter structure.
        """
        self._params = params
        self._current = 0

    def attributes(self):
        if isinstance(self._params, list):
            return [p["name"] for p in self._params]
        else:
            return [self._params["name"]]

    def __len__(self):
        if isinstance(self._params, list):
            return len(self._params)
        else:
            return 1

    def parameters(self):
        if isinstance(self._params["value"], list):
            return [OcrParameters(p) for p in self._params["value"]]
        elif isinstance(self._params["value"], dict):
            return OcrParameters(self._params["value"]).parameters()

    def __getitem__(self, index):
        """
        Override indexing if the parameter
        type is a list.
        """
        if not isinstance(self._params, list):
            raise TypeError("'%s' type does not support indexing" %
                    self.__class__.__name__)
        return self._value(self._params[index])

    def __getattr__(self, name):
        """
        Access an attributes object.
        """
        if name == "name":
            return self._params["name"]
        if name == "value":
            return self._params["value"]
        val = None        
        if isinstance(self._params, list):
            for p in self._params:
                if p is not None and p["name"] == name:
                    val = p["value"]
                    break
            if val is None:
                raise AttributeError(name)
        elif isinstance(self._params, dict):
            if self._params["name"] != name:
                # if the child is a dictionary, we can try looking
                # up the attribute in its value set without running]
                # into any ambiguity problems
                return OcrParameters(self._params["value"]).__getattr__(name)
            val = self._params["value"]
        return self._value(val)            

    def _value(self, val):
        if isinstance(val, list):
            return [OcrParameters(p) for p in val]
        if isinstance(val, dict):
            return OcrParameters(val)
        else:
            return val

    def __str__(self):
        return str(self._params)

    def __repr__(self):
        return "<%s: %s>" % (self.__class__.__name__, self._params)


TESTDATA = {'name': u'engine',
 'value': {'name': u'tesseract',
           'value': [{'name': u'binarizer',
                      'value': {'name': u'BinarizeBySauvola',
                                'value': [{'name': u'k', 'value': u'0.3'},
                                          {'name': u'w', 'value': u'40'}]}},
                     {'name': u'binary_preprocessing',
                      'value': [{'name': u'AutoInvert',
                                 'value': [{'name': u'fraction',
                                            'value': u'0.7'},
                                           {'name': u'minheight',
                                            'value': u'100'}]},
                                {'name': u'RmBig',
                                 'value': [{'name': u'max_n',
                                            'value': u'50000'},
                                           {'name': u'maxaspect',
                                            'value': u'30'},
                                           {'name': u'mh',
                                            'value': u'100'},
                                           {'name': u'minaspect',
                                            'value': u'0.03'},
                                           {'name': u'mw',
                                            'value': u'300'}]},
                                {'name': u'RmHalftone',
                                 'value': [{'name': u'factor',
                                            'value': u'3'},
                                           {'name': u'max_n',
                                            'value': u'20000'},
                                           {'name': u'threshold',
                                            'value': u'4'}]}]},
                     {'name': u'language_model',
                      'value': u'Default Tesseract English'},
                     {'name': u'page_segmenter',
                      'value': u'SegmentPageByXYCUTS'}]}}    

TESTPOST = {
    u'$options.engine.tesseract[2].binary_preprocessing[1].RmBig[2].minaspect': u'0.03',
    u'$options.engine.tesseract[2].binary_preprocessing[1].RmBig[0].mh': u'100',
    u'$options.engine.tesseract[2].binary_preprocessing[2].RmHalftone[1].threshold': u'4',
    u'$options.engine.tesseract[2].binary_preprocessing[2].RmHalftone[0].factor': u'3',
    u'$options.engine.tesseract[1].binarizer.BinarizeBySauvola[0].k': u'0.3',
    u'$options.engine.tesseract[3].page_segmenter': u'SegmentPageByXYCUTS',
    u'$options.engine.tesseract[2].binary_preprocessing[2]': u'RmHalftone',
    u'$options.engine.tesseract[2].binary_preprocessing[1].RmBig[4].max_n': u'50000',
    u'$options.engine.tesseract[2].binary_preprocessing[1].RmBig[1].mw': u'300',
    u'$options.engine.tesseract[2].binary_preprocessing[1].RmBig[3].maxaspect': u'30',
    u'$options.engine': [u'tesseract'], u'$options.engine.tesseract[2].binary_preprocessing[0]': u'AutoInvert',
    u'$options.engine.tesseract[2].binary_preprocessing[0].AutoInvert[1].minheight': u'100',
    u'$options.engine.tesseract[2].binary_preprocessing[0].AutoInvert[0].fraction': u'0.7',
    u'$options.engine.tesseract[2].binary_preprocessing[2].RmHalftone[2].max_n': u'20000',
    u'$options.engine.tesseract[1].binarizer.BinarizeBySauvola[1].w': u'40',
    u'$options.engine.tesseract[4].language_model': u'Default Tesseract English',
    u'$options.engine.tesseract[1].binarizer': u'BinarizeBySauvola',
    u'$options.engine.tesseract[2].binary_preprocessing[1]': u'RmBig'
}

