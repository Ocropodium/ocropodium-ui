# OCR Batch utils

import os
import re
import subprocess as sp



class Aspell(object):
    """
    Aspell Wrapper.
    """
    suggestre = re.compile("& (?P<word>\S+) (?P<numsuggests>\d+) (?P<wordpos>\d+): (?P<suggests>.+)")
    nomatchre = re.compile("# (?P<word>\S+) (?P<wordpos>\d+)")
    def __init__(self):
        """
        Initialise an Aspell object.
        """
        pass

    def spellcheck(self, data):        
        """
        Spellcheck some data.
        """
        pipe = sp.Popen(["aspell -a"], shell=True, stdout=sp.PIPE, stdin=sp.PIPE, close_fds=True)
        head = pipe.stdout.readline()
        if head.find("International Ispell") == -1:
            raise AssertionError("Unexpected Ispell output: " + head)
        # switch to terse mode
        pipe.stdin.write('!\n')
        # write the data
        pipe.stdin.write(data + "\n")
        stdout, stderr = pipe.communicate()
        
        out = []
        for line in stdout.split("\n"):
            if line.startswith("&"):
                m = self.suggestre.match(line)
                captures = m.groupdict()
                captures["suggests"] = m.group("suggests").split(", ")
                out.append(captures)
            elif line.startswith("#"):
                n = self.nomatchre.match(line)
                captures = n.groupdict()
                captures["numsuggests"] = "0"
                out.append(captures)
        return out




if __name__=="__main__":
    a = Aspell()
    print a.spellcheck("This is some\nlins to check")
