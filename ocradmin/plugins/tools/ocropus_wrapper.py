"""
Ocropus plugin.  Because Ocropus offers lots of descrete functionality
this is also the base class of the Tesseract wrapper and the generic
line wrapper.
"""

import copy
from ocradmin.plugins import check_aborted, \
        ExternalToolError
from ocradmin.ocrmodels.models import OcrModel
import generic_wrapper
#reload(generic_wrapper)

import ocropus_options
#reload(ocropus_options)

import ocrolib

from ocradmin.plugins import parameters
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



class OcropusWrapper(generic_wrapper.GenericWrapper,
            ocropus_options.OcropusOptions):
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
        self.config = kwargs.get("config") if kwargs.get("config") \
                else parameters.OcrParameters.from_parameters(
                    dict(name=self.name, parameters=self.get_parameters()))
        self._cmodel = None
        self._lmodel = None
        self._trainbin = None
        self.training = False

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

    def init_trainer(self):
        """
        Load the cmodel for training.
        """
        try:
            #self._linerec = ocrolib.ocropus.load_linerec(self.params.cmodel)
            self._linerec = ocrolib.RecognizeLine()
            cmodpath = self._load_model_path(self.config.character_model)
            self._linerec.load_native(cmodpath)
        except (StandardError, RuntimeError):
            raise
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

    def save_new_model(self, outpath):
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
        self._linerec.save_native(outpath)

