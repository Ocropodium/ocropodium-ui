import re


INDEX_REGEXP = re.compile("(?P<base>.+)\[(?P<index>\d+)\]$")

def parse_post_data(postdict):
    """
    Parse POST data into a params structure.
    """
    # parse the postdict into a conventient, sorted
    # array of tuples:
    # [(name, value), (name, value)]
    post = []
    for k, v in postdict.iteritems():
        if not k.startswith(("$", "@", "%")):
            continue
        post.append((k, v))
    post.sort()
    paramstruct = _initialise_param_structure(post)
    params = _populate_param_structure(
            post, paramstruct)
    return params


def _initialise_param_structure(post):
    """
    Build the initial parameter structure.  TODO: Make this
    less hideous.
    """
    cleaned = dict()
    for name, value in post:
        last = None
        index = None
        lastindex = None
        parts = name.split(".")
        parts.pop(0)
        parts.pop(0)
        curr = cleaned
        for part in parts:
            partcopy = part
            indexmatch = INDEX_REGEXP.search(part)
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
    for name, value in post:
        last = None
        index = None
        lastindex = None
        parts = name.split(".")
        if len(parts) < 3:
            continue
        parts.pop(0)
        parts.pop(0)
        dest = parts.pop()
        curr = params
        for part in parts:
            partcopy = part
            indexmatch = INDEX_REGEXP.search(part)
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
        if not isinstance(curr, list): 
            continue
        for param in curr:
            if param is None or param["name"] != dest:
                continue
            if not isinstance(param["value"], dict):
                continue
            if len(param["value"]) == 0:
                if name.startswith("$"):
                    param["value"] = value
                else:
                    param["value"] = dict(
                            name=value, value=[])
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
        if isinstance(val, unicode):
            return val.encode()
        else:
            return val

    def __str__(self):
        return str(self._params)

    def __repr__(self):
        return "<%s: %s>" % (self.__class__.__name__, self._params)


    @classmethod
    def from_parameters(cls, options):
        """
        Parse an options structure into an OcrParameters
        object
        """
        return OcrParameters(cls._parameter_from_option(options))


    @classmethod
    def from_post_data(cls, post):
        """
        Parse an object from post data.
        """
        return OcrParameters(parse_post_data(post))


    @classmethod
    def _parameter_from_option(cls, option):
        param = {}
        param["name"] = option.get("name")
        param["value"] = None
        optparams = option.get("parameters")
        if isinstance(optparams, list):
            param["value"] = [
                cls._parameter_from_option(p) for p in optparams]
        else:
            choices = option.get("choices")
            default = option.get("value")
            if option.get("multiple") and choices is not None:
                param["value"] = []
                if default is not None:
                    for value in default:
                        for choice in choices:
                            if choice.get("name") == value:
                                param["value"].append(
                                        cls._parameter_from_option(choice))
                elif len(choices):
                    param["value"].append(cls._parameter_from_option(choices[0]))
            elif choices is not None:
                if default is not None:
                    for choice in choices:
                        if choice.get("name") == default:
                            param["value"] = cls._parameter_from_option(choice)
                            break
                elif len(choices):
                    param["value"] = cls._parameter_from_option(choices[0])
            elif default is not None:
                param["value"] = default
        return param                        

        


TESTDATA = {'name': u'tesseract',
    'value': [
        {
            'name': u'binarizer',
            'value': {
                'name': u'BinarizeBySauvola',
                'value': [
                    {
                        'name': u'k',
                        'value': u'0.3'
                    }, {
                        'name': u'w',
                        'value': u'40'
                    }
                ]
            }
        }, {
            'name': u'binary_preprocessing',
            'value': [
                {
                    'name': u'AutoInvert',
                    'value': [
                        {
                            'name': u'fraction',
                            'value': u'0.7'
                        }, {
                            'name': u'minheight',
                            'value': u'100'
                        }
                    ]
                }, {
                    'name': u'RmBig',
                    'value': [
                        {
                            'name': u'max_n',
                            'value': u'50000'
                        }, {
                            'name': u'maxaspect',
                            'value': u'30'
                        }, {
                            'name': u'mh',
                            'value': u'100'
                        }, {
                            'name': u'minaspect',
                            'value': u'0.03'
                        }, {
                            'name': u'mw',
                            'value': u'300'
                        }
                    ]
                }, {
                    'name': u'RmHalftone',
                    'value': [
                        {
                            'name': u'factor',
                            'value': u'3'
                        }, {
                            'name': u'max_n',
                            'value': u'20000'
                        }, {
                            'name': u'threshold',
                            'value': u'4'
                        }
                    ]
                }
            ]
        }, {
            'name': u'language_model',
            'value': u'Default Tesseract English'
        }, {
            'name': u'page_segmenter',
            'value': u'SegmentPageByXYCUTS'
        }
    ]
}



