
import logging

class OcrOptions(object):
    """
    Base class for OCR processor.
    """
    name = "base"

    @classmethod
    def get_parameters(cls, *args):
        """
        Return a data structure describing the
        parameters of this processor.
        """
        if len(args) == 0:
            return dict(
                preprocessing=cls.get_preprocessing_parameters(),
                page_segmentation=cls.get_page_segmentation_parameters(),
                recognition=cls.get_recognition_parameters(),
                general=cls.get_general_parameters()
            )
        else:
            params = {}
            for arg in args:
                method = "get_%s_parameters" % arg
                if getattr(cls, method):
                    params[arg] = getattr(cls, method)()
            return params                    

    @classmethod        
    def get_preprocessing_parameters(cls):
        """
        Get preprocessing options.
        """
        return dict(
            grayscale_filters=cls.get_grayscale_filters(),
            binarizer=cls.get_binarizers(),
            binary_filters=cls.get_binary_filters(),
            general=cls.get_general_preprocessing_parameters()
        )

    @classmethod
    def get_general_preprocessing_parameters(cls):
        """
        General preprocessing options.
        """
        return []

    @classmethod
    def get_grayscale_filters(cls):
        """
        Get grayscale processing options.
        """
        return []

    @classmethod
    def get_binarizers(cls):
        """
        Get binarisation options.
        """
        return []

    @classmethod
    def get_binary_filters(cls):
        """
        Get binary preprocessing options.
        """
        return []

    @classmethod
    def get_page_segmentation_parameters(cls):
        """
        Get page segmentation options.
        """                
        return []

    @classmethod
    def get_recognition_parameters(cls):
        """
        Get page transcription options.
        """
        return []

    @classmethod
    def get_general_parameters(cls):
        """
        Get miscellaneous options.
        """
        return []
