"""
Functions for performing test setup/teardown etc.
"""

import os

MODELDIR = "etc/defaultmodels" 


def symlink_model_fixtures():
    """
    Create symlinks between the files referenced in the OcrModel
    fixtures and our default model files.  Need to do this because
    they get deleted again at test teardown.
    """
    for fname in os.listdir(MODELDIR):
        try:
            os.symlink(os.path.abspath("%s/%s" % (MODELDIR, fname)),  
                "media/test/%s" % fname)
        except OSError, (errno, strerr):
            if errno == 17: # already exists
                pass


    
