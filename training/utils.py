import os
import sys
import re
import subprocess as sp
import tempfile
from django.utils import simplejson
from django.conf import settings



def isri_accuracy(gttext, text):
    """
    Run the ISRI accuracy tool on a groundtruth
    and some random text.
    """
    accuracybin = os.path.join(settings.BIN_PATH, "accuracy")
    with tempfile.NamedTemporaryFile() as gtf:
        gtf.write(gttext)
        gtf.flush()
        with tempfile.NamedTemporaryFile() as f:
            f.write(text)
            f.flush()
            #print accuracybin, gtf.name, f.name
            score, err = sp.Popen(["%s %s %s" % (accuracybin, gtf.name, f.name)],
                    shell=True, stdout=sp.PIPE, stderr=sp.PIPE).communicate()
            pmatch = re.search('\s+(?P<percent>\d+\.\d+)%\s+Accuracy After Correction',
                    score, re.MULTILINE)
            if pmatch:
                return float(pmatch.groups("percent")[0]), score
            return err, None    
                