TESTPARAMS = {
    'name': 'tesseract',
    'description': 'Available configuration for OCR settings',    
    'parameters': [
        {
            'name': 'grayscale_preprocessing',
            'description': 'Greyscale Preprocessor',
            'multiple': True,
            'help': 'Filters for preprocessing greyscale images',
            'choices': [],
        }, {
            'name': 'binarizer',
            'description': 'Binarizer',
            'multiple': False,
            'value': 'BinarizeBySauvola',
            'help': 'Filter for binarizing greyscale images',
            'choices': [
                {
                    'type': 'IBinarize',
                    'name': 'BinarizeByHT',
                    'parameters': [
                        {
                            'choices': None,
                            'name': 'k0',
                            'value': '0.2',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'k1',
                            'value': '0.6',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'width',
                            'value': '40',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'max_n',
                            'value': '50000',
                            'description': ''
                        }
                    ],
                    'description': 'binarization by hysteresis thresholding'
                }, {
                    'type': 'IBinarize',
                    'name': 'BinarizeByOtsu',
                    'parameters': [],
                    'description': 'An implementation of Otsu\'s binarization algorithm.'
                }, {
                    'type': 'IBinarize',
                    'name': 'BinarizeByRange',
                    'parameters': [],
                    'description': 'binarize by thresholding the range between min(image) and max(image)'
                }, {
                    'type': 'IBinarize',
                    'name': 'BinarizeBySauvola',
                    'parameters': [
                        {
                            'choices': None,
                            'name': 'k',
                            'value': '0.3',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'w',
                            'value': '40',
                            'description': ''
                        }
                    ],
                    'description': 'An efficient implementation of the Sauvola\'s document binarization algorithm based on integral images.'
                },
            ],
        }, {
            'name': 'binary_preprocessing',
            'description': 'Binary Preprocessor',
            'value': ['DeskewPageByRAST', 'RmBig', 'RmHalftone'],
            'multiple': True,
            'help': 'Filters for preprocessing binary images',
            'choices': [
                {
                    'type': 'ICleanupBinary',
                    'name': 'AutoInvert',
                    'parameters': [
                        {
                            'choices': None,
                            'name': 'fraction',
                            'value': '0.7',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'minheight',
                            'value': '100',
                            'description': ''
                        }
                    ],
                    'description': 'automatically invert white-on-black text'
                }, {
                    'type': 'ICleanupBinary',
                    'name': 'DeskewGrayPageByRAST',
                    'parameters': [
                        {
                            'choices': None,
                            'name': 'max_n',
                            'value': '10000',
                            'description': ''
                        }
                    ],
                    'description': 'Deskew page image by RAST'
                }, {
                    'type': 'ICleanupBinary',
                    'name': 'DeskewPageByRAST',
                    'parameters': [
                        {
                            'choices': None,
                            'name': 'max_n',
                            'value': '10000',
                            'description': ''
                        }
                    ],
                    'description': 'Deskew page image by RAST'
                }, {
                    'type': 'ICleanupBinary',
                    'name': 'DocClean',
                    'parameters': [],
                    'description': 'Running black filter,white filter on the image  thus removing noise'
                }, {
                    'type': 'ICleanupBinary',
                    'name': 'RmBig',
                    'parameters': [
                        {
                            'choices': None,
                            'name': 'mh',
                            'value': '100',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'mw',
                            'value': '300',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'minaspect',
                            'value': '0.03',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'maxaspect',
                            'value': '30',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'max_n',
                            'value': '50000',
                            'description': ''
                        }
                    ],
                    'description': 'remove big components (defaults for 300dpi images)'
                }, {
                    'type': 'ICleanupBinary',
                    'name': 'RmHalftone',
                    'parameters': [
                        {
                            'choices': None,
                            'name': 'factor',
                            'value': '3',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'threshold',
                            'value': '4',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'max_n',
                            'value': '20000',
                            'description': ''
                        }
                    ],
                    'description': 'remove halftoning (defaults for 300dpi images)'
                }
            ],
        }, {
            'name': 'page_segmenter',
            'description': 'Page Segmenter',
            'multiple': False,
            'value': 'SegmentPageByRAST',
            'help': 'Algorithm for segmenting binary page images',
            'choices': [
                {
                    'type': 'ISegmentPage',
                    'name': 'SegmentPageBy1CP',
                    'parameters': [],
                    'description': 'segment characters by horizontal projection (assumes single column)'
                }, {
                    'type': 'ISegmentPage',
                    'description': 'Segment Page by Hint.',
                    'parameters': [
                        {
                            'choices': None,
                            'name': 'toplines',
                            'value': '0',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'columns',
                            'value': '1',
                            'description': ''
                        }
                    ],
                    'name': 'SegmentPageByHint'
                }, {
                    'type': 'ISegmentPage',
                    'name': 'SegmentPageByRAST',
                    'parameters': [
                        {
                            'choices': None,
                            'name': 'all_pixels',
                            'value': '0',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'gap_factor',
                            'value': '10', 'description': ''
                        }, {
                            'choices': None,
                            'name': 'max_results',
                            'value': '1000',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'use_four_line_model',
                            'value': '0',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'max_descender',
                            'value': '20',
                            'description': ''
                        }
                    ],
                    'description': 'Segment page by RAST'
                }, {
                    'type': 'ISegmentPage',
                    'name': 'SegmentPageByRAST1',
                    'parameters': [
                        {
                            'choices': None,
                            'name': 'debug_layout',
                            'value': '0',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'debug_segm',
                            'value': None,
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'max_results',
                            'value': '1000',
                            'description': ''
                        }, {
                            'choices': None,
                            'name': 'max_descender',
                            'value': '20',
                            'description': ''
                        }
                    ],
                    'description': 'Segment page by RAST, assuming single column.'
                }, {
                    'type': 'ISegmentPage',
                    'name': 'SegmentPageByXYCUTS',
                    'parameters': [],
                    'description': 'segment page by XY-Cut algorithm.  Default parameters: tnx=78, tny=32, tcx=35, tcy=54, tnx,tny: cleaning trhesholds: tcx,tcy = min gap size hor. and ver.'
                },
            ],
        }, {
            'name': 'language_model',
            'multiple': False,
            'value': 'Default Tesseract English',
            'choices': [
                {
                    'description': 'Tesseract Default 3.00 ',
                    'name': 'Default Tesseract English',
                    'value': '1',
                }
            ], 
            'help': 'Model for language processing',
            'description': 'Language Model'
        }, {
            'name': 'character_model',
            'multiple': False,
            'value': 'Default Tesseract English',
            'choices': [
                {
                    'description': 'Tesseract Default 3.00 ',
                    'name': 'Default Tesseract English',
                    'value': '1',
                }
            ], 
            'help': 'Model for language processing',
            'description': 'Language Model'
        }
    ],
}



