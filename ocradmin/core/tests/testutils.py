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
            os.makedirs("media/test")
        except OSError, (errno, strerr):
            if errno == 17: # already exists
                pass

        try:
            os.symlink(os.path.abspath("%s/%s" % (MODELDIR, fname)),
                "media/test/%s" % fname)
        except OSError, (errno, strerr):
            if errno == 17: # already exists
                pass


def symlink_reference_pages():
    """
    Create a symlink for the reference page images.
    """
    try:
        os.makedirs("media/test")
    except OSError, (errno, strerr):
        if errno == 17: # already exists
            pass

        try:
            os.symlink(os.path.abspath("etc/simple.png"),
                "media/test/test.png")
            os.symlink(os.path.abspath("etc/simple.png"),
                "media/test/test_bin.png")
        except OSError, (errno, strerr):
            if errno == 17: # already exists
                pass


