"""
Ocropus plugin.  Because Ocropus offers lots of descrete functionality
this is also the base class of the Tesseract wrapper and the generic
line wrapper.
"""

import copy
from ocradmin.ocr.tools import check_aborted, \
        ExternalToolError
from ocradmin.ocr import tools        
from ocradmin.ocrmodels.models import OcrModel
from ocradmin.ocr.tools.plugins import generic_wrapper
reload(generic_wrapper)
import ocrolib

from ocradmin.ocrplugins import parameters
reload(parameters)


class OcropusError(StandardError):
    """
    Ocropus-related exceptions.
    """
    pass



def main_class():
    """
    Exported wrapper.
    """
    return OcropusWrapper



class OcropusWrapper(generic_wrapper.GenericWrapper):
    """
    Wrapper around OCRopus's basic page-recognition functions so
    that bits and peices can be reused more easily.
    """
    name = "ocropus"
    description = "Open-Source OCR"
    capabilities = ("line", "binarize", "segment", "trainer")

    def __init__(self, *args, **kwargs):
        """
        Initialise an OcropusWrapper object.
        """
        super(OcropusWrapper, self).__init__(*args, **kwargs)
        self.config = parameters.OcrParameters.from_parameters(
                dict(name=self.name, parameters=self.parameters()))
        self._cmodel = None
        self._lmodel = None
        self._trainbin = None
        self.training = False


    @classmethod
    def parameters(cls):
        params = copy.deepcopy(generic_wrapper.GenericWrapper.parameters())
        mods = OcrModel.objects.filter(app="ocropus")
        cmods = [dict(name=m.name, description=m.description) for m in
                 mods if m.type == "char"]
        lmods = [dict(name=m.name, description=m.description) for m in
                 mods if m.type == "lang"]
        _parameters = [
            {
                "name": "character_model",
                "description": "Character Model",
                "help": "Model for character recognition",
                "value": cmods[0]["name"] if len(cmods) else None,
                "multiple": False,
                "choices": cmods,
            }, {
                "name": "language_model",
                "description": "Language Model",
                "value": lmods[0]["name"] if len(lmods) else None,
                "help": "Model for language processing",
                "multiple": False,
                "choices": lmods,
            }, {
                "name": "debug",
                "description": "Dump debug info",
                "multiple": False,
                "value": True,
                "type": "bool",
            },  
        ]
        params.extend(_parameters)
        return params


    @classmethod
    def _get_character_model_parameter_info(cls):
        info = [i for i in cls.parameters() if i["name"] == "character_model"][0]
        mods = OcrModel.objects.filter(app="ocropus", type="char")
        info["choices"] = [
                dict(name=m.name, description=m.description) for m in mods]
        return info


    @classmethod
    def _get_language_model_parameter_info(cls):
        info = [i for i in cls.parameters() if i["name"] == "language_model"][0]
        mods = OcrModel.objects.filter(app="ocropus", type="lang")
        info["choices"] = [
                dict(name=m.name, description=m.description) for m in mods]
        return info

    @classmethod
    def _lookup_model_file(cls, modelname):
        """
        Lookup the filename of a model from its
        database name.
        """
        mod = OcrModel.objects.get(name=modelname)
        return mod.file.path.encode()


    def init_converter(self):
        """
        Load the line-recogniser and the lmodel FST objects.
        """
        try:
            self._linerec = ocrolib.RecognizeLine()
            cmodpath = self._lookup_model_file(self.config.character_model)
            self._linerec.load_native(cmodpath)
            self._lmodel = ocrolib.OcroFST()
            lmodpath = self._lookup_model_file(self.config.language_model)
            self.logger.info("Loading file: %s" % lmodpath)
            self._lmodel.load(lmodpath)
        except (StandardError, RuntimeError):
            raise
        if self.params.segmenter:
            self.logger.info("Using line segmenter: %s" % self.params.segmenter)
            self._linerec.pset("segmenter", self.params.segmenter)
        if self.params.grouper:
            self.logger.info("Using grouper: %s" % self.params.grouper)
            self._linerec.pset("grouper", self.params.grouper)
        # TODO: Work out how to set parameters on the grouper and segmenter
        # Unsure about how (or if it's possible) to access the segmenter
        # via the LineRec
        #for name, val in self.params.iteritems():
        #    # find the 'long' name for the component with the given short
        #    # name, i.e: binsauvola -> BinarizeBySauvola
        #    cmatch = re.match("%s__(.+)" % self.params.segmenter, name, re.I)
        #    if cmatch:
        #        param = cmatch.groups()[0]
        #        self._linerec.pset(param, val)


    def init_trainer(self):
        """
        Load the cmodel for training.
        """
        try:
            #self._linerec = ocrolib.ocropus.load_linerec(self.params.cmodel)
            self._linerec = ocrolib.RecognizeLine()
            cmodpath = self._load_model_path(self.config.character_model.name)
            self._linerec.load_native(cmodpath)
        except (StandardError, RuntimeError), err:
            raise err
        self._linerec.startTraining()
        self.training = True


    def finalize_trainer(self):
        """
        Stop training.
        """
        self._linerec.finishTraining()


    @check_aborted
    def get_transcript(self, line):
        """
        Run line-recognition on an ocrolib.iulib.bytearray images of a
        single line.
        """
        if self._lmodel is None:
            self.init_converter()
        fst = self._linerec.recognizeLine(line)
        # NOTE: This returns the cost - not currently used
        out, _ = ocrolib.beam_search_simple(fst, self._lmodel, 1000)
        return out


    def load_training_binary(self, imagepath):
        """
        Load an image to use for training.
        """
        self._trainbin = ocrolib.read_image_gray(imagepath)


    def train_line(self, bbox, text):
        """
        Train on a line, using the bbox to extract the line
        from the given page.
        """
        if not self.training:
            self.init_trainer()
        # need to invert the bbox for the time being
        # we should really store it the right way
        # round in the first place
        height = self._trainbin.shape[0]
        ibox = (bbox[0], height - bbox[1],
                bbox[0] + bbox[2] + 1,
                (height - bbox[1]) + bbox[3] + 1)
        sub = ocrolib.iulib.bytearray()
        ocrolib.iulib.extract_subimage(sub,
                ocrolib.numpy2narray(self._trainbin), *ibox)

        try:
            self._linerec.addTrainingLine(ocrolib.narray2numpy(sub),
                    unicode(text))
        except StandardError, err:
            traceback.print_exc()
            self.logger.error(
                    "Skipping training line: %s: %s" % (text, err.message))


    def save_new_model(self):
        """
        Finalise training and save model.
        """
        self.logger.info("Attempting to finalise training")
        tries = 5
        while (tries > 0):
            try:
                self.finalize_trainer()
                break
            except StandardError, err:
                self.logger.error("Encounter runtime error: %s" % err.message)
                self.logger.info("Tries left: %d" % tries)
            tries -= 1

        self.logger.info("Saving trained model")
        self._linerec.save_native(self.params.outmodel)