PAGESEG = {
    'description': 'Page Segmenter',
    'multiple': False,
    'help': 'Algorithm for segmenting binary page images',
    'name': 'page_segmenter',
}


TESTPOST = {
    u'@options.engine.tesseract[0].grayscale_preprocessing[0]': None,
    u'$options.engine.tesseract[2].binary_preprocessing[1].RmBig[2].minaspect': u'0.03',
    u'$options.engine.tesseract[2].binary_preprocessing[1].RmBig[0].mh': u'100',
    u'$options.engine.tesseract[2].binary_preprocessing[2].RmHalftone[1].threshold': u'4',
    u'$options.engine.tesseract[2].binary_preprocessing[2].RmHalftone[0].factor': u'3',
    u'$options.engine.tesseract[1].binarizer.BinarizeBySauvola[0].k': u'0.3',
    u'@options.engine.tesseract[3].page_segmenter': u'SegmentPageByXYCUTS',
    u'@options.engine.tesseract[2].binary_preprocessing[2]': u'RmHalftone',
    u'$options.engine.tesseract[2].binary_preprocessing[1].RmBig[4].max_n': u'50000',
    u'$options.engine.tesseract[2].binary_preprocessing[1].RmBig[1].mw': u'300',
    u'$options.engine.tesseract[2].binary_preprocessing[1].RmBig[3].maxaspect': u'30',
    u'$options.engine': u'tesseract',
    u'@options.engine.tesseract[2].binary_preprocessing[0]': u'AutoInvert',
    u'$options.engine.tesseract[2].binary_preprocessing[0].AutoInvert[1].minheight': u'100',
    u'$options.engine.tesseract[2].binary_preprocessing[0].AutoInvert[0].fraction': u'0.7',
    u'$options.engine.tesseract[2].binary_preprocessing[2].RmHalftone[2].max_n': u'20000',
    u'$options.engine.tesseract[1].binarizer.BinarizeBySauvola[1].w': u'40',
    u'$options.engine.tesseract[4].language_model': u'Default Tesseract English',
    u'@options.engine.tesseract[1].binarizer': u'BinarizeBySauvola',
    u'@options.engine.tesseract[2].binary_preprocessing[1]': u'RmBig'
}


TESTPOST_OCROPUS = {
    '%options.engine': 'ocropus',
#    '@options.engine.ocropus[0].grayscale_preprocessing[0]': None,
    '%options.engine.ocropus[1].binarizer': 'BinarizeBySauvola',
    '$options.engine.ocropus[1].binarizer.BinarizeBySauvola[0].k': 0.3,
    '$options.engine.ocropus[1].binarizer.BinarizeBySauvola[1].w': 40,
    '%options.engine.ocropus[2].binary_preprocessing[0]': 'AutoInvert',
    '$options.engine.ocropus[2].binary_preprocessing[0].AutoInvert[0].fraction': 0.7,
    '$options.engine.ocropus[2].binary_preprocessing[0].AutoInvert[1].minheight': 100,
    '%options.engine.ocropus[2].binary_preprocessing[1]': 'RmBig',
    '$options.engine.ocropus[2].binary_preprocessing[1].RmBig[0].mh': 100,
    '$options.engine.ocropus[2].binary_preprocessing[1].RmBig[1].mw': 300,
    '$options.engine.ocropus[2].binary_preprocessing[1].RmBig[2].minaspect': 0.03,
    '$options.engine.ocropus[2].binary_preprocessing[1].RmBig[3].maxaspect': 30,
    '$options.engine.ocropus[2].binary_preprocessing[1].RmBig[4].max_n': 50000,
    '%options.engine.ocropus[2].binary_preprocessing[2]': 'RmHalftone',
    '$options.engine.ocropus[2].binary_preprocessing[2].RmHalftone[0].factor': 3,
    '$options.engine.ocropus[2].binary_preprocessing[2].RmHalftone[1].threshold': 4,
    '$options.engine.ocropus[2].binary_preprocessing[2].RmHalftone[2].max_n': 20000,
    '%options.engine.ocropus[3].page_segmenter': 'SegmentPageByRAST',
    '$options.engine.ocropus[3].page_segmenter.SegmentPageByRAST[0].all_pixels': 0,
    '$options.engine.ocropus[3].page_segmenter.SegmentPageByRAST[1].gap_factor': 10,
    '$options.engine.ocropus[3].page_segmenter.SegmentPageByRAST[2].max_results': 1000,
    '$options.engine.ocropus[3].page_segmenter.SegmentPageByRAST[3].use_four_line_model': 0,
    '$options.engine.ocropus[3].page_segmenter.SegmentPageByRAST[4].max_descender': 20,
    '$options.engine.ocropus[4].character_model': 'Ocropus Default Char',
    '$options.engine.ocropus[5].language_model': 'Ocropus Default Lang',
}

TESTPOST_OCROPUS_SEG = {
    '%options.engine': 'ocropus',
    '%options.engine.ocropus[1].binarizer': 'BinarizeBySauvola',
    '%options.engine.ocropus[3].page_segmenter': 'SegmentPageBy1CP',
    '$options.engine.ocropus[4].character_model': 'Ocropus Default Char',
    '$options.engine.ocropus[5].language_model': 'Ocropus Default Lang',
}


TESTPOST_OCROPUS_BIN = {
    '%options.engine': 'ocropus',
    '%options.engine.ocropus[1].binarizer': 'BinarizeByOTSU',
    '%options.engine.ocropus[3].page_segmenter': 'SegmentPageByRAST1',
    '$options.engine.ocropus[4].character_model': 'Ocropus Default Char',
    '$options.engine.ocropus[5].language_model': 'Ocropus Default Lang',
}

